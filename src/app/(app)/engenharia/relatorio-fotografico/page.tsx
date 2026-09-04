'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Folder,
  Image as ImageIcon,
  List,
  Loader2,
  Pencil,
  Ruler,
  Search,
  Share2,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  adicionarAmbienteGlobal,
  adicionarColaborador,
  atualizarCamposProjeto,
  atualizarEquipamentos,
  atualizarEstrutura,
  atualizarProgresso,
  buscarProjetoPorId,
  buscarProjetos,
  buscarProjetosComFiltros,
  type ColaboradorRelatorio,
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
  listarColaboradores,
  listarProgresso,
  listarRelatoriosDoUsuario,
  obterEstruturaPorProjeto,
  removerAmbienteGlobal,
  removerColaborador,
  reordenarProgresso,
  uploadFotoRelatorio,
  urlPublicaFoto,
} from '@/modules/engenharia/relatorio-fotografico/services/apiRelatorioFotograficoOffline';
import { descricaoDe, descricaoReforma, limpaNome, pad } from '@/modules/engenharia/relatorio-fotografico/calc';
import { escolherFotosDaGaleriaNativa, temGaleriaNativa } from '@/shared/lib/fastGallery';
import { useSincronizacaoOffline } from '@/modules/engenharia/relatorio-fotografico/hooks/useSincronizacaoOffline';
import type {
  CamposRelatorio,
  Equipamento,
  EstruturaFotografica,
  ModeloRelatorioOpcao,
  ProgressoSlide,
  ProjetoResumo,
  TipoProjetoFotografico,
} from '@/modules/engenharia/relatorio-fotografico/types';
import { CAMPOS_RELATORIO_VAZIOS } from '@/modules/engenharia/relatorio-fotografico/types';

/** Máscara do UNIORG do Santander — XXX-XXXX com o hífen sempre fixo na 4ª posição. */
function formatarUniorg(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 7);
  if (digitos.length <= 3) return digitos;
  return digitos.slice(0, 3) + '-' + digitos.slice(3);
}

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

/** Heurística leve de "isto é um toque, não mouse" — sem sniffar user agent. */
function ehDispositivoMovel(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Escolha explícita entre câmera e galeria — dois `<input type="file">`
 * distintos (um com `capture`, um sem). Depender só do seletor nativo do
 * Android (`accept="image/*"` sem `capture`) às vezes mostra só o Google
 * Fotos, escondendo a opção de câmera; forçar os dois botões aqui garante
 * as duas opções em qualquer aparelho — mas só em celular/tablet: no PC não
 * existe câmera nesse fluxo, então abre o explorador de arquivos direto,
 * sem esse passo a mais.
 *
 * Depois de tirar foto pela câmera, oferece "salvar no aparelho" como um
 * passo separado (botão próprio) — chamar `navigator.share` direto dentro do
 * `onChange` do input, como a versão anterior fazia, às vezes não conta
 * como gesto do usuário aos olhos do navegador e o convite pra salvar nem
 * aparece; um clique novo e explícito garante o gesto.
 */
function ModalEscolhaOrigemFoto({
  onEscolher,
  onFechar,
  origemPreferida,
  onOrigemUsada,
}: {
  onEscolher: (file: File) => void;
  onFechar: () => void;
  /** Quando a foto anterior da MESMA sequência (ex.: antes→depois) veio de câmera/galeria, pula a tela de escolha e já abre a mesma origem de novo. */
  origemPreferida?: 'camera' | 'galeria';
  onOrigemUsada?: (origem: 'camera' | 'galeria') => void;
}) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const [fotoCapturada, setFotoCapturada] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [abrindoGaleriaNativa, setAbrindoGaleriaNativa] = useState(false);
  const [erroGaleriaNativa, setErroGaleriaNativa] = useState<string | null>(null);
  const desktop = !ehDispositivoMovel();
  const nativo = temGaleriaNativa();

  async function abrirGaleria() {
    onOrigemUsada?.('galeria');
    // App nativo (Capacitor/Android): grade rápida própria, abrindo direto
    // na pasta da câmera — ver FastGalleryActivity.kt/fastGallery.ts. Sem
    // isso caímos no seletor genérico do sistema, mais lento e sem pasta padrão.
    if (nativo) {
      setAbrindoGaleriaNativa(true);
      setErroGaleriaNativa(null);
      try {
        const arquivos = await escolherFotosDaGaleriaNativa();
        if (arquivos[0]) onEscolher(arquivos[0]);
      } catch (e) {
        // "Seleção cancelada" é o usuário tocando em Cancelar na própria
        // grade (ver FastGalleryPlugin.kt) — silencioso de propósito.
        // Qualquer outro erro (permissão negada, plugin ausente etc.)
        // precisa aparecer: antes ficava mudo e parecia que nada acontecia.
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('Seleção cancelada')) setErroGaleriaNativa(msg || 'Não foi possível abrir a galeria.');
      } finally {
        setAbrindoGaleriaNativa(false);
      }
      return;
    }
    galRef.current?.click();
  }

  useEffect(() => {
    if (desktop) {
      galRef.current?.click();
      return;
    }
    // continuação automática da mesma sequência (ex.: escolheu galeria pro
    // "antes", já reabre a galeria pro "depois" sem mostrar a tela de
    // escolha de novo) — só quando o componente nasce assim (ver `key` no
    // ponto de uso, que força um mount novo por slot).
    if (origemPreferida === 'galeria') abrirGaleria();
    else if (origemPreferida === 'camera') {
      onOrigemUsada?.('camera');
      camRef.current?.click();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvarNoAparelho() {
    if (!fotoCapturada) return;
    setSalvando(true);
    try {
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
      if (nav.canShare?.({ files: [fotoCapturada] })) {
        await nav.share?.({ files: [fotoCapturada] });
      }
    } catch {
      // usuário cancelou o compartilhamento, ou o aparelho não suporta — segue normal
    } finally {
      setSalvando(false);
      onEscolher(fotoCapturada);
    }
  }

  const inputsOcultos = (
    <>
      {/* 1. Câmera nativa direta */}
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) setFotoCapturada(file);
        }}
      />
      {/* 2. Galeria local do aparelho (tipos específicos sem wildcard puro forçam a galeria/fototeca nativa no Android e iOS) */}
      <input
        ref={galRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onEscolher(file);
        }}
      />
      {/* 3. Explorador de arquivos do aparelho (DCIM / Câmera / Downloads locais) */}
      <input
        ref={filesRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.heic,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onEscolher(file);
        }}
      />
    </>
  );

  // PC: sem passo de escolha — o clique no input já disparou no useEffect
  // acima; só precisa manter os inputs montados no DOM.
  if (desktop) return inputsOcultos;

  if (fotoCapturada) {
    return (
      <div
        className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-4"
        onClick={() => onEscolher(fotoCapturada)}
      >
        <div
          className="bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-xs p-4 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <h4 className="text-xs font-bold text-main text-center mb-1">Foto capturada</h4>
          <button
            type="button"
            disabled={salvando}
            onClick={salvarNoAparelho}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-brand-ocre text-white text-sm font-bold disabled:opacity-60"
          >
            {salvando ? 'Abrindo…' : 'Salvar no celular também'}
          </button>
          <button
            type="button"
            onClick={() => onEscolher(fotoCapturada)}
            className="w-full px-4 py-2 rounded-lg border border-card-border text-xs font-bold text-sub"
          >
            Só usar no relatório
          </button>
        </div>
        {inputsOcultos}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onFechar}>
      <div
        className="bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-xs p-4 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-xs font-bold text-main text-center mb-1">Adicionar foto</h4>
        <button
          type="button"
          onClick={() => {
            onOrigemUsada?.('camera');
            camRef.current?.click();
          }}
          className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg border border-card-border text-sm font-bold text-main hover:bg-background"
        >
          <Camera size={16} className="text-brand-ocre" />
          Tirar foto agora
        </button>
        <button
          type="button"
          disabled={abrindoGaleriaNativa}
          onClick={abrirGaleria}
          className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg border border-card-border text-sm font-bold text-main hover:bg-background disabled:opacity-60"
        >
          {abrindoGaleriaNativa ? <Loader2 size={16} className="animate-spin text-brand-blue" /> : <ImageIcon size={16} className="text-brand-blue" />}
          {abrindoGaleriaNativa ? 'Abrindo…' : 'Galeria do celular'}
        </button>
        {erroGaleriaNativa && (
          <p className="text-[10px] text-red-500 font-semibold text-center leading-tight">{erroGaleriaNativa}</p>
        )}
        {!nativo && (
          <button
            type="button"
            onClick={() => filesRef.current?.click()}
            className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg border border-card-border text-sm font-bold text-main hover:bg-background"
          >
            <Folder size={16} className="text-brand-ocre" />
            Arquivos do aparelho (DCIM / Pastas)
          </button>
        )}
        {!nativo && (
          <p className="text-[10px] text-desc text-center pt-1 leading-tight">
            No Android, se abrir o seletor padrão, toque no menu (⋮) para abrir a Galeria do aparelho.
          </p>
        )}
        <button type="button" onClick={onFechar} className="w-full px-4 py-2 rounded-lg text-xs font-bold text-sub">
          Cancelar
        </button>
        {inputsOcultos}
      </div>
    </div>
  );
}

/**
 * Seletor de opções com a cara do projeto — bottom sheet no celular, modal
 * centrado no desktop, busca embutida. Substitui o `<select>` nativo nos
 * pontos em que o layout de escolha padrão do sistema operacional (menu
 * simples do Android/iOS) destoa muito do resto da tela.
 */
