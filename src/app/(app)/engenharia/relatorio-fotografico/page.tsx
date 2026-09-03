'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Building2, Check, Loader2, Ruler, Search, X } from 'lucide-react';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  atualizarCamposProjeto,
  atualizarEquipamentos,
  atualizarEstrutura,
  buscarProjetoPorId,
  buscarProjetos,
  buscarProjetosComFiltros,
  criarEstrutura,
  desabilitarServico,
  habilitarServico,
  lerBancosCatalogo,
  lerModelosPorBanco,
  lerServicosGlobais,
  listarClientesFinaisUsados,
  obterEstruturaPorProjeto,
} from '@/modules/engenharia/relatorio-fotografico/services/apiRelatorioFotografico';
import { limpaNome, pad } from '@/modules/engenharia/relatorio-fotografico/calc';
import type {
  Equipamento,
  EstruturaFotografica,
  ModeloRelatorioOpcao,
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

  const [estrutura, setEstrutura] = useState<EstruturaFotografica | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // passo 4 — equipamentos (infra) / serviços (reforma)
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [servicosGlobais, setServicosGlobais] = useState<string[]>([]);
  const [novoServico, setNovoServico] = useState('');
  const [servicoOcupado, setServicoOcupado] = useState<string | null>(null);

  useEffect(() => {
    lerServicosGlobais().then(setServicosGlobais).catch(() => {});
    lerBancosCatalogo().then(setBancosCatalogo).catch(() => {});
  }, []);

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

  // se o modelo selecionado deixar de valer (trocou banco/tipo), limpa
  useEffect(() => {
    if (modeloRelatorio && !modelosFiltrados.some((m) => m.nome === modeloRelatorio)) {
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

  // datas: vinculado -> vem do projeto (efetiva, com fallback pra prevista); avulso -> campo próprio
  const inicioExibido = projetoSelecionado ? projetoSelecionado.data_efetiva_inicio || projetoSelecionado.data_prevista_inicio : null;
  const terminoExibido = projetoSelecionado ? projetoSelecionado.data_efetiva_termino || projetoSelecionado.data_prevista_termino : null;

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
        if (!isAvulso) {
          await atualizarCamposProjeto(projetoSelecionado!.id, {
            agencia: agencia || null,
            upe: upe || null,
            sap: sap || null,
            gestor: gestor || null,
            fiscalizacao_empresa: fiscEmpresa || null,
            fiscal: fiscal || null,
            construtora: construtora || null,
            responsavel: responsavel || null,
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
      if (!isAvulso && projetoSelecionado) {
        await atualizarCamposProjeto(projetoSelecionado.id, {
          agencia: agencia || null,
          upe: upe || null,
          sap: sap || null,
          gestor: gestor || null,
          fiscalizacao_empresa: fiscEmpresa || null,
          fiscal: fiscal || null,
          construtora: construtora || null,
          responsavel: responsavel || null,
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

  const secao = 'bg-card border border-card-border rounded-xl p-4 space-y-4 shadow-sm';
  const tituloSecao =
    'text-xs font-bold text-brand-ocre flex items-center gap-2 border-b border-card-border pb-2 uppercase tracking-wider font-vomzom';
  const badge = (n: number) => (
    <span className="flex items-center justify-center h-5 w-5 rounded-md bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue font-black text-[10px]">
      {n}
    </span>
  );
  const label = 'text-[10px] font-bold text-desc uppercase tracking-wider text-brand-ocre';
  const input =
    'w-full px-3 py-2 bg-background border border-card-border rounded-lg text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-ocre focus:ring-1 focus:ring-brand-ocre transition-all font-bold';
  const inputSomenteLeitura = 'w-full px-3 py-2 bg-card-border/20 border border-card-border rounded-lg text-xs text-desc font-bold';

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

      {/* 1 — vínculo com projeto ou avulso */}
      <div className={secao}>
        <div className="flex items-center justify-between gap-2 border-b border-card-border pb-2">
          <h3 className="text-xs font-bold text-brand-ocre flex items-center gap-2 uppercase tracking-wider font-vomzom">
            {badge(1)} Projeto
          </h3>
          <label className="flex items-center gap-1.5 text-[10px] text-desc cursor-pointer select-none">
            <input
              type="checkbox"
              className="scale-90"
              checked={isAvulso}
              onChange={(e) => {
                setIsAvulso(e.target.checked);
                setEstrutura(null);
                setProjetoSelecionado(null);
              }}
            />
            Relatório avulso (obra de terceiro, sem vínculo)
          </label>
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
                  className="px-3 py-2 rounded-lg border border-card-border text-xs font-bold text-main hover:bg-slate-100 dark:hover:bg-zinc-800 whitespace-nowrap"
                >
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

      {/* 3 — dados de cabeçalho */}
      <div className={secao}>
        <h3 className={tituloSecao}>{badge(3)} Dados do relatório</h3>
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
            <input type="text" value={agencia} onChange={(e) => setAgencia(e.target.value)} className={input} placeholder="ex.: 8647PERSONNALITE RJ-CAMPOS" />
          </div>
          <div className="space-y-1">
            <label className={label}>Programa</label>
            <input type="text" value={programa} onChange={(e) => setPrograma(e.target.value)} className={input} />
          </div>
          <div className="space-y-1">
            <label className={label}>Cód UPE</label>
            <input type="text" value={upe} onChange={(e) => setUpe(e.target.value)} className={input} />
          </div>
          <div className="space-y-1">
            <label className={label}>Cód SAP</label>
            <input type="text" value={sap} onChange={(e) => setSap(e.target.value)} className={input} />
          </div>
          <div className="space-y-1">
            <label className={label}>Gestor de obras</label>
            <input type="text" value={gestor} onChange={(e) => setGestor(e.target.value)} className={input} />
          </div>
          <div className="space-y-1">
            <label className={label}>Fiscalização — empresa</label>
            <input type="text" value={fiscEmpresa} onChange={(e) => setFiscEmpresa(e.target.value)} className={input} />
          </div>
          <div className="space-y-1">
            <label className={label}>Fiscal</label>
            <input type="text" value={fiscal} onChange={(e) => setFiscal(e.target.value)} className={input} />
          </div>
          <div className="space-y-1">
            <label className={label}>Construtora — empresa</label>
            <input type="text" value={construtora} onChange={(e) => setConstrutora(e.target.value)} className={input} placeholder="ex.: EGF CONSTRUTORA" />
          </div>
          <div className="space-y-1">
            <label className={label}>Responsável</label>
            <input type="text" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={input} />
          </div>

          {isAvulso ? (
            <>
              <div className="space-y-1">
                <label className={label}>Início da obra</label>
                <input type="date" value={dataInicioObra} onChange={(e) => setDataInicioObra(e.target.value)} className={input} />
              </div>
              <div className="space-y-1">
                <label className={label}>Término da obra</label>
                <input type="date" value={dataTerminoObra} onChange={(e) => setDataTerminoObra(e.target.value)} className={input} />
              </div>
            </>
          ) : (
            projetoSelecionado && (
              <>
                <div className="space-y-1">
                  <label className={label}>Início da obra</label>
                  <input type="text" readOnly value={formatarData(inicioExibido)} className={inputSomenteLeitura} />
                </div>
                <div className="space-y-1">
                  <label className={label}>Término da obra</label>
                  <input type="text" readOnly value={formatarData(terminoExibido)} className={inputSomenteLeitura} />
                </div>
              </>
            )
          )}
        </div>
        {projetoSelecionado && (
          <p className="text-[10px] text-sub">Datas vêm do cadastro do projeto (efetiva, ou prevista se ainda não iniciou) — edite lá se precisar mudar.</p>
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

      {/* 4 — serviços (reforma) */}
      {estrutura && tipoProjeto === 'reforma' && (
        <div className={secao}>
          <h3 className={tituloSecao}>{badge(4)} Serviços</h3>
          <p className="text-[10px] text-sub">
            Os nomes ficam guardados centralmente — marque os que valem para esta obra. Desmarcar não apaga nada, só
            tira da lista daqui.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {servicosGlobais.map((nome) => {
              const habilitado = estrutura.servicos_habilitados.includes(nome);
              return (
                <label
                  key={nome}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold ${habilitado ? 'border-brand-ocre bg-brand-ocre/10 text-main' : 'border-card-border bg-background text-sub'}`}
                  style={{ opacity: servicoOcupado === nome ? 0.6 : 1, cursor: servicoOcupado === nome ? 'wait' : 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={habilitado}
                    disabled={servicoOcupado === nome}
                    onChange={() => (habilitado ? desabilitarServicoAqui(nome) : habilitarServicoAqui(nome))}
                  />
                  {nome}
                </label>
              );
            })}
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
              className="px-3 py-2 rounded-lg border border-card-border text-xs font-bold text-main disabled:opacity-40"
            >
              + novo serviço
            </button>
          </div>
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
                  {eq.pontos.map((p, iP) => (
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
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
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
