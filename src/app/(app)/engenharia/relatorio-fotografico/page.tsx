'use client';

import { Suspense, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Building2, Camera, Check, ChevronDown, ChevronUp, List, Loader2, Ruler, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  adicionarAmbienteGlobal,
  atualizarCamposProjeto,
  atualizarEquipamentos,
  atualizarEstrutura,
  atualizarProgresso,
  buscarProjetoPorId,
  buscarProjetos,
  buscarProjetosComFiltros,
  criarEstrutura,
  criarProgresso,
  desabilitarServico,
  excluirProgresso,
  habilitarServico,
  lerAmbientesGlobais,
  lerBancosCatalogo,
  lerModelosPorBanco,
  lerServicosGlobais,
  listarClientesFinaisUsados,
  listarProgresso,
  obterEstruturaPorProjeto,
  removerAmbienteGlobal,
  reordenarProgresso,
  uploadFotoRelatorio,
  urlPublicaFoto,
} from '@/modules/engenharia/relatorio-fotografico/services/apiRelatorioFotografico';
import { descricaoDe, descricaoReforma, limpaNome, pad } from '@/modules/engenharia/relatorio-fotografico/calc';
import type {
  Equipamento,
  EstruturaFotografica,
  ModeloRelatorioOpcao,
  ProgressoSlide,
  ProjetoResumo,
  TipoProjetoFotografico,
} from '@/modules/engenharia/relatorio-fotografico/types';

function ajustaPontos(pontos: { numero: string; local: string }[], qtd: number) {
  qtd = Math.max(0, Math.min(999, qtd | 0));
  const novo = pontos.slice(0, qtd);
  while (novo.length < qtd) novo.push({ numero: pad(novo.length + 1), local: '' });
  return novo;
}

const STATUS_LABEL: Record<string, string> = {
  planejado: 'Planejado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  suspenso: 'Suspenso',
};

function formatarData(iso: string | null): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