function SeletorPersonalizado({
  rotulo,
  valor,
  opcoes,
  onEscolher,
  placeholder,
  desabilitado,
  desabilitadoTitulo,
}: {
  rotulo: string;
  valor: string;
  opcoes: string[];
  onEscolher: (v: string) => void;
  placeholder: string;
  desabilitado?: boolean;
  desabilitadoTitulo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const filtradas = opcoes.filter((o) => o.toLowerCase().includes(busca.toLowerCase()));

  return (
    <>
      <button
        type="button"
        disabled={desabilitado}
        title={desabilitado ? desabilitadoTitulo : undefined}
        onClick={() => setAberto(true)}
        className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-xs font-bold text-left flex items-center justify-between gap-2 disabled:opacity-40 focus:outline-none focus:border-brand-ocre focus:ring-1 focus:ring-brand-ocre transition-all"
      >
        <span className={valor ? 'text-main truncate' : 'text-slate-500 truncate'}>{valor || placeholder}</span>
        <ChevronDown size={13} className="text-desc shrink-0" />
      </button>
      {aberto && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center"
          onClick={() => {
            setAberto(false);
            setBusca('');
          }}
        >
          <div
            className="bg-card border border-card-border w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[75vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-card-border">
              <h4 className="text-sm font-bold text-main font-vomzom">{rotulo}</h4>
              <button
                type="button"
                onClick={() => {
                  setAberto(false);
                  setBusca('');
                }}
                className="text-desc hover:text-main"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-3 border-b border-card-border">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-desc pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar…"
                  className="w-full pl-8 pr-3 py-2 bg-background border border-card-border rounded-lg text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-ocre font-bold"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {filtradas.length === 0 && <div className="p-4 text-xs text-sub">Nada encontrado.</div>}
              {filtradas.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    onEscolher(o);
                    setAberto(false);
                    setBusca('');
                  }}
                  className={`w-full text-left px-4 py-3 text-sm font-bold border-b border-card-border/50 last:border-0 ${
                    o === valor ? 'text-brand-ocre bg-brand-ocre/10' : 'text-main hover:bg-background'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Slot de foto único (antes ou depois) — vira miniatura assim que há um
 * caminho salvo ou um arquivo local ainda não enviado. Vazio: clicar abre o
 * seletor de arquivo direto. Preenchido: clicar amplia com opções de Trocar
 * (reabre o seletor) e Excluir (quando `onExcluir` é passado) — evita trocar
 * a foto sem querer com um toque errado.
 */
function SlotFoto({
  rotulo,
  caminho,
  arquivoLocal,
  ocupado,
  somenteLeitura,
  onSelecionar,
  onExcluir,
}: {
  rotulo: string;
  caminho: string | null | undefined;
  arquivoLocal?: File | null;
  ocupado?: boolean;
  somenteLeitura?: boolean;
  onSelecionar: (file: File) => void;
  onExcluir?: () => void;
}) {
  const [ampliado, setAmpliado] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);

  // preview de arquivo ainda não enviado (antes de existir caminho no Storage) —
  // URL local descartada assim que o arquivo muda ou o componente desmonta
  const [previaLocal, setPreviaLocal] = useState<string | null>(null);
  useEffect(() => {
    if (!arquivoLocal) {
      setPreviaLocal(null);
      return;
    }
    const url = URL.createObjectURL(arquivoLocal);
    setPreviaLocal(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivoLocal]);

  const src = caminho ? urlPublicaFoto(caminho) : previaLocal;

  const miolo = (
    <>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={rotulo} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <>
          <Camera size={16} className="text-desc" />
          <span className="text-[9px] font-bold text-desc uppercase">{rotulo}</span>
        </>
      )}
      {src && (
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
          src ? 'border-brand-ocre/40' : 'border-dashed border-card-border'
        }`}
      >
        {miolo}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={ocupado}
        onClick={() => (src ? setAmpliado(true) : setEscolhendo(true))}
        className={`relative flex flex-col items-center justify-center gap-1 w-20 h-20 rounded-lg border-2 border-dashed overflow-hidden shrink-0 ${
          src ? 'border-brand-ocre/40' : 'border-card-border'
        } ${ocupado ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:border-brand-ocre/60'}`}
      >
        {miolo}
      </button>
      {escolhendo && (
        <ModalEscolhaOrigemFoto
          onEscolher={(file) => {
            onSelecionar(file);
            setEscolhendo(false);
          }}
          onFechar={() => setEscolhendo(false)}
        />
      )}
      {ampliado && src && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setAmpliado(false)}>
          <div className="bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-md p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={rotulo} className="w-full h-[50vh] max-h-[420px] object-cover rounded-lg border border-card-border" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setAmpliado(false);
                  setEscolhendo(true);
                }}
                className="flex-1 px-3 py-2 rounded-lg border border-card-border text-xs font-bold text-main"
              >
                Trocar
              </button>
              {onExcluir && (
                <button
                  type="button"
                  onClick={() => {
                    onExcluir();
                    setAmpliado(false);
                  }}
                  className="flex-1 px-3 py-2 rounded-lg border border-red-500/40 text-xs font-bold text-red-500 hover:bg-red-500/10"
                >
                  Excluir
                </button>
              )}
              <button type="button" onClick={() => setAmpliado(false)} className="px-3 py-2 rounded-lg text-xs font-bold text-sub">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Legenda do slide (mesma regra usada no PowerPoint) — infra: equipamento+ponto; reforma: serviço+ambiente. */
/** Reforma "clássica" sempre tem serviço; um slide com ambiente mas sem serviço/equipamento só pode ser do modelo Santander (Ambiente + Comentários). */
function ehLinhaSantander(s: ProgressoSlide): boolean {
  return !s.servico && !s.equipamento && !!s.ambiente;
}

function legendaSlide(s: ProgressoSlide): string {
  if (s.equipamento) return descricaoDe(s.equipamento, s.numero_ponto || '0', s.local || '', 'normal');
  if (ehLinhaSantander(s)) return s.ambiente + (s.comentario ? ' — ' + s.comentario : '');
  return descricaoReforma(s.servico || '', s.ambiente || '', 'normal');
}

/** Verde = fotos completas (2 pras reforma/infra, 3 — antes/durante/depois — pro Santander); âmbar = falta alguma (migration 00013 — serviço/ambiente valem sem foto). */
function slideCompleto(s: ProgressoSlide): boolean {
  if (ehLinhaSantander(s)) return !!s.foto_antes_path && !!s.foto_depois_path && !!s.foto_durante_path;
  return !!s.foto_antes_path && !!s.foto_depois_path;
}

/**
 * Os 2 primeiros slides do modelo são sempre a capa/dados do projeto — o
 * primeiro slide de foto de verdade nasce no 3 (ver `slideModelo` em
 * `lib/pptx.ts`, hoje sempre 3 nos dois configs com marcadores reais). Cada
 * slide consome 2 números de foto (a numeração de "Foto NN" nunca reinicia).
 */
const SLIDE_MODELO_BASE = 3;

/**
 * Lightbox de slide — antes/durante + depois lado a lado, ampliado, igual
 * ao layout final do PowerPoint. Abre pra qualquer slide, completo ou
 * pendente (migration 00013) — o lado sem foto mostra a arte de "adicionar
 * foto" em vez da imagem, e `onEscolherFoto` (quando passado) permite
 * completar ali mesmo, sem fechar e procurar o slide de novo na lista.
 */
function ModalPreviaSlide({
  slide,
  indice,
  onFechar,
  onEscolherFoto,
  ocupado,
}: {
  slide: ProgressoSlide;
  indice: number;
  onFechar: () => void;
  onEscolherFoto?: (lado: 'antes' | 'depois', file: File) => void;
  ocupado?: boolean;
}) {
  const [escolhendoLado, setEscolhendoLado] = useState<'antes' | 'depois' | null>(null);

  function ladoFoto(caminho: string | null, legenda: string, lado: 'antes' | 'depois') {
    if (caminho) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={urlPublicaFoto(caminho)}
          alt={legenda}
          className="w-full h-[42vh] max-h-[420px] object-cover rounded-lg border border-card-border"
        />
      );
    }
    return (
      <button
        type="button"
        disabled={!onEscolherFoto || ocupado}
        onClick={() => setEscolhendoLado(lado)}
        className="w-full h-[42vh] max-h-[420px] rounded-lg border-2 border-dashed border-amber-500/50 flex flex-col items-center justify-center gap-2 text-amber-600 hover:bg-amber-500/5 disabled:opacity-50"
      >
        <Camera size={28} />
        <span className="text-xs font-bold">{ocupado ? 'Enviando…' : 'Adicionar foto'}</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onFechar}>
      <div
        className="bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-card-border">
          <h3 className="text-sm font-bold text-main font-vomzom">Slide {SLIDE_MODELO_BASE + indice}</h3>
          <button onClick={onFechar} className="text-desc hover:text-main">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 flex flex-wrap gap-5 overflow-y-auto">
          <div className="flex-1 min-w-[280px] space-y-1.5">
            {ladoFoto(slide.foto_antes_path, slide.etapa1, 'antes')}
            <p className="text-[11px] font-bold text-desc uppercase tracking-wide">
              Foto {pad(2 * indice + 1)} - {slide.etapa1}
            </p>
          </div>
          <div className="flex-1 min-w-[280px] space-y-1.5">
            {ladoFoto(slide.foto_depois_path, 'Depois', 'depois')}
            <p className="text-[11px] font-bold text-desc uppercase tracking-wide">Foto {pad(2 * indice + 2)} - DEPOIS</p>
          </div>
        </div>
        {escolhendoLado && onEscolherFoto && (
          <ModalEscolhaOrigemFoto
            onEscolher={(file) => {
              onEscolherFoto(escolhendoLado, file);
              setEscolhendoLado(null);
            }}
            onFechar={() => setEscolhendoLado(null)}
          />
        )}
        <div className="px-4 pb-4 text-xs font-bold text-main">{legendaSlide(slide)}</div>
      </div>
    </div>
  );
}