/** Modal de busca ampliada — filtros por texto, cliente final e status, sem o limite de 20 do autocomplete. */
function ModalBuscaProjetos({ onSelecionar, onFechar }: { onSelecionar: (p: ProjetoResumo) => void; onFechar: () => void }) {
  const [texto, setTexto] = useState('');
  const [clienteFinalId, setClienteFinalId] = useState('');
  const [status, setStatus] = useState('');
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [resultados, setResultados] = useState<ProjetoResumo[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    listarClientesFinaisUsados().then(setClientes).catch(() => {});
  }, []);

  useEffect(() => {
    setCarregando(true);
    const t = setTimeout(() => {
      buscarProjetosComFiltros({ texto, clienteFinalId: clienteFinalId || undefined, status: status || undefined })
        .then(setResultados)
        .catch(console.error)
        .finally(() => setCarregando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [texto, clienteFinalId, status]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onFechar}>
      <div
        className="bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-card-border">
          <h3 className="text-sm font-bold text-main font-vomzom">Todos os projetos</h3>
          <button onClick={onFechar} className="text-desc hover:text-main">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-2 border-b border-card-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-desc" />
            <input
              autoFocus
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar por nome ou OS..."
              className="w-full pl-8 pr-3 py-2 bg-background border border-card-border rounded-lg text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-ocre font-bold"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={clienteFinalId}
              onChange={(e) => setClienteFinalId(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-xs text-main font-semibold"
            >
              <option value="">Todos os clientes finais</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-xs text-main font-semibold"
            >
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {carregando && <div className="p-4 text-xs text-sub">Buscando…</div>}
          {!carregando && resultados.length === 0 && <div className="p-4 text-xs text-sub">Nenhum projeto encontrado.</div>}
          {!carregando &&
            resultados.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelecionar(p)}
                className="w-full text-left px-4 py-3 border-b border-card-border/50 last:border-0 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-main">{p.nome}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-brand-ocre bg-brand-ocre/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {STATUS_LABEL[p.status] || p.status}
                  </span>
                </div>
                <div className="text-[10px] text-sub mt-0.5">
                  OS {p.os} · {p.tipologia} {p.cliente_final_nome ? '· ' + p.cliente_final_nome : ''}
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

/** Slot de foto único (antes ou depois) — botão vira miniatura assim que há um caminho salvo. */
function SlotFoto({
  rotulo,
  caminho,
  ocupado,
  somenteLeitura,
  onSelecionar,
}: {
  rotulo: string;
  caminho: string | null | undefined;
  ocupado?: boolean;
  somenteLeitura?: boolean;
  onSelecionar: (file: File) => void;
}) {
  const inputId = useId();
  const miolo = (
    <>
      {caminho ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={urlPublicaFoto(caminho)} alt={rotulo} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <>
          <Camera size={16} className="text-desc" />
          <span className="text-[9px] font-bold text-desc uppercase">{rotulo}</span>
        </>
      )}
      {caminho && (
        <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] font-bold uppercase text-center py-0.5">
          {rotulo}
        </span>
      )}
    </>
  );

  if (somenteLeitura) {
    return (
      <div
        className={`relative flex flex-col items-center justify-center gap-1 w-20 h-20 rounded-lg border-2 overflow-hidden shrink-0 ${
          caminho ? 'border-brand-ocre/40' : 'border-dashed border-card-border'
        }`}
      >
        {miolo}
      </div>
    );
  }

  return (
    <label
      htmlFor={inputId}
      className={`relative flex flex-col items-center justify-center gap-1 w-20 h-20 rounded-lg border-2 border-dashed overflow-hidden shrink-0 ${
        caminho ? 'border-brand-ocre/40' : 'border-card-border'
      } ${ocupado ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:border-brand-ocre/60'}`}
    >
      {miolo}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={ocupado}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelecionar(file);
          e.target.value = '';
        }}
      />
    </label>
  );
}

/** Legenda do slide (mesma regra usada no PowerPoint) — infra: equipamento+ponto; reforma: serviço+ambiente. */
function legendaSlide(s: ProgressoSlide): string {
  if (s.equipamento) return descricaoDe(s.equipamento, s.numero_ponto || '0', s.local || '', 'normal');
  return descricaoReforma(s.servico || '', s.ambiente || '', 'normal');
}

/** Lightbox de slide — antes/durante + depois lado a lado, ampliado, igual ao layout final do PowerPoint. */
function ModalPreviaSlide({ slide, indice, onFechar }: { slide: ProgressoSlide; indice: number; onFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onFechar}>
      <div
        className="bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-card-border">
          <h3 className="text-sm font-bold text-main font-vomzom">Slide {indice + 1}</h3>
          <button onClick={onFechar} className="text-desc hover:text-main">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 flex flex-wrap gap-4 overflow-y-auto">
          <div className="flex-1 min-w-[240px] space-y-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlPublicaFoto(slide.foto_antes_path)}
              alt={slide.etapa1}
              className="w-full aspect-[4/3] object-cover rounded-lg border border-card-border"
            />
            <p className="text-[11px] font-bold text-desc uppercase tracking-wide">{slide.etapa1 === 'ANTES' ? 'Antes' : 'Durante'}</p>
          </div>
          <div className="flex-1 min-w-[240px] space-y-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlPublicaFoto(slide.foto_depois_path)}
              alt="Depois"
              className="w-full aspect-[4/3] object-cover rounded-lg border border-card-border"
            />
            <p className="text-[11px] font-bold text-desc uppercase tracking-wide">Depois</p>
          </div>
        </div>
        <div className="px-4 pb-4 text-xs font-bold text-main">{legendaSlide(slide)}</div>
      </div>
    </div>
  );
}

function RelatorioFotograficoContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const projetoIdUrl = searchParams.get('projetoId');

  // passo 1 — vínculo com projeto (ou avulso)
  const [isAvulso, setIsAvulso] = useState(false);
  const [obraNome, setObraNome] = useState('');
  const [projetoBusca, setProjetoBusca] = useState('');
  const [projetosSugeridos, setProjetosSugeridos] = useState<ProjetoResumo[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [projetoSelecionado, setProjetoSelecionado] = useState<ProjetoResumo | null>(null);
  const [buscandoProjetos, setBuscandoProjetos] = useState(false);
  const [modalBuscaAberto, setModalBuscaAberto] = useState(false);

  // passo 2 — tipo
  const [tipoProjeto, setTipoProjeto] = useState<TipoProjetoFotografico>('infraestrutura');

  // passo 3 — dados de cabeçalho (slides 1 e 2)
  const [banco, setBanco] = useState('');
  const [bancosCatalogo, setBancosCatalogo] = useState<string[]>([]);
  const [modeloRelatorio, setModeloRelatorio] = useState('');
  const [modelosDoBanco, setModelosDoBanco] = useState<ModeloRelatorioOpcao[]>([]);
  const [agencia, setAgencia] = useState('');
  const [programa, setPrograma] = useState('');
  const [upe, setUpe] = useState('');
  const [sap, setSap] = useState('');
  const [gestor, setGestor] = useState('');
  const [fiscEmpresa, setFiscEmpresa] = useState('');
  const [fiscal, setFiscal] = useState('');
  const [construtora, setConstrutora] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [dataInicioObra, setDataInicioObra] = useState('');
  const [dataTerminoObra, setDataTerminoObra] = useState('');
  const [habilitarEdicaoObra, setHabilitarEdicaoObra] = useState(false);

  const [estrutura, setEstrutura] = useState<EstruturaFotografica | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resumoExpandido, setResumoExpandido] = useState(true);
  const proximaEtapaRef = useRef<HTMLDivElement | null>(null);

  // passo 4 — equipamentos (infra) / serviços e ambientes (reforma)
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [servicosGlobais, setServicosGlobais] = useState<string[]>([]);
  const [novoServico, setNovoServico] = useState('');
  const [servicoDisponivelEscolhido, setServicoDisponivelEscolhido] = useState('');
  const [servicoOcupado, setServicoOcupado] = useState<string | null>(null);
  const [ambientesGlobais, setAmbientesGlobais] = useState<string[]>([]);
  const [novoAmbiente, setNovoAmbiente] = useState('');
  const [ambienteOcupado, setAmbienteOcupado] = useState<string | null>(null);
  const [previaIndice, setPreviaIndice] = useState<number | null>(null);
  const [ordemOcupada, setOrdemOcupada] = useState(false);

  // fotos/progresso (slides antes/depois) — passo 5
  const [progresso, setProgresso] = useState<ProgressoSlide[]>([]);
  const [fotoOcupada, setFotoOcupada] = useState<string | null>(null);
  const rascunhosFotoRef = useRef<Record<string, { antes?: string; depois?: string }>>({});
  const [, forcarAtualizacao] = useState(0);
  const [novoSlideServico, setNovoSlideServico] = useState<string | null>(null);
  const [novoSlideEtapa, setNovoSlideEtapa] = useState<'ANTES' | 'DURANTE'>('ANTES');
  const [novoSlideAmbiente, setNovoSlideAmbiente] = useState('');
  const [novoSlideAntes, setNovoSlideAntes] = useState<File | null>(null);
  const [novoSlideDepois, setNovoSlideDepois] = useState<File | null>(null);

  useEffect(() => {
    lerServicosGlobais().then(setServicosGlobais).catch(() => {});
    lerBancosCatalogo().then(setBancosCatalogo).catch(() => {});
    lerAmbientesGlobais().then(setAmbientesGlobais).catch(() => {});
  }, []);

  useEffect(() => {
    if (!estrutura) {
      setProgresso([]);
      rascunhosFotoRef.current = {};
      return;
    }
    listarProgresso(estrutura.id).then(setProgresso).catch(console.error);
  }, [estrutura?.id]);

  useEffect(() => {
    if (projetoIdUrl) {
      buscarProjetoPorId(projetoIdUrl)
        .then((p) => {
          if (p) selecionarProjeto(p);
        })
        .catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoIdUrl]);

  // autocomplete de projeto — mesmo padrão do FormProjeto (busca + dropdown)
  useEffect(() => {
    if (isAvulso || !projetoBusca.trim()) {
      setProjetosSugeridos([]);
      return;
    }
    const t = setTimeout(async () => {
      setBuscandoProjetos(true);
      try {
        setProjetosSugeridos(await buscarProjetos(projetoBusca));
      } catch (e) {
        console.error(e);
      } finally {
        setBuscandoProjetos(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [projetoBusca, isAvulso]);

  // modelo depende do banco escolhido — nunca digitado, sempre selecionado (ver docs/decisoes.md)
  useEffect(() => {
    if (!banco) {
      setModelosDoBanco([]);
      return;
    }
    lerModelosPorBanco(banco).then(setModelosDoBanco).catch(() => setModelosDoBanco([]));
  }, [banco]);

  const modelosFiltrados = useMemo(
    () => modelosDoBanco.filter((m) => !m.tipo_projeto || m.tipo_projeto === tipoProjeto),
    [modelosDoBanco, tipoProjeto],
  );

  // se o modelo selecionado deixar de valer (trocou banco/tipo), limpa; se houver apenas 1 disponível, auto-seleciona por padrão
  useEffect(() => {
    if (modelosFiltrados.length === 1) {
      setModeloRelatorio(modelosFiltrados[0].nome);
    } else if (modeloRelatorio && !modelosFiltrados.some((m) => m.nome === modeloRelatorio)) {
      setModeloRelatorio('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelosFiltrados]);

  async function selecionarProjeto(p: ProjetoResumo) {
    setProjetoSelecionado(p);
    setProjetoBusca(p.nome);
    setMostrarSugestoes(false);
    setModalBuscaAberto(false);
    setPrograma(p.tipologia || '');
    // dados de obra vêm do projeto (migration 00010) — fonte única, não duplicada no relatório
    setAgencia(p.agencia || '');
    setUpe(p.upe || '');
    setSap(p.sap || '');
    setGestor(p.gestor || '');
    setFiscEmpresa(p.fiscalizacao_empresa || '');
    setFiscal(p.fiscal || '');
    setConstrutora(p.construtora || '');
    setResponsavel(p.responsavel || '');
    // datas de início/término = SEMPRE a efetiva do projeto (o rótulo diz "Efetivo" —
    // nunca substituir silenciosamente pela prevista aqui; ver docs/decisoes.md).
    // Se a efetiva ainda não existe, o campo fica vazio e vira pendência (a prevista
    // aparece só como dica abaixo do campo).
    setDataInicioObra(p.data_efetiva_inicio || '');
    setDataTerminoObra(p.data_efetiva_termino || '');
    setHabilitarEdicaoObra(false);
    setResumoExpandido(true);

    // banco: se o cliente final do projeto bater com um banco conhecido, pré-seleciona
    if (p.cliente_final_nome && bancosCatalogo.includes(p.cliente_final_nome)) {
      setBanco(p.cliente_final_nome);
    }

    const existente = await obterEstruturaPorProjeto(p.id).catch(() => null);
    if (existente) {
      carregarEstruturaNoFormulario(existente);
    }
  }

  function trocarProjeto() {
    setProjetoSelecionado(null);
    setProjetoBusca('');
    setEstrutura(null);
    setHabilitarEdicaoObra(false);
    setDataInicioObra('');
    setDataTerminoObra('');
    setResumoExpandido(true);
  }

  function carregarEstruturaNoFormulario(e: EstruturaFotografica) {
    setEstrutura(e);
    setTipoProjeto(e.tipo_projeto);
    setBanco(e.banco || '');
    setModeloRelatorio(e.modelo_relatorio || '');
    setPrograma(e.programa || '');
    // agência/UPE/SAP/gestor/fiscalização/construtora/responsável: quando vinculado a
    // projeto, essa informação vive em `projetos` (migration 00010) e já foi
    // preenchida por selecionarProjeto() — aqui só sobrescreve no caso avulso,
    // onde a própria engenharia_estrutura_fotografica é a fonte (migration 00009).
    if (e.is_avulso) {
      setAgencia(e.agencia || '');
      setUpe(e.upe || '');
      setSap(e.sap || '');
      setGestor(e.gestor || '');
      setFiscEmpresa(e.fiscalizacao_empresa || '');
      setFiscal(e.fiscal || '');
      setConstrutora(e.construtora || '');
      setResponsavel(e.responsavel || '');
      setDataInicioObra(e.data_inicio_obra || '');
      setDataTerminoObra(e.data_termino_obra || '');
    }
    setEquipamentos(e.equipamentos || []);
  }

  const podeCriar = isAvulso ? obraNome.trim().length > 0 : !!projetoSelecionado;

  // Pendências dos dados do relatório — não bloqueiam o preenchimento, mas devem
  // impedir a montagem do PowerPoint (chamado de atenção explícito do David).
  const pendencias = useMemo(() => {
    const campos: { label: string; valor: string }[] = [
      { label: 'Banco', valor: banco },
      { label: 'Modelo de relatório', valor: modeloRelatorio },
      { label: 'Agência', valor: agencia },
      { label: 'Programa', valor: programa },
      { label: 'Cód UPE', valor: upe },
      { label: 'Cód SAP', valor: sap },
      { label: 'Gestor de obras', valor: gestor },
      { label: 'Fiscalização — empresa', valor: fiscEmpresa },
      { label: 'Fiscal', valor: fiscal },
      { label: 'Construtora — empresa', valor: construtora },
      { label: 'Responsável', valor: responsavel },
      { label: 'Início da obra (Efetivo)', valor: dataInicioObra },
      { label: 'Término da obra (Efetivo)', valor: dataTerminoObra },
    ];
    return campos.filter((c) => !c.valor || !c.valor.trim()).map((c) => c.label);
  }, [banco, modeloRelatorio, agencia, programa, upe, sap, gestor, fiscEmpresa, fiscal, construtora, responsavel, dataInicioObra, dataTerminoObra]);

  /**
   * Dados de obra (agência/UPE/SAP/gestor/fiscalização/construtora/
   * responsável/datas): quando vinculado a projeto, moram em `projetos`
   * (migration 00010) — fonte única, útil pra empresa toda, não só o
   * relatório. Só ficam em `engenharia_estrutura_fotografica` (migration
   * 00009) quando avulso, já que aí não existe uma linha de `projetos`
   * pra guardar isso.
   */
  async function criarOuAtualizarCabecalho() {
    setSalvando(true);
    setErro(null);
    try {
      const camposObra = isAvulso
        ? {
            agencia: agencia || null,
            upe: upe || null,
            sap: sap || null,
            gestor: gestor || null,
            fiscalizacao_empresa: fiscEmpresa || null,
            fiscal: fiscal || null,
            construtora: construtora || null,
            responsavel: responsavel || null,
            data_inicio_obra: dataInicioObra || null,
            data_termino_obra: dataTerminoObra || null,
          }
        : {
            agencia: null,
            upe: null,
            sap: null,
            gestor: null,
            fiscalizacao_empresa: null,
            fiscal: null,
            construtora: null,
            responsavel: null,
            data_inicio_obra: null,
            data_termino_obra: null,
          };

      if (!estrutura) {
        const nova = await criarEstrutura({
          projetoId: isAvulso ? null : projetoSelecionado!.id,
          userId: user?.id ?? null,
          isAvulso,
          obraNome: isAvulso ? limpaNome(obraNome) : null,
          tipoProjeto,
          banco: banco || null,
          modeloRelatorio: modeloRelatorio || null,
          programa: programa || null,
          ...camposObra,
        });
        setEstrutura(nova);
        // depois de criado, recolhe projeto/tipo num resumo compacto e leva o
        // usuário direto pra continuação (equipamentos/serviços) — antes disso
        // a seção 4 nascia fora da tela e parecia que só "abria o item 4".
        setResumoExpandido(false);
        setTimeout(() => proximaEtapaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
        if (!isAvulso && habilitarEdicaoObra) {
          await atualizarCamposProjeto(projetoSelecionado!.id, {
            agencia: agencia || null,
            upe: upe || null,
            sap: sap || null,
            gestor: gestor || null,
            fiscalizacao_empresa: fiscEmpresa || null,
            fiscal: fiscal || null,
            construtora: construtora || null,
            responsavel: responsavel || null,
            data_efetiva_inicio: dataInicioObra || null,
            data_efetiva_termino: dataTerminoObra || null,
          });
        }
        return nova;
      }

      const atualizada = await atualizarEstrutura(estrutura.id, {
        tipo_projeto: tipoProjeto,
        banco: banco || null,
        modelo_relatorio: modeloRelatorio || null,
        programa: programa || null,
        ...camposObra,
      });
      setEstrutura(atualizada);
      if (!isAvulso && projetoSelecionado && habilitarEdicaoObra) {
        await atualizarCamposProjeto(projetoSelecionado.id, {
          agencia: agencia || null,
          upe: upe || null,
          sap: sap || null,
          gestor: gestor || null,
          fiscalizacao_empresa: fiscEmpresa || null,
          fiscal: fiscal || null,
          construtora: construtora || null,
          responsavel: responsavel || null,
          data_efetiva_inicio: dataInicioObra || null,
          data_efetiva_termino: dataTerminoObra || null,
        });
      }
      return atualizada;
    } catch (e) {
      setErro((e as Error).message);
      return null;
    } finally {
      setSalvando(false);
    }
  }

  async function habilitarServicoAqui(nome: string) {
    let alvo = estrutura;
    if (!alvo) alvo = await criarOuAtualizarCabecalho();
    if (!alvo) return;
    setServicoOcupado(nome);
    try {
      const atualizada = await habilitarServico(alvo.id, nome);
      setEstrutura(atualizada);
      if (!servicosGlobais.includes(nome.trim().toUpperCase())) {
        setServicosGlobais(await lerServicosGlobais());
      }
      setNovoServico('');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setServicoOcupado(null);
    }
  }

  async function desabilitarServicoAqui(nome: string) {
    if (!estrutura) return;
    setServicoOcupado(nome);
    try {
      setEstrutura(await desabilitarServico(estrutura.id, nome));
    } finally {
      setServicoOcupado(null);
    }
  }

  /** Ambientes são um catálogo global (igual serviços), mas sem etapa de "habilitar por relatório" — qualquer um cadastrado já vale pra qualquer slide. */
  async function criarAmbiente(nome: string) {
    const limpo = nome.trim();
    if (!limpo) return;
    setAmbienteOcupado(limpo);
    try {
      await adicionarAmbienteGlobal(limpo);
      setAmbientesGlobais(await lerAmbientesGlobais());
      setNovoAmbiente('');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setAmbienteOcupado(null);
    }
  }

  async function removerAmbiente(nome: string) {
    setAmbienteOcupado(nome);
    try {
      await removerAmbienteGlobal(nome);
      setAmbientesGlobais((prev) => prev.filter((a) => a !== nome));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setAmbienteOcupado(null);
    }
  }

  /** Move um slide uma posição pra cima/baixo na lista — grava a nova ordem inteira (mais simples e confiável que arrastar). */
  async function moverSlide(id: string, direcao: -1 | 1) {
    const i = progresso.findIndex((p) => p.id === id);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= progresso.length) return;
    const novaOrdem = [...progresso];
    [novaOrdem[i], novaOrdem[j]] = [novaOrdem[j]!, novaOrdem[i]!];
    setProgresso(novaOrdem);
    setOrdemOcupada(true);
    try {
      await reordenarProgresso(novaOrdem.map((p) => p.id));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOrdemOcupada(false);
    }
  }

  async function salvarEquipamentos(novos: Equipamento[]) {
    setEquipamentos(novos);
    let alvo = estrutura;
    if (!alvo) alvo = await criarOuAtualizarCabecalho();
    if (!alvo) return;
    try {
      setEstrutura(await atualizarEquipamentos(alvo.id, novos));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  /** Infraestrutura: cada ponto vira 1 slide (antes+depois). Sem os dois, fica em rascunho local até completar o par. */
  async function definirFotoPonto(equipNome: string, numero: string, local: string, lado: 'antes' | 'depois', file: File) {
    if (!estrutura) return;
    const chave = `${equipNome}|${numero}`;
    setFotoOcupada(chave + lado);
    try {
      const caminho = await uploadFotoRelatorio(estrutura.id, [equipNome, numero], file);
      const existente = progresso.find((p) => p.equipamento === equipNome && p.numero_ponto === numero);
      if (existente) {
        const atualizado = await atualizarProgresso(existente.id, lado === 'antes' ? { foto_antes_path: caminho } : { foto_depois_path: caminho });
        setProgresso((prev) => prev.map((p) => (p.id === atualizado.id ? atualizado : p)));
        return;
      }
      const rascunho = { ...rascunhosFotoRef.current[chave], [lado]: caminho };
      rascunhosFotoRef.current[chave] = rascunho;
      if (rascunho.antes && rascunho.depois) {
        const novo = await criarProgresso(estrutura.id, {
          equipamento: equipNome,
          numeroPonto: numero,
          local,
          etapa1: 'ANTES',
          fotoAntesPath: rascunho.antes,
          fotoDepoisPath: rascunho.depois,
        });
        delete rascunhosFotoRef.current[chave];
        setProgresso((prev) => [...prev, novo]);
      } else {
        forcarAtualizacao((n) => n + 1);
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setFotoOcupada(null);
    }
  }

  /** Reforma: slide completo (antes/durante + depois) é montado no formulário e salvo de uma vez. */
  async function salvarNovoSlideReforma() {
    if (!estrutura || !novoSlideServico || !novoSlideAntes || !novoSlideDepois) return;
    setFotoOcupada('novo-slide');
    try {
      const [caminhoAntes, caminhoDepois] = await Promise.all([
        uploadFotoRelatorio(estrutura.id, [novoSlideServico, novoSlideEtapa], novoSlideAntes),
        uploadFotoRelatorio(estrutura.id, [novoSlideServico, 'DEPOIS'], novoSlideDepois),
      ]);
      const novo = await criarProgresso(estrutura.id, {
        servico: novoSlideServico,
        ambiente: novoSlideAmbiente.trim() || null,
        etapa1: novoSlideEtapa,
        fotoAntesPath: caminhoAntes,
        fotoDepoisPath: caminhoDepois,
      });
      setProgresso((prev) => [...prev, novo]);
      setNovoSlideServico(null);
      setNovoSlideAmbiente('');
      setNovoSlideEtapa('ANTES');
      setNovoSlideAntes(null);
      setNovoSlideDepois(null);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setFotoOcupada(null);
    }
  }

  async function removerSlide(id: string) {
    setFotoOcupada('remover-' + id);
    try {
      await excluirProgresso(id);
      setProgresso((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setFotoOcupada(null);
    }
  }

  const secao = 'bg-card border border-card-border rounded-xl p-4 space-y-4 shadow-sm';
  const tituloSecao =
    'text-xs font-bold text-brand-ocre flex items-center gap-2 border-b border-card-border pb-2 uppercase tracking-wider font-vomzom';
  const badge = (n: number, feito?: boolean) => (
    <span
      className={`flex items-center justify-center h-5 w-5 rounded-md font-black text-[10px] ${
        feito ? 'bg-emerald-500/15 text-emerald-600' : 'bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue'
      }`}
    >
      {feito ? <Check size={12} /> : n}
    </span>
  );
  const label = 'text-[10px] font-bold text-desc uppercase tracking-wider text-brand-ocre';
  const input =
    'w-full px-3 py-2 bg-background border border-card-border rounded-lg text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-ocre focus:ring-1 focus:ring-brand-ocre transition-all font-bold';
  const inputSomenteLeitura =
    'w-full px-3 py-2 bg-slate-100 dark:bg-zinc-800/70 border border-card-border/80 rounded-lg text-xs text-main font-semibold cursor-not-allowed opacity-90 transition-all';

  const somenteLeituraObra = !isAvulso && !habilitarEdicaoObra;
  const classeCampoObra = somenteLeituraObra ? inputSomenteLeitura : input;

  return (
    <div className="space-y-6 pb-16">
      <div className="border-b border-card-border pb-5">
        <h2 className="text-2xl font-extrabold tracking-tight text-main capitalize font-vomzom">
          Relatório fotográfico
        </h2>
        <p className="text-sub text-sm mt-1">
          Estrutura a obra e monta o PowerPoint no padrão do banco, com fotos antes/depois numeradas.
        </p>
      </div>

      {erro && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold rounded-lg p-3">{erro}</div>
      )}

      {modalBuscaAberto && <ModalBuscaProjetos onSelecionar={selecionarProjeto} onFechar={() => setModalBuscaAberto(false)} />}

      {/* resumo compacto — some com o "abre só o item 4": depois de iniciado o
          relatório, projeto e tipo já estão resolvidos, então recolhem aqui e
          dão lugar pra continuação (dados do relatório + equipamentos/serviços) */}
      {estrutura && !resumoExpandido && (
        <div className="bg-card border border-card-border rounded-xl p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex items-center justify-center h-7 w-7 rounded-md bg-emerald-500/10 text-emerald-600 shrink-0">
              <Check size={14} />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-main truncate">
                {isAvulso ? obraNome : projetoSelecionado?.nome}
                <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-desc">
                  {tipoProjeto === 'infraestrutura' ? 'Infraestrutura' : 'Reforma'}
                </span>
              </div>
              <div className="text-[10px] text-sub truncate">
                {isAvulso ? 'Relatório avulso' : `OS ${projetoSelecionado?.os ?? ''}`}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setResumoExpandido(true)}
            className="text-[10px] font-bold text-brand-blue hover:underline whitespace-nowrap shrink-0"
          >
            Editar
          </button>
        </div>
      )}

      {(!estrutura || resumoExpandido) && (
        <>
      {/* 1 — vínculo com projeto ou avulso */}
      <div className={secao}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border pb-2">
          <div className="flex items-center gap-4">
            <h3 className="text-xs font-bold text-brand-ocre flex items-center gap-2 uppercase tracking-wider font-vomzom">
              {badge(1, podeCriar)} Projeto
            </h3>
            <label className="flex items-center gap-2 text-[11px] font-semibold text-sub hover:text-brand-ocre transition-colors cursor-pointer select-none bg-background border border-card-border/80 rounded-full pl-2.5 pr-3 py-1">
              <input
                type="checkbox"
                className="w-3.5 h-3.5 rounded text-brand-ocre focus:ring-brand-ocre border-card-border cursor-pointer accent-brand-ocre"
                checked={isAvulso}
                onChange={(e) => {
                  setIsAvulso(e.target.checked);
                  setEstrutura(null);
                  setProjetoSelecionado(null);
                  setHabilitarEdicaoObra(false);
                  setResumoExpandido(true);
                }}
              />
              <span>
                Relatório avulso <span className="font-normal text-desc">(obra de terceiro, sem vínculo)</span>
              </span>
            </label>
          </div>
        </div>

        {!isAvulso ? (
          projetoSelecionado ? (
            <div className="flex items-center justify-between gap-2 bg-background border border-card-border rounded-lg px-3 py-2.5">
              <div>
                <div className="text-xs font-bold text-main">{projetoSelecionado.nome}</div>
                <div className="text-[10px] text-sub">
                  OS {projetoSelecionado.os} {projetoSelecionado.cliente_final_nome ? '· ' + projetoSelecionado.cliente_final_nome : ''}
                </div>
              </div>
              <button type="button" onClick={trocarProjeto} className="text-[10px] font-bold text-brand-blue hover:underline whitespace-nowrap">
                Trocar projeto
              </button>
            </div>
          ) : (
            <div className="space-y-1 relative">
              <label className={label}>Projeto / Obra *</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-desc pointer-events-none" />
                  <input
                    type="text"
                    value={projetoBusca}
                    onChange={(e) => {
                      setProjetoBusca(e.target.value);
                      setMostrarSugestoes(true);
                    }}
                    onFocus={() => setMostrarSugestoes(true)}
                    onBlur={() => setTimeout(() => setMostrarSugestoes(false), 200)}
                    className={input + ' pl-8'}
                    placeholder="Busque pelo nome, OS ou cliente..."
                  />
                  {mostrarSugestoes && (buscandoProjetos || projetosSugeridos.length > 0) && (
                    <div className="absolute z-40 w-full mt-1 bg-card border border-card-border rounded-lg shadow-xl max-h-64 overflow-y-auto">
                      {buscandoProjetos && <div className="px-3 py-2 text-xs text-sub">Buscando…</div>}
                      {projetosSugeridos.map((p) => (
                        <div
                          key={p.id}
                          className="px-3 py-2.5 text-xs text-main hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer border-b border-card-border/50 last:border-0"
                          onClick={() => selecionarProjeto(p)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold">{p.nome}</span>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-brand-ocre bg-brand-ocre/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              {STATUS_LABEL[p.status] || p.status}
                            </span>
                          </div>
                          <div className="text-[10px] text-sub">
                            OS {p.os} · {p.tipologia} {p.cliente_final_nome ? '· ' + p.cliente_final_nome : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setModalBuscaAberto(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-card-border bg-background text-xs font-bold text-brand-blue hover:bg-brand-blue/10 hover:border-brand-blue/40 whitespace-nowrap transition-colors"
                >
                  <List size={13} />
                  Ver todos
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-1">
            <label className={label}>Nome da obra *</label>
            <input
              type="text"
              value={obraNome}
              onChange={(e) => setObraNome(e.target.value)}
              className={input}
              placeholder="ex.: Agência 8585 - Botafogo RJ"
            />
          </div>
        )}
      </div>

      {/* 2 — tipo de projeto */}
      <div className={secao}>
        <h3 className={tituloSecao}>{badge(2)} Tipo de projeto</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setTipoProjeto('infraestrutura')}
            className={`text-left p-5 rounded-xl border-2 transition-all ${tipoProjeto === 'infraestrutura' ? 'border-brand-ocre bg-brand-ocre/10 shadow-sm' : 'border-card-border bg-background hover:border-brand-ocre/40'}`}
          >
            <div className="w-11 h-11 rounded-lg bg-brand-ocre/10 border border-brand-ocre/30 flex items-center justify-center mb-3">
              <Ruler size={20} className="text-brand-ocre" />
            </div>
            <div className="font-bold text-sm text-main">Infraestrutura</div>
            <p className="text-xs text-sub mt-1">Equipamento → pontos numerados. Um slide por ponto.</p>
          </button>
          <button
            type="button"
            onClick={() => setTipoProjeto('reforma')}
            className={`text-left p-5 rounded-xl border-2 transition-all ${tipoProjeto === 'reforma' ? 'border-brand-blue bg-brand-blue/10 shadow-sm' : 'border-card-border bg-background hover:border-brand-blue/40'}`}
          >
            <div className="w-11 h-11 rounded-lg bg-brand-blue/10 border border-brand-blue/30 flex items-center justify-center mb-3">
              <Building2 size={20} className="text-brand-blue" />
            </div>
            <div className="font-bold text-sm text-main">Reforma</div>
            <p className="text-xs text-sub mt-1">Serviço → antes, durante e depois. Várias fotos por etapa.</p>
          </button>
        </div>
      </div>
        </>
      )}

      {/* 3 — dados de cabeçalho */}
      <div className={secao}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border pb-2">
          <h3 className="text-xs font-bold text-brand-ocre flex items-center gap-2 uppercase tracking-wider font-vomzom">
            {badge(3, !!estrutura && pendencias.length === 0)} Dados do relatório
          </h3>
        </div>

        {/* Legenda importante e controle de edição para projeto vinculado */}
        {!isAvulso && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2.5 text-xs font-bold text-amber-800 dark:text-amber-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-400 cursor-pointer accent-amber-600"
                  checked={habilitarEdicaoObra}
                  disabled={!projetoSelecionado}
                  onChange={(e) => setHabilitarEdicaoObra(e.target.checked)}
                />
                <span>Habilitar edição dos dados cadastrais da obra</span>
              </label>
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md ${
                  habilitarEdicaoObra
                    ? 'bg-amber-500 text-brand-dark font-black'
                    : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                }`}
              >
                {habilitarEdicaoObra ? 'Modo Edição Ativo' : 'Somente Leitura'}
              </span>
            </div>
            <p className="text-[11px] text-amber-900/90 dark:text-amber-200/90 font-medium leading-relaxed">
              ⚠️ <strong>Importante:</strong> Estes dados pertencem ao cadastro da obra no AprimoreERP. Qualquer alteração salva aqui será aplicada diretamente a todo o projeto no sistema.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className={label}>Banco</label>
            <select value={banco} onChange={(e) => setBanco(e.target.value)} className={input}>
              <option value="">Selecione o banco…</option>
              {bancosCatalogo.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={label}>Modelo de relatório</label>
            <select value={modeloRelatorio} onChange={(e) => setModeloRelatorio(e.target.value)} disabled={!banco} className={input}>
              <option value="">{banco ? 'Selecione o modelo…' : 'Escolha o banco primeiro'}</option>
              {modelosFiltrados.map((m) => (
                <option key={m.id} value={m.nome}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={label}>Agência</label>
            <input
              type="text"
              value={agencia}
              onChange={(e) => setAgencia(e.target.value)}
              readOnly={somenteLeituraObra}
              disabled={!isAvulso && !projetoSelecionado}
              className={classeCampoObra}
              placeholder="ex.: 8647PERSONNALITE RJ-CAMPOS"
            />
          </div>
          <div className="space-y-1">
            <label className={label}>Programa</label>
            <input
              type="text"
              value={programa}
              onChange={(e) => setPrograma(e.target.value)}
              readOnly={somenteLeituraObra}
              disabled={!isAvulso && !projetoSelecionado}
              className={classeCampoObra}
            />
          </div>
          <div className="space-y-1">
            <label className={label}>Cód UPE</label>
            <input
              type="text"
              value={upe}
              onChange={(e) => setUpe(e.target.value)}
              readOnly={somenteLeituraObra}
              disabled={!isAvulso && !projetoSelecionado}
              className={classeCampoObra}
            />
          </div>
          <div className="space-y-1">
            <label className={label}>Cód SAP</label>
            <input
              type="text"
              value={sap}
              onChange={(e) => setSap(e.target.value)}
              readOnly={somenteLeituraObra}
              disabled={!isAvulso && !projetoSelecionado}
              className={classeCampoObra}
            />
          </div>
          <div className="space-y-1">
            <label className={label}>Gestor de obras</label>
            <input
              type="text"
              value={gestor}
              onChange={(e) => setGestor(e.target.value)}
              readOnly={somenteLeituraObra}
              disabled={!isAvulso && !projetoSelecionado}
              className={classeCampoObra}
            />
          </div>
          <div className="space-y-1">
            <label className={label}>Fiscalização — empresa</label>
            <input
              type="text"
              value={fiscEmpresa}
              onChange={(e) => setFiscEmpresa(e.target.value)}
              readOnly={somenteLeituraObra}
              disabled={!isAvulso && !projetoSelecionado}
              className={classeCampoObra}
            />
          </div>
          <div className="space-y-1">
            <label className={label}>Fiscal</label>
            <input
              type="text"
              value={fiscal}
              onChange={(e) => setFiscal(e.target.value)}
              readOnly={somenteLeituraObra}
              disabled={!isAvulso && !projetoSelecionado}
              className={classeCampoObra}
            />
          </div>
          <div className="space-y-1">
            <label className={label}>Construtora — empresa</label>
            <input
              type="text"
              value={construtora}
              onChange={(e) => setConstrutora(e.target.value)}
              readOnly={somenteLeituraObra}
              disabled={!isAvulso && !projetoSelecionado}
              className={classeCampoObra}
              placeholder="ex.: EGF CONSTRUTORA"
            />
          </div>
          <div className="space-y-1">
            <label className={label}>Responsável</label>
            <input
              type="text"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              readOnly={somenteLeituraObra}
              disabled={!isAvulso && !projetoSelecionado}
              className={classeCampoObra}
            />
          </div>

          <div className="space-y-1">
            <label className={label}>Início da obra (Efetivo)</label>
            <input
              type={isAvulso || habilitarEdicaoObra ? "date" : "text"}
              value={
                isAvulso || habilitarEdicaoObra
                  ? dataInicioObra
                  : (dataInicioObra ? formatarData(dataInicioObra) : 'Ainda não iniciado')
              }
              onChange={(e) => setDataInicioObra(e.target.value)}
              readOnly={somenteLeituraObra}
              disabled={!isAvulso && !projetoSelecionado}
              className={classeCampoObra}
              placeholder="Não informado"
            />
            {!isAvulso && !dataInicioObra && projetoSelecionado?.data_prevista_inicio && (
              <p className="text-[10px] text-sub">Previsto: {formatarData(projetoSelecionado.data_prevista_inicio)}</p>
            )}
          </div>
          <div className="space-y-1">
            <label className={label}>Término da obra (Efetivo)</label>
            <input
              type={isAvulso || habilitarEdicaoObra ? "date" : "text"}
              value={
                isAvulso || habilitarEdicaoObra
                  ? dataTerminoObra
                  : (dataTerminoObra ? formatarData(dataTerminoObra) : 'Ainda não concluído')
              }
              onChange={(e) => setDataTerminoObra(e.target.value)}
              readOnly={somenteLeituraObra}
              disabled={!isAvulso && !projetoSelecionado}
              className={classeCampoObra}
              placeholder="Não informado"
            />
            {!isAvulso && !dataTerminoObra && projetoSelecionado?.data_prevista_termino && (
              <p className="text-[10px] text-sub">Previsto: {formatarData(projetoSelecionado.data_prevista_termino)}</p>
            )}
          </div>
        </div>
        {projetoSelecionado && (
          <p className="text-[10px] text-sub">
            Estas são as datas <strong>efetivas</strong> do cadastro do projeto — se ainda não foram lançadas lá,
            aparecem vazias aqui (e como pendência abaixo). Habilite a edição acima pra lançar direto por aqui.
          </p>
        )}

        <button
          type="button"
          disabled={!podeCriar || salvando}
          onClick={criarOuAtualizarCabecalho}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-ocre text-white text-xs font-bold disabled:opacity-40"
        >
          {salvando ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
          {estrutura ? 'Salvar dados' : 'Iniciar relatório'}
        </button>
      </div>

      {/* continuação após "Iniciar relatório" — dados de apoio (serviços/ambientes/
          equipamentos) à esquerda, slides já criados numa coluna fixa à direita
          (como um painel de miniaturas do PowerPoint) — mostra a sequência real
          em vez de deixar tudo empilhado e sem preview */}
      <div ref={proximaEtapaRef} className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-6 min-w-0">
      {estrutura && pendencias.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200">
            <strong className="font-bold">Pendências nos dados do relatório:</strong> {pendencias.join(', ')}.
            <span className="block mt-1 text-[11px] opacity-90 font-medium">
              Pode continuar preenchendo abaixo — mas o PowerPoint só poderá ser montado depois que esses campos
              estiverem completos.
            </span>
          </div>
        </div>
      )}

      {/* Ambientes — catálogo global, reaproveitado em qualquer relatório futuro */}
      {estrutura && tipoProjeto === 'reforma' && (
        <div className={secao}>
          <h3 className={tituloSecao}>Ambientes</h3>
          <p className="text-[10px] text-sub">
            Lista global — um ambiente criado aqui já fica disponível pra qualquer relatório futuro, não só este.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={novoAmbiente}
              onChange={(e) => setNovoAmbiente(e.target.value.toUpperCase())}
              className={input}
              placeholder="Nome de um ambiente novo"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && novoAmbiente.trim()) criarAmbiente(novoAmbiente);
              }}
            />
            <button
              type="button"
              disabled={!novoAmbiente.trim()}
              onClick={() => criarAmbiente(novoAmbiente)}
              className="px-3 py-2 rounded-lg border border-card-border text-xs font-bold text-main disabled:opacity-40 whitespace-nowrap"
            >
              + adicionar
            </button>
          </div>
          {ambientesGlobais.length === 0 ? (
            <p className="text-[10px] text-sub italic">Nenhum ambiente cadastrado ainda.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ambientesGlobais.map((a) => (
                <div
                  key={a}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border border-card-border bg-background text-xs font-bold text-main"
                  style={{ opacity: ambienteOcupado === a ? 0.5 : 1 }}
                >
                  <span className="truncate">{a}</span>
                  <button
                    type="button"
                    disabled={ambienteOcupado === a}
                    onClick={() => removerAmbiente(a)}
                    className="text-desc hover:text-red-500 shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4 — serviços (reforma) */}
      {estrutura && tipoProjeto === 'reforma' && (
        <div className={secao}>
          <h3 className={tituloSecao}>{badge(4)} Serviços</h3>
          <p className="text-[10px] text-sub">
            Selecione um serviço já conhecido pra habilitar nesta obra, ou crie um novo — nos dois casos ele já sai
            habilitado, pronto pra receber slides.
          </p>

          <div className="flex flex-wrap gap-2 items-center">
            {servicosGlobais.filter((s) => !estrutura.servicos_habilitados.includes(s)).length > 0 && (
              <>
                <select
                  value={servicoDisponivelEscolhido}
                  onChange={(e) => setServicoDisponivelEscolhido(e.target.value)}
                  className={input + ' w-auto min-w-[200px]'}
                >
                  <option value="">Serviço conhecido, ainda não habilitado…</option>
                  {servicosGlobais
                    .filter((s) => !estrutura.servicos_habilitados.includes(s))
                    .map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!servicoDisponivelEscolhido || servicoOcupado === servicoDisponivelEscolhido}
                  onClick={() => {
                    habilitarServicoAqui(servicoDisponivelEscolhido);
                    setServicoDisponivelEscolhido('');
                  }}
                  className="px-3 py-2 rounded-lg border border-card-border text-xs font-bold text-main disabled:opacity-40 whitespace-nowrap"
                >
                  habilitar aqui
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={novoServico}
              onChange={(e) => setNovoServico(e.target.value.toUpperCase())}
              className={input}
              placeholder="Nome de um serviço novo"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && novoServico.trim()) habilitarServicoAqui(novoServico);
              }}
            />
            <button
              type="button"
              disabled={!novoServico.trim()}
              onClick={() => habilitarServicoAqui(novoServico)}
              className="px-3 py-2 rounded-lg border border-card-border text-xs font-bold text-main disabled:opacity-40 whitespace-nowrap"
            >
              criar e habilitar
            </button>
          </div>

          {estrutura.servicos_habilitados.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-card-border">
              {estrutura.servicos_habilitados.map((nome) => (
                <div
                  key={nome}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-brand-ocre/40 bg-brand-ocre/10 text-xs font-bold text-main"
                  style={{ opacity: servicoOcupado === nome ? 0.5 : 1 }}
                >
                  {nome}
                  <button
                    type="button"
                    disabled={servicoOcupado === nome}
                    onClick={() => desabilitarServicoAqui(nome)}
                    title="Desabilitar (não apaga o catálogo global)"
                    className="text-brand-ocre/70 hover:text-red-500"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {estrutura.servicos_habilitados.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-card-border">
              {estrutura.servicos_habilitados.map((servico) => {
                return (
                  <div key={servico} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-main uppercase tracking-wide">{servico}</span>
                      {novoSlideServico !== servico && (
                        <button
                          type="button"
                          onClick={() => setNovoSlideServico(servico)}
                          className="text-[10px] font-bold text-brand-blue hover:underline"
                        >
                          + novo slide
                        </button>
                      )}
                    </div>

                    {novoSlideServico === servico && (
                      <div className="bg-background border border-card-border rounded-lg p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={novoSlideEtapa}
                            onChange={(e) => setNovoSlideEtapa(e.target.value as 'ANTES' | 'DURANTE')}
                            className={input}
                          >
                            <option value="ANTES">Antes</option>
                            <option value="DURANTE">Durante</option>
                          </select>
                          <select value={novoSlideAmbiente} onChange={(e) => setNovoSlideAmbiente(e.target.value)} className={input}>
                            <option value="">Ambiente (opcional)</option>
                            {ambientesGlobais.map((a) => (
                              <option key={a} value={a}>
                                {a}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <SlotFoto
                            rotulo={novoSlideEtapa === 'ANTES' ? 'Antes' : 'Durante'}
                            caminho={null}
                            ocupado={fotoOcupada === 'novo-slide'}
                            onSelecionar={setNovoSlideAntes}
                          />
                          {novoSlideAntes && <span className="text-[10px] text-emerald-600 font-bold">{novoSlideAntes.name}</span>}
                          <SlotFoto rotulo="Depois" caminho={null} ocupado={fotoOcupada === 'novo-slide'} onSelecionar={setNovoSlideDepois} />
                          {novoSlideDepois && <span className="text-[10px] text-emerald-600 font-bold">{novoSlideDepois.name}</span>}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={!novoSlideAntes || !novoSlideDepois || fotoOcupada === 'novo-slide'}
                            onClick={salvarNovoSlideReforma}
                            className="px-3 py-1.5 rounded-lg bg-brand-ocre text-white text-[10px] font-bold disabled:opacity-40"
                          >
                            {fotoOcupada === 'novo-slide' ? 'Enviando…' : 'Salvar slide'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNovoSlideServico(null);
                              setNovoSlideAntes(null);
                              setNovoSlideDepois(null);
                              setNovoSlideAmbiente('');
                            }}
                            className="px-3 py-1.5 rounded-lg border border-card-border text-[10px] font-bold text-sub"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4 — equipamentos e pontos (infraestrutura) */}
      {estrutura && tipoProjeto === 'infraestrutura' && (
        <div className={secao}>
          <h3 className={tituloSecao}>{badge(4)} Equipamentos e pontos</h3>
          {equipamentos.map((eq, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={eq.nome}
                onChange={(e) =>
                  salvarEquipamentos(equipamentos.map((x, j) => (j === i ? { ...x, nome: e.target.value.toUpperCase() } : x)))
                }
                className={input}
                placeholder="ex.: Sensor de Presença"
              />
              <input
                type="number"
                min={0}
                max={999}
                value={eq.pontos.length}
                onChange={(e) =>
                  salvarEquipamentos(
                    equipamentos.map((x, j) => (j === i ? { ...x, pontos: ajustaPontos(x.pontos, parseInt(e.target.value || '0', 10)) } : x)),
                  )
                }
                className={input + ' w-24'}
              />
              <button type="button" onClick={() => salvarEquipamentos(equipamentos.filter((_, j) => j !== i))} className="text-red-500 text-xs font-bold px-2">
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => salvarEquipamentos([...equipamentos, { nome: '', pontos: [] }])}
            className="px-3 py-2 rounded-lg border border-card-border text-xs font-bold text-main"
          >
            Adicionar equipamento
          </button>

          {equipamentos
            .filter((eq) => eq.nome.trim() && eq.pontos.length)
            .map((eq, iEq) => (
              <div key={iEq} className="border border-card-border rounded-lg overflow-hidden mt-2">
                <div className="bg-background px-3 py-2 text-xs font-bold text-main">
                  {eq.nome} — {eq.pontos.length} {eq.pontos.length === 1 ? 'ponto' : 'pontos'}
                </div>
                <div className="p-3 space-y-2">
                  {eq.pontos.map((p, iP) => {
                    const chave = `${eq.nome}|${p.numero}`;
                    const slide = progresso.find((pr) => pr.equipamento === eq.nome && pr.numero_ponto === p.numero);
                    const rascunho = rascunhosFotoRef.current[chave];
                    return (
                      <div key={iP} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-card-border/40 rounded px-2 py-1">{p.numero}</span>
                        <input
                          type="text"
                          value={p.local}
                          onChange={(e) => {
                            const novos = equipamentos.map((x) =>
                              x.nome === eq.nome ? { ...x, pontos: x.pontos.map((pp, k) => (k === iP ? { ...pp, local: e.target.value } : pp)) } : x,
                            );
                            salvarEquipamentos(novos);
                          }}
                          className={input}
                          placeholder="Local — ex.: Salão, Tesouraria"
                        />
                        <SlotFoto
                          rotulo="Antes"
                          caminho={slide?.foto_antes_path ?? rascunho?.antes}
                          ocupado={fotoOcupada === chave + 'antes'}
                          onSelecionar={(file) => definirFotoPonto(eq.nome, p.numero, p.local, 'antes', file)}
                        />
                        <SlotFoto
                          rotulo="Depois"
                          caminho={slide?.foto_depois_path ?? rascunho?.depois}
                          ocupado={fotoOcupada === chave + 'depois'}
                          onSelecionar={(file) => definirFotoPonto(eq.nome, p.numero, p.local, 'depois', file)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
      </div>

      {/* coluna direita — miniaturas dos slides já criados, empilhadas, na
          ordem final do PowerPoint; clicar amplia (mesma ideia de painel de
          slides do próprio PowerPoint / preview de arquivo) */}
      {estrutura && (
        <div className="lg:sticky lg:top-4 space-y-3">
          <div className={secao}>
            <h3 className={tituloSecao}>
              Slides {progresso.length > 0 && <span className="text-desc normal-case font-semibold">({progresso.length})</span>}
            </h3>
            {progresso.length === 0 ? (
              <p className="text-[10px] text-sub italic">
                Nenhum slide ainda — as fotos que você enviar aparecem aqui, empilhadas na ordem final do PowerPoint.
              </p>
            ) : (
              <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-1 -mr-1">
                {progresso.map((s, i) => (
                  <div key={s.id} className="flex gap-2 border border-card-border rounded-lg p-2 bg-background">
                    <button
                      type="button"
                      onClick={() => setPreviaIndice(i)}
                      title="Ampliar slide"
                      className="flex gap-1 shrink-0 cursor-zoom-in rounded overflow-hidden"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={urlPublicaFoto(s.foto_antes_path)} alt="" className="w-10 h-10 object-cover" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={urlPublicaFoto(s.foto_depois_path)} alt="" className="w-10 h-10 object-cover" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-main truncate">
                        {i + 1}. {legendaSlide(s)}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <button
                          type="button"
                          disabled={i === 0 || ordemOcupada}
                          onClick={() => moverSlide(s.id, -1)}
                          className="text-desc hover:text-main disabled:opacity-30"
                          title="Mover pra cima"
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={i === progresso.length - 1 || ordemOcupada}
                          onClick={() => moverSlide(s.id, 1)}
                          className="text-desc hover:text-main disabled:opacity-30"
                          title="Mover pra baixo"
                        >
                          <ChevronDown size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={fotoOcupada === 'remover-' + s.id}
                          onClick={() => removerSlide(s.id)}
                          className="ml-auto text-desc hover:text-red-500 disabled:opacity-30"
                          title="Remover slide"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {previaIndice !== null && progresso[previaIndice] && (
        <ModalPreviaSlide slide={progresso[previaIndice]!} indice={previaIndice} onFechar={() => setPreviaIndice(null)} />
      )}
    </div>
  );
}

export default function RelatorioFotograficoPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-desc">Carregando relatório fotográfico...</div>}>
      <RelatorioFotograficoContent />
    </Suspense>
  );
}