function RelatorioFotograficoContent() {
  const { user, profile } = useAuth();
  const { offline, pendencias: pendenciasOffline, sincronizando: sincronizandoOffline, ultimoResultado, sincronizarAgora } = useSincronizacaoOffline();
  const searchParams = useSearchParams();
  const projetoIdUrl = searchParams.get('projetoId');
  // Parceiro EGF — acesso convidado, restrito aos próprios relatórios
  // avulsos (nunca vinculados a projeto corporativo); ver README.md.
  const ehParceiroEgf = profile?.role === 'convidado';

  // "Meus relatórios" — só carregado/mostrado pro Parceiro EGF, no topo,
  // antes de decidir criar um novo
  const [meusRelatorios, setMeusRelatorios] = useState<EstruturaFotografica[]>([]);
  const [carregandoMeusRelatorios, setCarregandoMeusRelatorios] = useState(false);

  // Cowork — compartilhamento do relatório atual com outros usuários
  const [modalCompartilharAberto, setModalCompartilharAberto] = useState(false);
  const [colaboradores, setColaboradores] = useState<ColaboradorRelatorio[]>([]);
  const [carregandoColaboradores, setCarregandoColaboradores] = useState(false);
  const [emailConvite, setEmailConvite] = useState('');
  const [papelConvite, setPapelConvite] = useState<'leitor' | 'editor' | 'admin'>('editor');
  const [enviandoConvite, setEnviandoConvite] = useState(false);
  const [erroConvite, setErroConvite] = useState<string | null>(null);

  // passo 1 — vínculo com projeto (ou avulso)
  const [isAvulso, setIsAvulso] = useState(false);
  const [obraNome, setObraNome] = useState('');
  const [projetoBusca, setProjetoBusca] = useState('');
  const [projetosSugeridos, setProjetosSugeridos] = useState<ProjetoResumo[]>([]);
  // Preenchido só quando offline + o projeto buscado não estava em cache —
  // o relatório nasce avulso pra não travar o usuário, e a sincronização
  // tenta religar ao projeto certo pelo nome assim que puder buscar de
  // verdade (ver apiRelatorioFotograficoOffline.ts/sincronizadorOffline.ts).
  const [vinculoPendenteNome, setVinculoPendenteNome] = useState<string | null>(null);
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

  // campos exclusivos do modelo Santander — conteúdo do relatório em si,
  // não dado de obra: nunca herdam do projeto vinculado, sempre editáveis
  const [uniorg, setUniorg] = useState('');
  const [mantenedor, setMantenedor] = useState('');
  const [chamado, setChamado] = useState('');
  const [relatorioTitulo, setRelatorioTitulo] = useState('ANTES X DURANTE X DEPOIS');
  const [dataRelatorio, setDataRelatorio] = useState('');
  const [descricaoProblema, setDescricaoProblema] = useState('');
  const [causaOrigem, setCausaOrigem] = useState('');
  const [danosSantander, setDanosSantander] = useState('');
  const [paliativoRetiradaRisco, setPaliativoRetiradaRisco] = useState('');
  const [escopoProposta, setEscopoProposta] = useState('');
  const [cronogramaSantander, setCronogramaSantander] = useState('');

  const [estrutura, setEstrutura] = useState<EstruturaFotografica | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resumoExpandido, setResumoExpandido] = useState(true);
  const [dadosExpandido, setDadosExpandido] = useState(true);
  const [tipoExpandido, setTipoExpandido] = useState(true);
  const [modoSlides, setModoSlides] = useState(false);
  const proximaEtapaRef = useRef<HTMLDivElement | null>(null);

  // passo 4 — equipamentos (infra) / serviços e ambientes (reforma)
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [servicosGlobais, setServicosGlobais] = useState<string[]>([]);
  const [novoServico, setNovoServico] = useState('');
  const [servicoOcupado, setServicoOcupado] = useState<string | null>(null);
  const [ambientesGlobais, setAmbientesGlobais] = useState<string[]>([]);
  const [novoAmbiente, setNovoAmbiente] = useState('');
  const [ambienteOcupado, setAmbienteOcupado] = useState<string | null>(null);
  const [previaIndice, setPreviaIndice] = useState<number | null>(null);
  const slidesScrollRef = useRef<HTMLDivElement>(null);
  const [temMaisAbaixo, setTemMaisAbaixo] = useState(false);

  /** Mostra a seta "tem mais slide abaixo" quando a lista rolável não está no fim. */
  function verificarRolagem() {
    const el = slidesScrollRef.current;
    if (!el) {
      setTemMaisAbaixo(false);
      return;
    }
    setTemMaisAbaixo(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  }
  const [ordemOcupada, setOrdemOcupada] = useState(false);
  const [ordemAutomatica, setOrdemAutomatica] = useState(false);
  const [arrastandoSlide, setArrastandoSlide] = useState<string | null>(null);
  const [alvoDrag, setAlvoDrag] = useState<string | null>(null);

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

  // criação de slide — modelo Santander (Ambiente + Comentários + 3 fotos)
  const [novoSlideAmbienteSant, setNovoSlideAmbienteSant] = useState('');
  const [novoSlideComentarioSant, setNovoSlideComentarioSant] = useState('');
  const [novoSlideAntesSant, setNovoSlideAntesSant] = useState<File | null>(null);
  const [novoSlideDuranteSant, setNovoSlideDuranteSant] = useState<File | null>(null);
  const [novoSlideDepoisSant, setNovoSlideDepoisSant] = useState<File | null>(null);
  const [escolhendoFotoSant, setEscolhendoFotoSant] = useState<'antes' | 'durante' | 'depois' | null>(null);
  const [escolhendoSlideFoto, setEscolhendoSlideFoto] = useState<'antes' | 'depois' | null>(null);
  // Guarda se a foto anterior da sequência veio de câmera ou galeria, pra
  // continuar na mesma origem sem mostrar a tela de escolha de novo — zera
  // sempre que uma sequência nova de fotos começa (ver iniciarOuLimparFotosSlide*).
  const [origemFotoEscolhida, setOrigemFotoEscolhida] = useState<'camera' | 'galeria' | null>(null);
  const [montandoPptx, setMontandoPptx] = useState(false);
  const [slideEditando, setSlideEditando] = useState<string | null>(null);

  // reforma "clássica" tem servico+ambiente; Santander só ambiente (sem
  // serviço) — ambos entram na mesma lista de slides gerados
  const progressoReforma = useMemo(() => progresso.filter((p) => p.servico || p.ambiente), [progresso]);

  /** Ambientes do catálogo global, na ordem salva pra ESTE relatório — os que ainda não foram ordenados caem no fim, em ordem alfabética. */
  const ambientesOrdenados = useMemo(() => {
    if (!estrutura) return [...ambientesGlobais].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const salvos = estrutura.ambientes_ordem.filter((a) => ambientesGlobais.includes(a));
    const resto = ambientesGlobais.filter((a) => !salvos.includes(a)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return [...salvos, ...resto];
  }, [ambientesGlobais, estrutura]);

  async function moverAmbiente(nome: string, direcao: -1 | 1) {
    if (!estrutura) return;
    const lista = [...ambientesOrdenados];
    const i = lista.indexOf(nome);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j]!, lista[i]!];
    try {
      const atualizada = await atualizarEstrutura(estrutura.id, { ambientes_ordem: lista });
      setEstrutura(atualizada);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  useEffect(() => {
    lerServicosGlobais().then(setServicosGlobais).catch(() => {});
    lerBancosCatalogo().then(setBancosCatalogo).catch(() => {});
    lerAmbientesGlobais().then(setAmbientesGlobais).catch(() => {});
  }, []);

  // Parceiro EGF nunca vincula a projeto corporativo — força avulso e
  // carrega os relatórios que ele mesmo já criou, pra retomar sem precisar
  // recriar do zero
  useEffect(() => {
    if (!ehParceiroEgf) return;
    setIsAvulso(true);
    if (!user?.id) return;
    setCarregandoMeusRelatorios(true);
    listarRelatoriosDoUsuario(user.id)
      .then(setMeusRelatorios)
      .catch(console.error)
      .finally(() => setCarregandoMeusRelatorios(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehParceiroEgf, user?.id]);

  useEffect(() => {
    if (!estrutura) {
      setProgresso([]);
      rascunhosFotoRef.current = {};
      return;
    }
    listarProgresso(estrutura.id).then(setProgresso).catch(console.error);
  }, [estrutura?.id]);

  useEffect(() => {
    verificarRolagem();
  }, [progresso]);

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

  // modelo "Santander — Antes x Durante x Depois": campos de cabeçalho e
  // slides de progresso completamente diferentes dos outros bancos — ver
  // MODELOS_CFG["santander-add"] em lib/pptx.ts
  const ehSantander = useMemo(
    () => modelosDoBanco.find((m) => m.nome === modeloRelatorio)?.config_id === 'santander-add',
    [modelosDoBanco, modeloRelatorio],
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
    setVinculoPendenteNome(null);
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
    setDadosExpandido(true);
    setModoSlides(false);
    setTipoExpandido(true);

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
    setDadosExpandido(true);
    setModoSlides(false);
    setTipoExpandido(true);
  }

  /** "Meus Relatórios" (Parceiro EGF) — retoma um relatório avulso já criado por ele. */
  function abrirMeuRelatorio(r: EstruturaFotografica) {
    setIsAvulso(true);
    setObraNome(r.obra_nome || '');
    carregarEstruturaNoFormulario(r);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function abrirCompartilhar() {
    if (!estrutura) return;
    setModalCompartilharAberto(true);
    setErroConvite(null);
    setEmailConvite('');
    setCarregandoColaboradores(true);
    listarColaboradores(estrutura.id)
      .then(setColaboradores)
      .catch((e) => setErroConvite((e as Error).message))
      .finally(() => setCarregandoColaboradores(false));
  }

  async function enviarConvite() {
    if (!estrutura || !emailConvite.trim()) return;
    setEnviandoConvite(true);
    setErroConvite(null);
    try {
      await adicionarColaborador(estrutura.id, emailConvite.trim(), papelConvite);
      const lista = await listarColaboradores(estrutura.id);
      setColaboradores(lista);
      setEmailConvite('');
    } catch (e) {
      setErroConvite((e as Error).message);
    } finally {
      setEnviandoConvite(false);
    }
  }

  async function removerConvite(colaboradorId: string) {
    if (!estrutura) return;
    try {
      await removerColaborador(colaboradorId);
      setColaboradores((atual) => atual.filter((c) => c.id !== colaboradorId));
    } catch (e) {
      setErroConvite((e as Error).message);
    }
  }

  function carregarEstruturaNoFormulario(e: EstruturaFotografica) {
    setEstrutura(e);
    // já tinha tipo definido — mostra compacto (o David ainda pode "Alterar")
    setTipoExpandido(false);
    // dados do relatório ficam expandidos pra revisão — o David quer poder ver
    // e resolver pendências antes de decidir seguir pra "Criar slides"
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
    // campos do Santander vivem sempre na própria estrutura, avulso ou não
    setUniorg(e.uniorg || '');
    setMantenedor(e.mantenedor || '');
    setChamado(e.chamado || '');
    setRelatorioTitulo(e.relatorio_titulo || 'ANTES X DURANTE X DEPOIS');
    setDataRelatorio(e.data_relatorio || '');
    setDescricaoProblema(e.descricao_problema || '');
    setCausaOrigem(e.causa_origem || '');
    setDanosSantander(e.danos || '');
    setPaliativoRetiradaRisco(e.paliativo_retirada_risco || '');
    setEscopoProposta(e.escopo_proposta || '');
    setCronogramaSantander(e.cronograma || '');
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
    if (ehSantander) campos.push({ label: 'UNIORG', valor: uniorg });
    return campos.filter((c) => !c.valor || !c.valor.trim()).map((c) => c.label);
  }, [banco, modeloRelatorio, agencia, programa, upe, sap, gestor, fiscEmpresa, fiscal, construtora, responsavel, dataInicioObra, dataTerminoObra, ehSantander, uniorg]);

  // slides com serviço/ambiente definidos mas sem alguma das duas fotos (migration 00013) — bloqueia só o "Montar PowerPoint"
  const pendenciasFotos = useMemo(() => progresso.filter((s) => !slideCompleto(s)).length, [progresso]);

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

      // campos exclusivos do Santander — sempre na própria estrutura (nunca
      // em `projetos`), independente de avulso ou vinculado
      const camposSantander = ehSantander
        ? {
            uniorg: uniorg || null,
            mantenedor: mantenedor || null,
            chamado: chamado || null,
            relatorio_titulo: relatorioTitulo || null,
            data_relatorio: dataRelatorio || null,
            descricao_problema: descricaoProblema || null,
            causa_origem: causaOrigem || null,
            danos: danosSantander || null,
            paliativo_retirada_risco: paliativoRetiradaRisco || null,
            escopo_proposta: escopoProposta || null,
            cronograma: cronogramaSantander || null,
          }
        : {};

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
          ...camposSantander,
          vinculoPendenteNome: vinculoPendenteNome || undefined,
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
        ...camposSantander,
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

  async function persistirOrdem(lista: ProgressoSlide[]) {
    setProgresso(lista);
    setOrdemOcupada(true);
    try {
      await reordenarProgresso(lista.map((p) => p.id));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOrdemOcupada(false);
    }
  }

  /** Ambiente → Serviço → Antes antes de Durante. Ambiente usa a ordem
   *  escolhida na etapa 4 (`estrutura.ambientes_ordem`) — quem não está
   *  nela cai no fim, em ordem alfabética. */
  function compararOrdemAutomatica(a: ProgressoSlide, b: ProgressoSlide): number {
    const ordem = estrutura?.ambientes_ordem ?? [];
    const posA = ordem.indexOf(a.ambiente || '');
    const posB = ordem.indexOf(b.ambiente || '');
    const porAmbiente =
      posA === -1 && posB === -1
        ? (a.ambiente || '').localeCompare(b.ambiente || '', 'pt-BR')
        : (posA === -1 ? ordem.length : posA) - (posB === -1 ? ordem.length : posB);
    if (porAmbiente !== 0) return porAmbiente;
    const porServico = (a.servico || '').localeCompare(b.servico || '', 'pt-BR');
    if (porServico !== 0) return porServico;
    if (a.etapa1 !== b.etapa1) return a.etapa1 === 'ANTES' ? -1 : 1;
    return 0;
  }

  function onSoltarSlide(idAlvo: string) {
    if (!arrastandoSlide || arrastandoSlide === idAlvo) {
      setArrastandoSlide(null);
      setAlvoDrag(null);
      return;
    }
    const lista = [...progresso];
    const origem = lista.findIndex((p) => p.id === arrastandoSlide);
    const destino = lista.findIndex((p) => p.id === idAlvo);
    setArrastandoSlide(null);
    setAlvoDrag(null);
    if (origem < 0 || destino < 0) return;
    const [item] = lista.splice(origem, 1);
    lista.splice(destino, 0, item!);
    persistirOrdem(lista);
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
  /**
   * Serviço e ambiente são obrigatórios pra criar o slide — fotos não são
   * (migration 00013): o slide nasce com pendência de foto, marcado com a
   * bolinha de status, e só isso trava a montagem do PowerPoint, nunca a
   * criação do slide em si.
   */
  async function salvarNovoSlideReforma() {
    if (!estrutura || !novoSlideServico || !novoSlideAmbiente.trim()) return;
    setFotoOcupada('novo-slide');
    try {
      const [caminhoAntes, caminhoDepois] = await Promise.all([
        novoSlideAntes ? uploadFotoRelatorio(estrutura.id, [novoSlideServico, novoSlideEtapa], novoSlideAntes) : Promise.resolve(null),
        novoSlideDepois ? uploadFotoRelatorio(estrutura.id, [novoSlideServico, 'DEPOIS'], novoSlideDepois) : Promise.resolve(null),
      ]);
      const novo = await criarProgresso(estrutura.id, {
        servico: novoSlideServico,
        ambiente: novoSlideAmbiente.trim(),
        etapa1: novoSlideEtapa,
        fotoAntesPath: caminhoAntes,
        fotoDepoisPath: caminhoDepois,
      });
      if (ordemAutomatica) {
        const ordenada = [...progresso, novo].sort(compararOrdemAutomatica);
        persistirOrdem(ordenada);
      } else {
        setProgresso((prev) => [...prev, novo]);
      }
      // herda serviço e ambiente pro próximo slide (igual ao app original) — só
      // fotos e etapa voltam ao padrão, já que normalmente vários slides seguidos
      // são do mesmo serviço/ambiente
      setNovoSlideEtapa('ANTES');
      setNovoSlideAntes(null);
      setNovoSlideDepois(null);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setFotoOcupada(null);
    }
  }

  /**
   * Slide do modelo Santander: Ambiente + Comentários + 3 fotos (Antes/
   * Durante/Depois, não 2). O comentário NÃO é limpo depois de salvar —
   * o David pediu que o próximo slide já venha com o último comentário
   * preenchido, editável (o padrão é repetir o mesmo comentário em vários
   * pontos do mesmo ambiente).
   */
  async function salvarNovoSlideSantander() {
    if (!estrutura || !novoSlideAmbienteSant.trim()) return;
    setFotoOcupada('novo-slide');
    try {
      const segmento = [novoSlideAmbienteSant.trim()];
      const [caminhoAntes, caminhoDurante, caminhoDepois] = await Promise.all([
        novoSlideAntesSant ? uploadFotoRelatorio(estrutura.id, [...segmento, 'ANTES'], novoSlideAntesSant) : Promise.resolve(null),
        novoSlideDuranteSant ? uploadFotoRelatorio(estrutura.id, [...segmento, 'DURANTE'], novoSlideDuranteSant) : Promise.resolve(null),
        novoSlideDepoisSant ? uploadFotoRelatorio(estrutura.id, [...segmento, 'DEPOIS'], novoSlideDepoisSant) : Promise.resolve(null),
      ]);
      const novo = await criarProgresso(estrutura.id, {
        ambiente: novoSlideAmbienteSant.trim(),
        comentario: novoSlideComentarioSant.trim() || null,
        etapa1: 'ANTES',
        fotoAntesPath: caminhoAntes,
        fotoDepoisPath: caminhoDepois,
        fotoDurantePath: caminhoDurante,
      });
      if (ordemAutomatica) {
        const ordenada = [...progresso, novo].sort(compararOrdemAutomatica);
        persistirOrdem(ordenada);
      } else {
        setProgresso((prev) => [...prev, novo]);
      }
      setNovoSlideAntesSant(null);
      setNovoSlideDuranteSant(null);
      setNovoSlideDepoisSant(null);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setFotoOcupada(null);
    }
  }

  function iniciarOuLimparFotosSlideSant() {
    if (novoSlideAntesSant && novoSlideDuranteSant && novoSlideDepoisSant) {
      setNovoSlideAntesSant(null);
      setNovoSlideDuranteSant(null);
      setNovoSlideDepoisSant(null);
      return;
    }
    if (!novoSlideAntesSant) setOrigemFotoEscolhida(null); // sequência nova — mostra a escolha de origem de novo
    setEscolhendoFotoSant(!novoSlideAntesSant ? 'antes' : !novoSlideDuranteSant ? 'durante' : 'depois');
  }

  function definirFotoSlideManualSant(lado: 'antes' | 'durante' | 'depois', file: File | null) {
    if (lado === 'antes') setNovoSlideAntesSant(file);
    else if (lado === 'durante') setNovoSlideDuranteSant(file);
    else setNovoSlideDepoisSant(file);
  }

  /**
   * Um botão só, dois picks em sequência: primeiro Antes/Durante, depois
   * Depois — igual ao app original. Se as duas já estiverem escolhidas, o
   * mesmo botão vira "Excluir fotos" (limpa as duas de uma vez). Cada
   * escolha abre o `ModalEscolhaOrigemFoto` (câmera ou galeria) — reabrir
   * nosso próprio modal não esbarra na restrição do navegador de recusar um
   * segundo seletor nativo encadeado.
   */
  function iniciarOuLimparFotosSlide() {
    if (novoSlideAntes && novoSlideDepois) {
      setNovoSlideAntes(null);
      setNovoSlideDepois(null);
      return;
    }
    if (!novoSlideAntes) setOrigemFotoEscolhida(null); // sequência nova — mostra a escolha de origem de novo
    setEscolhendoSlideFoto(novoSlideAntes ? 'depois' : 'antes');
  }

  /** Escolha manual direto na miniatura (fora do fluxo do botão "Inserir fotos"). */
  function definirFotoSlideManual(lado: 'antes' | 'depois', file: File | null) {
    if (lado === 'antes') setNovoSlideAntes(file);
    else setNovoSlideDepois(file);
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

  async function editarSlide(id: string, patch: { ambiente?: string | null; etapa1?: 'ANTES' | 'DURANTE' }) {
    try {
      const atualizado = await atualizarProgresso(id, patch);
      setProgresso((prev) => prev.map((p) => (p.id === atualizado.id ? atualizado : p)));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  /** Completa uma foto pendente direto pela pré-visualização (sem fechar e caçar o slide na lista). */
  async function adicionarFotoAoSlide(slide: ProgressoSlide, lado: 'antes' | 'depois', file: File) {
    if (!estrutura) return;
    setFotoOcupada('previa-' + slide.id);
    try {
      const segmento = slide.equipamento
        ? [slide.equipamento, slide.numero_ponto || '']
        : [slide.servico || '', lado === 'antes' ? slide.etapa1 : 'DEPOIS'];
      const caminho = await uploadFotoRelatorio(estrutura.id, segmento, file);
      const atualizado = await atualizarProgresso(
        slide.id,
        lado === 'antes' ? { foto_antes_path: caminho } : { foto_depois_path: caminho },
      );
      setProgresso((prev) => prev.map((p) => (p.id === atualizado.id ? atualizado : p)));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setFotoOcupada(null);
    }
  }

  /** Geração roda no servidor (precisa de `sharp`) — o client só manda os dados já carregados e recebe o .pptx pronto. */
  async function montarPowerPoint() {
    if (!estrutura || progresso.some((s) => !slideCompleto(s))) return;
    const modeloEscolhido = modelosDoBanco.find((m) => m.nome === modeloRelatorio);
    if (!modeloEscolhido?.config_id || !modeloEscolhido.storage_template_path) {
      setErro('Este modelo ainda não tem um template configurado no Storage — avise o Antigravity.');
      return;
    }
    setMontandoPptx(true);
    setErro(null);
    try {
      const campos: CamposRelatorio = ehSantander
        ? {
            ...CAMPOS_RELATORIO_VAZIOS,
            chamado,
            mantenedor,
            relatorioTitulo,
            dataRelatorio,
            descricaoProblema,
            causaOrigem,
            danos: danosSantander,
            paliativoRetiradaRisco,
            escopoProposta,
            cronograma: cronogramaSantander,
            // os dois marcadores do template Santander juntam vários dados
            // numa linha só — ver comentário em MODELOS_CFG["santander-add"]
            resumoUniorg: `UNIORG: ${uniorg} ${agencia}`,
            resumoOsUniorg: `OS: ${chamado}             UNIORG: ${uniorg}        NOME DO PONTO: ${agencia}`,
          }
        : {
            ...CAMPOS_RELATORIO_VAZIOS,
            agencia,
            programa,
            upe,
            sap,
            gestor,
            fiscEmpresa,
            fiscal,
            construtora,
            responsavel,
            inicio: formatarData(dataInicioObra),
            termino: formatarData(dataTerminoObra),
          };
      const slides = ehSantander
        ? progresso.map((s) => ({
            ambiente: s.ambiente || '',
            comentario: s.comentario || '',
            etapa1: s.etapa1,
            fotoAntesPath: s.foto_antes_path,
            fotoDepoisPath: s.foto_depois_path,
            fotoDurantePath: s.foto_durante_path,
          }))
        : progresso.map((s) => ({
            descricao: s.equipamento
              ? descricaoDe(s.equipamento, s.numero_ponto || '0', s.local || '', 'alta')
              : descricaoReforma(s.servico || '', s.ambiente || '', 'alta'),
            etapa1: s.etapa1,
            fotoAntesPath: s.foto_antes_path,
            fotoDepoisPath: s.foto_depois_path,
          }));

      const resp = await fetch('/api/relatorio-fotografico/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId: modeloEscolhido.config_id,
          templatePath: modeloEscolhido.storage_template_path,
          campos,
          slides,
          banco,
          agencia,
          uniorg,
          nomeFallback: isAvulso ? obraNome : projetoSelecionado?.nome || 'projeto',
        }),
      });
      if (!resp.ok) {
        const dados = await resp.json().catch(() => ({}) as { erro?: string });
        throw new Error(dados.erro || 'Falha ao montar o PowerPoint.');
      }
      const blob = await resp.blob();
      const nomeCabecalho = resp.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1];
      const nomeArquivo = nomeCabecalho ? decodeURIComponent(nomeCabecalho) : 'relatorio.pptx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // revoga só depois de dar tempo do navegador iniciar o download —
      // revogar na hora podia invalidar o blob antes do download começar
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setMontandoPptx(false);
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

  const botaoMontarPptx = estrutura && (
    <button
      type="button"
      disabled={pendencias.length > 0 || progresso.length === 0 || pendenciasFotos > 0 || montandoPptx}
      onClick={montarPowerPoint}
      title={
        pendencias.length > 0
          ? 'Resolva as pendências nos dados do relatório primeiro'
          : progresso.length === 0
            ? 'Crie pelo menos 1 slide primeiro'
            : pendenciasFotos > 0
              ? `${pendenciasFotos} slide(s) sem foto — complete antes de montar`
              : undefined
      }
      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-ocre text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
    >
      {montandoPptx ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
      {montandoPptx ? 'Montando…' : 'Montar PowerPoint'}
    </button>
  );

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

      {(offline || pendenciasOffline > 0) && (
        <div className="flex items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-amber-600">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={15} className="shrink-0" />
            <p className="text-xs font-semibold min-w-0">
              {offline
                ? `Sem conexão — o que você criar/alterar fica salvo neste aparelho${pendenciasOffline > 0 ? ` (${pendenciasOffline} pendente${pendenciasOffline > 1 ? 's' : ''})` : ''} e envia sozinho quando a internet voltar.`
                : sincronizandoOffline
                ? 'Enviando dados salvos offline…'
                : `${pendenciasOffline} pendência${pendenciasOffline > 1 ? 's' : ''} aguardando envio.`}
            </p>
          </div>
          {!offline && !sincronizandoOffline && pendenciasOffline > 0 && (
            <button
              type="button"
              onClick={sincronizarAgora}
              className="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap hover:underline shrink-0"
            >
              Enviar agora
            </button>
          )}
        </div>
      )}

      {ultimoResultado && ultimoResultado.sincronizados > 0 && !offline && !sincronizandoOffline && pendenciasOffline === 0 && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3.5 py-2.5 text-emerald-600">
          <Check size={15} className="shrink-0" />
          <p className="text-xs font-semibold">
            {ultimoResultado.sincronizados} {ultimoResultado.sincronizados > 1 ? 'itens salvos offline foram enviados' : 'item salvo offline foi enviado'} pro sistema.
          </p>
        </div>
      )}

      {erro && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold rounded-lg p-3">{erro}</div>
      )}

      {ehParceiroEgf && !estrutura && (
        <div className={secao}>
          <h3 className={tituloSecao}>Meus relatórios</h3>
          {carregandoMeusRelatorios ? (
            <p className="text-[10px] text-sub italic">Carregando…</p>
          ) : meusRelatorios.length === 0 ? (
            <p className="text-[10px] text-sub italic">Nenhum relatório seu ainda — comece um novo abaixo.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {meusRelatorios.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => abrirMeuRelatorio(r)}
                  className="text-left px-3 py-2.5 rounded-lg border border-card-border bg-background hover:border-brand-ocre/50 transition-colors"
                >
                  <div className="text-xs font-bold text-main truncate">{r.obra_nome || 'Sem nome'}</div>
                  <div className="text-[10px] text-sub">
                    {r.tipo_projeto === 'infraestrutura' ? 'Infraestrutura' : 'Reforma'} ·{' '}
                    {new Date(r.updated_at).toLocaleDateString('pt-BR')}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
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
          <div className="flex items-center gap-3 shrink-0">
            {(!ehParceiroEgf || estrutura.user_id === user?.id) && (
              <button
                type="button"
                onClick={abrirCompartilhar}
                className="flex items-center gap-1 text-[10px] font-bold text-sub hover:text-brand-ocre whitespace-nowrap"
                title="Compartilhar este relatório com outro usuário"
              >
                <Share2 size={12} /> Compartilhar
              </button>
            )}
            <button
              type="button"
              onClick={() => setResumoExpandido(true)}
              className="text-[10px] font-bold text-brand-blue hover:underline whitespace-nowrap"
            >
              Editar
            </button>
          </div>
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
            {!ehParceiroEgf && (
              <label className="flex items-center gap-2 text-[11px] font-semibold text-sub hover:text-brand-ocre transition-colors cursor-pointer select-none bg-background border border-card-border/80 rounded-full pl-2.5 pr-3 py-1">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded text-brand-ocre focus:ring-brand-ocre border-card-border cursor-pointer accent-brand-ocre"
                  checked={isAvulso}
                  onChange={(e) => {
                    setIsAvulso(e.target.checked);
                    setEstrutura(null);
                    setProjetoSelecionado(null);
                    setVinculoPendenteNome(null);
                    setHabilitarEdicaoObra(false);
                    setResumoExpandido(true);
                    setDadosExpandido(true);
                    setModoSlides(false);
                    setTipoExpandido(true);
                  }}
                />
                <span>
                  Relatório avulso <span className="font-normal text-desc">(obra de terceiro, sem vínculo)</span>
                </span>
              </label>
            )}
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
              {offline && projetoBusca.trim() && !buscandoProjetos && projetosSugeridos.length === 0 && (
                <div className="flex items-center justify-between gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mt-1">
                  <p className="text-[10px] text-amber-600 font-semibold">
                    Sem sinal e esse projeto não está salvo neste aparelho.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAvulso(true);
                      setObraNome(projetoBusca.trim());
                      setVinculoPendenteNome(projetoBusca.trim());
                    }}
                    className="text-[10px] font-bold text-amber-600 hover:underline whitespace-nowrap shrink-0"
                  >
                    Criar avulso e vincular depois
                  </button>
                </div>
              )}
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
        {!tipoExpandido ? (
          <div className="flex items-center justify-between gap-3 bg-background border border-card-border rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              {tipoProjeto === 'infraestrutura' ? (
                <Ruler size={14} className="text-brand-ocre" />
              ) : (
                <Building2 size={14} className="text-brand-blue" />
              )}
              <span className="text-xs font-bold text-main">{tipoProjeto === 'infraestrutura' ? 'Infraestrutura' : 'Reforma'}</span>
            </div>
            <button
              type="button"
              onClick={() => setTipoExpandido(true)}
              className="text-[10px] font-bold text-brand-blue hover:underline whitespace-nowrap"
            >
              Alterar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setTipoProjeto('infraestrutura');
                setTipoExpandido(false);
              }}
              className={`text-left p-3 rounded-lg border-2 transition-all ${tipoProjeto === 'infraestrutura' ? 'border-brand-ocre bg-brand-ocre/10' : 'border-card-border bg-background hover:border-brand-ocre/40'}`}
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-brand-ocre/10 border border-brand-ocre/30 flex items-center justify-center shrink-0">
                  <Ruler size={14} className="text-brand-ocre" />
                </div>
                <div className="font-bold text-xs text-main">Infraestrutura</div>
              </div>
              <p className="text-[10px] text-sub mt-1">Equipamento → pontos numerados. Um slide por ponto.</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setTipoProjeto('reforma');
                setTipoExpandido(false);
              }}
              className={`text-left p-3 rounded-lg border-2 transition-all ${tipoProjeto === 'reforma' ? 'border-brand-blue bg-brand-blue/10' : 'border-card-border bg-background hover:border-brand-blue/40'}`}
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-brand-blue/10 border border-brand-blue/30 flex items-center justify-center shrink-0">
                  <Building2 size={14} className="text-brand-blue" />
                </div>
                <div className="font-bold text-xs text-main">Reforma</div>
              </div>
              <p className="text-[10px] text-sub mt-1">Serviço → antes, durante e depois. Várias fotos por etapa.</p>
            </button>
          </div>
        )}
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

        {estrutura && !dadosExpandido ? (
          <div className="flex items-center justify-between gap-3 bg-background border border-card-border rounded-lg px-3 py-2.5">
            <span className="text-xs text-sub">
              {pendencias.length > 0 ? (
                <span className="text-amber-600 font-bold">{pendencias.length} pendência(s) nos dados do relatório</span>
              ) : (
                'Dados do relatório completos.'
              )}
            </span>
            <button
              type="button"
              onClick={() => setDadosExpandido(true)}
              className="text-[10px] font-bold text-brand-blue hover:underline whitespace-nowrap"
            >
              Editar
            </button>
          </div>
        ) : (
          <>
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

        {ehSantander && (
          <div className="space-y-3 border-t border-card-border pt-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-ocre">Modelo Santander</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={label}>UNIORG (Loja) *</label>
                <input
                  type="text"
                  value={uniorg}
                  onChange={(e) => setUniorg(formatarUniorg(e.target.value))}
                  className={input}
                  placeholder="XXX-XXXX"
                  maxLength={8}
                />
              </div>
              <div className="space-y-1">
                <label className={label}>Chamado / OS</label>
                <input type="text" value={chamado} onChange={(e) => setChamado(e.target.value)} className={input} />
              </div>
              <div className="space-y-1">
                <label className={label}>Nome do Mantenedor</label>
                <input type="text" value={mantenedor} onChange={(e) => setMantenedor(e.target.value)} className={input} />
              </div>
              <div className="space-y-1">
                <label className={label}>Data do relatório</label>
                <input
                  type="text"
                  value={dataRelatorio}
                  onChange={(e) => setDataRelatorio(e.target.value)}
                  className={input}
                  placeholder="ex.: 04/09/2026"
                />
                <p className="text-[10px] text-sub">Sempre digitada — não puxa de nenhum outro cadastro.</p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className={label}>Relatório (título)</label>
                <input
                  type="text"
                  value={relatorioTitulo}
                  onChange={(e) => setRelatorioTitulo(e.target.value)}
                  className={input}
                />
              </div>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-ocre pt-1">Vistoria</p>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <label className={label}>Descrição do problema</label>
                <textarea value={descricaoProblema} onChange={(e) => setDescricaoProblema(e.target.value)} className={input + ' min-h-[70px]'} />
              </div>
              <div className="space-y-1">
                <label className={label}>Causa / Origem</label>
                <textarea value={causaOrigem} onChange={(e) => setCausaOrigem(e.target.value)} className={input + ' min-h-[70px]'} />
              </div>
              <div className="space-y-1">
                <label className={label}>Danos</label>
                <textarea value={danosSantander} onChange={(e) => setDanosSantander(e.target.value)} className={input + ' min-h-[70px]'} />
              </div>
              <div className="space-y-1">
                <label className={label}>Paliativo e retirada de risco</label>
                <textarea value={paliativoRetiradaRisco} onChange={(e) => setPaliativoRetiradaRisco(e.target.value)} className={input + ' min-h-[70px]'} />
              </div>
              <div className="space-y-1">
                <label className={label}>Escopo / Proposta</label>
                <textarea value={escopoProposta} onChange={(e) => setEscopoProposta(e.target.value)} className={input + ' min-h-[70px]'} />
              </div>
              <div className="space-y-1">
                <label className={label}>Cronograma</label>
                <textarea value={cronogramaSantander} onChange={(e) => setCronogramaSantander(e.target.value)} className={input + ' min-h-[70px]'} />
              </div>
            </div>
          </div>
        )}
          </>
        )}

        <div className="flex flex-wrap gap-2">
          {!estrutura && (
            <button
              type="button"
              disabled={!podeCriar || salvando}
              onClick={criarOuAtualizarCabecalho}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-ocre text-white text-xs font-bold disabled:opacity-40"
            >
              {salvando ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              Iniciar relatório
            </button>
          )}
          {estrutura && (isAvulso || habilitarEdicaoObra) && dadosExpandido && (
            <button
              type="button"
              disabled={salvando}
              onClick={criarOuAtualizarCabecalho}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-card-border text-main text-xs font-bold disabled:opacity-40"
            >
              {salvando ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              Salvar dados
            </button>
          )}
          {estrutura && (
            <button
              type="button"
              onClick={async () => {
                if (isAvulso || habilitarEdicaoObra) await criarOuAtualizarCabecalho();
                setModoSlides(true);
                setDadosExpandido(false);
                setTimeout(() => proximaEtapaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
              }}
              disabled={salvando}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-ocre text-white text-xs font-bold disabled:opacity-40"
            >
              {salvando ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              {modoSlides ? 'Slides' : 'Criar slides'}
            </button>
          )}
        </div>
      </div>

      {/* continuação — só aparece depois de "Criar slides": dados de apoio
          (ambientes/serviços/equipamentos) à esquerda, slides já criados numa
          coluna fixa à direita (como um painel de miniaturas do PowerPoint) */}
      {estrutura && modoSlides && (
      <div ref={proximaEtapaRef} className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-6 min-w-0">
      {(pendencias.length > 0 || pendenciasFotos > 0) && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200">
            {pendencias.length > 0 && (
              <div>
                <strong className="font-bold">Pendências nos dados do relatório:</strong> {pendencias.join(', ')}.
              </div>
            )}
            {pendenciasFotos > 0 && (
              <div className={pendencias.length > 0 ? 'mt-1' : ''}>
                <strong className="font-bold">{pendenciasFotos} slide(s) sem foto</strong> — a bolinha âmbar marca
                quais.
              </div>
            )}
            <span className="block mt-1 text-[11px] opacity-90 font-medium">
              Pode continuar preenchendo abaixo — mas o PowerPoint só poderá ser montado depois que tudo isso
              estiver completo.
            </span>
          </div>
        </div>
      )}

      {/* 4 — ambientes (catálogo global, reaproveitado em qualquer relatório futuro) */}
      {tipoProjeto === 'reforma' && (
        <div className={secao}>
          <h3 className={tituloSecao}>{badge(4)} Ambientes</h3>
          <p className="text-[10px] text-sub">
            Lista global — um ambiente criado aqui já fica disponível pra qualquer relatório futuro, não só este.
          </p>
          {ambientesGlobais.length === 0 ? (
            <p className="text-[10px] text-sub italic">Nenhum ambiente cadastrado ainda.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[...ambientesGlobais].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((a) => (
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

          {estrutura && ambientesOrdenados.length > 1 && (
            <div className="space-y-1.5 pt-2 border-t border-card-border">
              <p className="text-[10px] font-bold text-desc uppercase tracking-wider">
                Ordem nos slides — usada pelo &quot;organizar automaticamente&quot;
              </p>
              <div className="space-y-1">
                {ambientesOrdenados.map((a, i) => (
                  <div
                    key={a}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-card-border bg-background text-xs font-bold text-main"
                  >
                    <span className="text-[10px] font-mono text-desc w-4 text-center shrink-0">{i + 1}</span>
                    <span className="flex-1 truncate">{a}</span>
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => moverAmbiente(a, -1)}
                      className="text-desc hover:text-main disabled:opacity-30"
                      title="Mover pra cima"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={i === ambientesOrdenados.length - 1}
                      onClick={() => moverAmbiente(a, 1)}
                      className="text-desc hover:text-main disabled:opacity-30"
                      title="Mover pra baixo"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5 — serviços: catálogo global inteiro à vista, cinza = conhecido mas não
          habilitado nesta obra, colorido = habilitado. Clicar alterna. */}
      {estrutura && tipoProjeto === 'reforma' && (
        <div className={secao}>
          <h3 className={tituloSecao}>{badge(5)} Serviços</h3>
          <p className="text-[10px] text-sub">
            Cinza = já existe no catálogo, mas não vale pra esta obra ainda. Toque pra habilitar (fica colorido) —
            toque de novo pra tirar da lista desta obra, sem apagar do catálogo.
          </p>
          {servicosGlobais.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[...servicosGlobais].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((nome) => {
                const habilitado = estrutura.servicos_habilitados.includes(nome);
                return (
                  <button
                    key={nome}
                    type="button"
                    disabled={servicoOcupado === nome}
                    onClick={() => (habilitado ? desabilitarServicoAqui(nome) : habilitarServicoAqui(nome))}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold truncate transition-colors ${
                      habilitado
                        ? 'border-brand-ocre bg-brand-ocre/10 text-main'
                        : 'border-card-border bg-slate-100 dark:bg-zinc-800/60 text-sub hover:text-main'
                    }`}
                    style={{ opacity: servicoOcupado === nome ? 0.5 : undefined }}
                  >
                    {nome}
                  </button>
                );
              })}
            </div>
          )}
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
              + novo serviço
            </button>
          </div>
        </div>
      )}

      {/* 6 — criar slide: uma etapa única (não mais um link por serviço) —
          escolhe serviço + ambiente, monta o par antes/depois, salva */}
      {estrutura && tipoProjeto === 'reforma' && !ehSantander && estrutura.servicos_habilitados.length > 0 && (
        <div className={secao}>
          <h3 className={tituloSecao}>{badge(6)} Criar slide</h3>
          <div className="grid grid-cols-2 gap-2">
            <SeletorPersonalizado
              rotulo="Serviço"
              placeholder="Selecione o serviço…"
              valor={novoSlideServico ?? ''}
              opcoes={[...estrutura.servicos_habilitados].sort((a, b) => a.localeCompare(b, 'pt-BR'))}
              onEscolher={(v) => setNovoSlideServico(v)}
            />
            <SeletorPersonalizado
              rotulo="Ambiente"
              placeholder="Selecione o ambiente…"
              valor={novoSlideAmbiente}
              opcoes={[...ambientesGlobais].sort((a, b) => a.localeCompare(b, 'pt-BR'))}
              onEscolher={(v) => setNovoSlideAmbiente(v)}
            />
          </div>
          <div className="space-y-1">
            <label className={label}>Primeira foto vem de</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNovoSlideEtapa('ANTES')}
                className={`px-4 py-1.5 rounded-lg border-2 text-xs font-bold ${novoSlideEtapa === 'ANTES' ? 'border-brand-ocre bg-brand-ocre/10 text-main' : 'border-card-border text-sub'}`}
              >
                Antes
              </button>
              <button
                type="button"
                onClick={() => setNovoSlideEtapa('DURANTE')}
                className={`px-4 py-1.5 rounded-lg border-2 text-xs font-bold ${novoSlideEtapa === 'DURANTE' ? 'border-brand-ocre bg-brand-ocre/10 text-main' : 'border-card-border text-sub'}`}
              >
                Durante
              </button>
            </div>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col items-center gap-1">
              <SlotFoto
                rotulo={novoSlideEtapa === 'ANTES' ? 'Antes' : 'Durante'}
                caminho={null}
                arquivoLocal={novoSlideAntes}
                ocupado={fotoOcupada === 'novo-slide'}
                onSelecionar={(f) => definirFotoSlideManual('antes', f)}
                onExcluir={() => definirFotoSlideManual('antes', null)}
              />
              {novoSlideAntes && (
                <span className="text-[9px] text-emerald-600 font-bold text-center max-w-[80px] truncate">{novoSlideAntes.name}</span>
              )}
            </div>
            <div className="flex flex-col items-center gap-1">
              <SlotFoto
                rotulo="Depois"
                caminho={null}
                arquivoLocal={novoSlideDepois}
                ocupado={fotoOcupada === 'novo-slide'}
                onSelecionar={(f) => definirFotoSlideManual('depois', f)}
                onExcluir={() => definirFotoSlideManual('depois', null)}
              />
              {novoSlideDepois && (
                <span className="text-[9px] text-emerald-600 font-bold text-center max-w-[80px] truncate">{novoSlideDepois.name}</span>
              )}
            </div>
            <button
              type="button"
              onClick={iniciarOuLimparFotosSlide}
              disabled={fotoOcupada === 'novo-slide'}
              className={`h-20 inline-flex flex-col items-center justify-center gap-1 px-5 rounded-xl text-xs font-bold disabled:opacity-40 shadow-sm transition-colors ${
                novoSlideAntes && novoSlideDepois
                  ? 'bg-red-500/10 border-2 border-red-500/40 text-red-500 hover:bg-red-500/20'
                  : 'bg-brand-ocre text-white hover:bg-brand-ocre/90'
              }`}
            >
              <Camera size={18} />
              {novoSlideAntes && novoSlideDepois ? 'Excluir fotos' : 'Inserir fotos'}
            </button>
            {escolhendoSlideFoto && (
              <ModalEscolhaOrigemFoto
                key={escolhendoSlideFoto}
                origemPreferida={origemFotoEscolhida ?? undefined}
                onOrigemUsada={setOrigemFotoEscolhida}
                onEscolher={(file) => {
                  if (escolhendoSlideFoto === 'antes') {
                    setNovoSlideAntes(file);
                    setEscolhendoSlideFoto('depois');
                  } else {
                    setNovoSlideDepois(file);
                    setEscolhendoSlideFoto(null);
                  }
                }}
                onFechar={() => setEscolhendoSlideFoto(null)}
              />
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!novoSlideServico || !novoSlideAmbiente.trim() || fotoOcupada === 'novo-slide'}
              onClick={salvarNovoSlideReforma}
              className="px-4 py-2 rounded-lg bg-brand-ocre text-white text-xs font-bold disabled:opacity-40"
            >
              {fotoOcupada === 'novo-slide' ? 'Enviando…' : 'Gerar slide'}
            </button>
            <button
              type="button"
              onClick={() => {
                setNovoSlideServico(null);
                setNovoSlideAntes(null);
                setNovoSlideDepois(null);
                setNovoSlideAmbiente('');
                setNovoSlideEtapa('ANTES');
              }}
              className="px-4 py-2 rounded-lg border border-card-border text-xs font-bold text-sub"
            >
              Limpar campos
            </button>
          </div>
        </div>
      )}

      {estrutura && ehSantander && (
        <div className={secao}>
          <h3 className={tituloSecao}>{badge(6)} Criar slide</h3>
          <SeletorPersonalizado
            rotulo="Ambiente"
            placeholder="Selecione o ambiente…"
            valor={novoSlideAmbienteSant}
            opcoes={[...ambientesGlobais].sort((a, b) => a.localeCompare(b, 'pt-BR'))}
            onEscolher={(v) => setNovoSlideAmbienteSant(v)}
          />
          <div className="space-y-1">
            <label className={label}>Comentários</label>
            <textarea
              value={novoSlideComentarioSant}
              onChange={(e) => setNovoSlideComentarioSant(e.target.value)}
              className={input + ' min-h-[70px]'}
              placeholder="Repete no próximo slide por padrão — edite se mudar"
            />
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            {(['antes', 'durante', 'depois'] as const).map((lado) => {
              const arquivo = lado === 'antes' ? novoSlideAntesSant : lado === 'durante' ? novoSlideDuranteSant : novoSlideDepoisSant;
              return (
                <div key={lado} className="flex flex-col items-center gap-1">
                  <SlotFoto
                    rotulo={lado === 'antes' ? 'Antes' : lado === 'durante' ? 'Durante' : 'Depois'}
                    caminho={null}
                    arquivoLocal={arquivo}
                    ocupado={fotoOcupada === 'novo-slide'}
                    onSelecionar={(f) => definirFotoSlideManualSant(lado, f)}
                    onExcluir={() => definirFotoSlideManualSant(lado, null)}
                  />
                  {arquivo && <span className="text-[9px] text-emerald-600 font-bold text-center max-w-[80px] truncate">{arquivo.name}</span>}
                </div>
              );
            })}
            <button
              type="button"
              onClick={iniciarOuLimparFotosSlideSant}
              disabled={fotoOcupada === 'novo-slide'}
              className={`h-20 inline-flex flex-col items-center justify-center gap-1 px-5 rounded-xl text-xs font-bold disabled:opacity-40 shadow-sm transition-colors ${
                novoSlideAntesSant && novoSlideDuranteSant && novoSlideDepoisSant
                  ? 'bg-red-500/10 border-2 border-red-500/40 text-red-500 hover:bg-red-500/20'
                  : 'bg-brand-ocre text-white hover:bg-brand-ocre/90'
              }`}
            >
              <Camera size={18} />
              {novoSlideAntesSant && novoSlideDuranteSant && novoSlideDepoisSant ? 'Excluir fotos' : 'Inserir fotos'}
            </button>
            {escolhendoFotoSant && (
              <ModalEscolhaOrigemFoto
                key={escolhendoFotoSant}
                origemPreferida={origemFotoEscolhida ?? undefined}
                onOrigemUsada={setOrigemFotoEscolhida}
                onEscolher={(file) => {
                  if (escolhendoFotoSant === 'antes') {
                    setNovoSlideAntesSant(file);
                    setEscolhendoFotoSant('durante');
                  } else if (escolhendoFotoSant === 'durante') {
                    setNovoSlideDuranteSant(file);
                    setEscolhendoFotoSant('depois');
                  } else {
                    setNovoSlideDepoisSant(file);
                    setEscolhendoFotoSant(null);
                  }
                }}
                onFechar={() => setEscolhendoFotoSant(null)}
              />
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!novoSlideAmbienteSant.trim() || fotoOcupada === 'novo-slide'}
              onClick={salvarNovoSlideSantander}
              className="px-4 py-2 rounded-lg bg-brand-ocre text-white text-xs font-bold disabled:opacity-40"
            >
              {fotoOcupada === 'novo-slide' ? 'Enviando…' : 'Gerar slide'}
            </button>
            <button
              type="button"
              onClick={() => {
                setNovoSlideAmbienteSant('');
                setNovoSlideComentarioSant('');
                setNovoSlideAntesSant(null);
                setNovoSlideDuranteSant(null);
                setNovoSlideDepoisSant(null);
              }}
              className="px-4 py-2 rounded-lg border border-card-border text-xs font-bold text-sub"
            >
              Limpar campos
            </button>
          </div>
        </div>
      )}

      {estrutura && tipoProjeto === 'reforma' && botaoMontarPptx}

      {/* lista dos slides de reforma já gerados, logo abaixo da etapa 6 —
          reordenar, pré-visualizar clicando, editar ambiente/etapa, excluir */}
      {estrutura && tipoProjeto === 'reforma' && progressoReforma.length > 0 && (
        <div className={secao}>
          <h3 className={tituloSecao}>Slides gerados ({progressoReforma.length})</h3>
          <label className="flex items-center gap-2 text-[11px] font-semibold text-main cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 rounded text-brand-ocre focus:ring-brand-ocre border-card-border cursor-pointer accent-brand-ocre"
              checked={ordemAutomatica}
              onChange={(e) => {
                setOrdemAutomatica(e.target.checked);
                if (e.target.checked) persistirOrdem([...progresso].sort(compararOrdemAutomatica));
              }}
            />
            Organizar automaticamente (Ambiente → Serviço → Antes/Durante)
          </label>
          <div className="space-y-2">
            {progressoReforma.map((s) => {
              const indiceGlobal = progresso.findIndex((p) => p.id === s.id);
              const posicaoNaLista = progressoReforma.findIndex((p) => p.id === s.id);
              return (
                <div
                  key={s.id}
                  draggable
                  onDragStart={() => setArrastandoSlide(s.id)}
                  onDragEnd={() => {
                    setArrastandoSlide(null);
                    setAlvoDrag(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (alvoDrag !== s.id) setAlvoDrag(s.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    onSoltarSlide(s.id);
                  }}
                  className={`border rounded-lg bg-background transition-opacity ${
                    arrastandoSlide === s.id ? 'opacity-40' : ''
                  } ${alvoDrag === s.id && arrastandoSlide && arrastandoSlide !== s.id ? 'border-brand-ocre ring-1 ring-brand-ocre' : 'border-card-border'}`}
                >
                  <div className="flex items-center gap-3 p-2.5">
                    <span className="cursor-grab active:cursor-grabbing text-desc shrink-0 select-none" title="Arrastar para reordenar">
                      ⠿
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${slideCompleto(s) ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      title={slideCompleto(s) ? 'Fotos completas' : 'Faltam fotos'}
                    />
                    <button
                      type="button"
                      onClick={() => setPreviaIndice(indiceGlobal)}
                      title={slideCompleto(s) ? 'Ampliar slide' : 'Ver e completar foto pendente'}
                      className="hidden sm:flex gap-1 shrink-0 cursor-pointer rounded overflow-hidden"
                    >
                      {slideCompleto(s) ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={urlPublicaFoto(s.foto_antes_path!)} alt="" className="w-12 h-12 object-cover" />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={urlPublicaFoto(s.foto_depois_path!)} alt="" className="w-12 h-12 object-cover" />
                        </>
                      ) : (
                        <div className="w-[104px] h-12 rounded border border-dashed border-amber-500/50 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-amber-600 uppercase">Adicionar foto</span>
                        </div>
                      )}
                    </button>
                    <button type="button" onClick={() => setPreviaIndice(indiceGlobal)} className="min-w-0 flex-1 text-left">
                      <div className="text-xs font-bold text-main truncate">
                        {posicaoNaLista + 1}. {legendaSlide(s)}
                      </div>
                      <div className="text-[10px] text-sub">
                        {s.etapa1 === 'ANTES' ? 'Antes' : 'Durante'} → Depois
                        {!slideCompleto(s) && <span className="text-amber-600 font-bold"> · pendente</span>}
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={posicaoNaLista === 0 || ordemOcupada}
                        onClick={() => moverSlide(s.id, -1)}
                        className="text-desc hover:text-main disabled:opacity-30"
                        title="Mover pra cima"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={posicaoNaLista === progressoReforma.length - 1 || ordemOcupada}
                        onClick={() => moverSlide(s.id, 1)}
                        className="text-desc hover:text-main disabled:opacity-30"
                        title="Mover pra baixo"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlideEditando(slideEditando === s.id ? null : s.id)}
                        className="text-desc hover:text-brand-blue"
                        title="Editar ambiente/etapa"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={fotoOcupada === 'remover-' + s.id}
                        onClick={() => removerSlide(s.id)}
                        className="text-desc hover:text-red-500 disabled:opacity-30"
                        title="Remover slide"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  {slideEditando === s.id && (
                    <div className="grid grid-cols-2 gap-2 p-2.5 pt-0">
                      <select
                        value={s.ambiente ?? ''}
                        onChange={(e) => editarSlide(s.id, { ambiente: e.target.value || null })}
                        className={input}
                      >
                        <option value="">Ambiente (opcional)</option>
                        {[...ambientesGlobais].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                      <select
                        value={s.etapa1}
                        onChange={(e) => editarSlide(s.id, { etapa1: e.target.value as 'ANTES' | 'DURANTE' })}
                        className={input}
                      >
                        <option value="ANTES">Antes</option>
                        <option value="DURANTE">Durante</option>
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
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

      {estrutura && tipoProjeto === 'infraestrutura' && botaoMontarPptx}
      </div>

      {/* coluna direita — miniaturas dos slides já criados, empilhadas, na
          ordem final do PowerPoint; clicar amplia (mesma ideia de painel de
          slides do próprio PowerPoint / preview de arquivo) */}

      {estrutura && (
        <div className="hidden lg:block lg:sticky lg:top-4 space-y-3">
          <div className={secao}>
            <h3 className={tituloSecao}>
              Slides {progresso.length > 0 && <span className="text-desc normal-case font-semibold">({progresso.length})</span>}
            </h3>
            {progresso.length === 0 ? (
              <p className="text-[10px] text-sub italic">
                Nenhum slide ainda — as fotos que você enviar aparecem aqui, empilhadas na ordem final do PowerPoint.
              </p>
            ) : (
              <div className="relative">
              <div
                ref={slidesScrollRef}
                onScroll={verificarRolagem}
                className="space-y-2 max-h-[75vh] overflow-y-auto pr-1 -mr-1"
              >
                {progresso.map((s, i) => (
                  <div key={s.id} className="border border-card-border rounded-lg p-2 bg-background">
                    <button
                      type="button"
                      onClick={() => setPreviaIndice(i)}
                      title={slideCompleto(s) ? 'Ampliar slide' : 'Ver e completar foto pendente'}
                      className="flex gap-1 w-full cursor-pointer rounded overflow-hidden"
                    >
                      {slideCompleto(s) ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={urlPublicaFoto(s.foto_antes_path!)} alt="" className="w-1/2 aspect-square object-cover" />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={urlPublicaFoto(s.foto_depois_path!)} alt="" className="w-1/2 aspect-square object-cover" />
                        </>
                      ) : (
                        <div className="w-full aspect-[2/1] rounded border border-dashed border-amber-500/50 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-amber-600 uppercase">Adicionar foto</span>
                        </div>
                      )}
                    </button>
                    <div className="min-w-0 mt-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-main truncate">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${slideCompleto(s) ? 'bg-emerald-500' : 'bg-amber-500'}`} />
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
              {temMaisAbaixo && (
                <button
                  type="button"
                  onClick={() => slidesScrollRef.current?.scrollBy({ top: 200, behavior: 'smooth' })}
                  title="Mais slides abaixo"
                  className="absolute bottom-0 inset-x-0 flex items-center justify-center py-1.5 bg-gradient-to-t from-card via-card/90 to-transparent text-brand-ocre"
                >
                  <ChevronDown size={16} className="animate-bounce" />
                </button>
              )}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
      )}

      {previaIndice !== null && progresso[previaIndice] && (
        <ModalPreviaSlide
          slide={progresso[previaIndice]!}
          indice={previaIndice}
          onFechar={() => setPreviaIndice(null)}
          onEscolherFoto={(lado, file) => adicionarFotoAoSlide(progresso[previaIndice]!, lado, file)}
          ocupado={fotoOcupada === 'previa-' + progresso[previaIndice]!.id}
        />
      )}

      {modalCompartilharAberto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModalCompartilharAberto(false)}>
          <div className="bg-card border border-card-border rounded-2xl p-5 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-main flex items-center gap-2">
                <Share2 size={16} className="text-brand-ocre" /> Compartilhar relatório
              </h3>
              <button type="button" onClick={() => setModalCompartilharAberto(false)} className="text-sub hover:text-main">
                <X size={18} />
              </button>
            </div>

            <p className="text-[11px] text-sub mb-4">
              A pessoa precisa já ter uma conta cadastrada no sistema. Ela poderá {papelConvite === 'leitor' ? 'apenas visualizar' : 'editar'} este relatório.
            </p>

            {erroConvite && (
              <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-[11px]">{erroConvite}</div>
            )}

            <div className="flex items-center gap-2 mb-2">
              <input
                type="email"
                value={emailConvite}
                onChange={(e) => setEmailConvite(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') enviarConvite(); }}
                placeholder="e-mail do colaborador"
                className="flex-1 bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:ring-2 focus:ring-brand-ocre/50"
              />
              <select
                value={papelConvite}
                onChange={(e) => setPapelConvite(e.target.value as 'leitor' | 'editor' | 'admin')}
                className="bg-background border border-card-border rounded-lg px-2 py-2 text-[11px] text-main focus:outline-none"
              >
                <option value="leitor">Leitor</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="button"
              onClick={enviarConvite}
              disabled={!emailConvite.trim() || enviandoConvite}
              className="w-full flex items-center justify-center gap-1.5 bg-brand-ocre text-brand-dark font-bold text-xs py-2 rounded-lg hover:bg-brand-ocre/90 disabled:opacity-50 transition-all mb-4"
            >
              {enviandoConvite ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              {enviandoConvite ? 'Adicionando…' : 'Adicionar colaborador'}
            </button>

            <div className="border-t border-card-border pt-3">
              <h4 className="text-[10px] font-bold text-sub uppercase tracking-wider mb-2">Já têm acesso</h4>
              {carregandoColaboradores ? (
                <p className="text-[11px] text-sub">Carregando…</p>
              ) : colaboradores.length === 0 ? (
                <p className="text-[11px] text-sub">Ninguém além de você ainda.</p>
              ) : (
                <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                  {colaboradores.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 bg-background border border-card-border/70 rounded-lg px-2.5 py-1.5">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-main truncate">{c.nome || c.email}</div>
                        <div className="text-[10px] text-sub truncate">{c.email} · {c.papel}</div>
                      </div>
                      <button type="button" onClick={() => removerConvite(c.id)} className="text-red-500 hover:text-red-400 shrink-0" title="Remover acesso">
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
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
