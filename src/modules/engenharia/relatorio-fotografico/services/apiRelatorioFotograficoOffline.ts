/**
 * Camada offline-aware por cima de apiRelatorioFotografico.ts: tenta a
 * chamada real no Supabase; se falhar por rede (ou o navegador já estiver
 * offline), grava localmente (IndexedDB, ver offlineStore.ts) e enfileira
 * a operação pra replicar depois — ver sincronizadorOffline.ts. Escopo:
 * relatórios AVULSOS (sem vínculo a projeto) — criar/editar um relatório
 * vinculado a projeto corporativo continua exigindo rede pra buscar o
 * projeto em si.
 *
 * `export *` reexporta tudo de apiRelatorioFotografico.ts inalterado; as
 * funções redeclaradas abaixo sobrescrevem só o necessário — em ESM, uma
 * exportação nomeada local tem precedência sobre o `export *` do mesmo nome.
 */
import * as api from "./apiRelatorioFotografico";
import type { DadosNovaEstrutura, DadosNovoProgresso } from "./apiRelatorioFotografico";
import { limpaNome } from "../calc";
import type { EstruturaFotografica, ProgressoSlide } from "../types";
import {
  ehIdLocal,
  enfileirar,
  gerarIdLocal,
  lerCatalogoCache,
  lerEstruturaCache,
  listarEstruturasCache,
  listarFotosLocais,
  listarProgressoCachePorRelatorio,
  removerFotoLocal,
  removerProgressoCache,
  salvarCatalogoCache,
  salvarEstruturaCache,
  salvarFotoLocal,
  salvarProgressoCache,
} from "@/shared/lib/offlineStore";

export * from "./apiRelatorioFotografico";

/** Object URLs das fotos ainda não enviadas — `urlPublicaFoto` é síncrona (usada direto em `src={...}`), então mantemos isso em memória. */
const urlsFotosLocais = new Map<string, string>();

function pareceErroDeRede(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /fetch|network|failed to fetch/i.test(msg);
}

/** Chamar uma vez no boot (ver useSincronizacaoOffline) — recria as object URLs das fotos pendentes salvas em sessões anteriores. */
export async function prepararFotosLocaisEmMemoria(): Promise<void> {
  const fotos = await listarFotosLocais();
  for (const f of fotos) {
    if (!urlsFotosLocais.has(f.caminho)) urlsFotosLocais.set(f.caminho, URL.createObjectURL(f.blob));
  }
}

export function urlPublicaFoto(caminho: string): string {
  if (ehIdLocal(caminho)) return urlsFotosLocais.get(caminho) || "";
  return api.urlPublicaFoto(caminho);
}

export async function uploadFotoRelatorio(relatorioId: string, segmento: string[], file: File): Promise<string> {
  if (!ehIdLocal(relatorioId)) {
    try {
      return await api.uploadFotoRelatorio(relatorioId, segmento, file);
    } catch (e) {
      if (!pareceErroDeRede(e)) throw e;
    }
  }
  const caminhoLocal = `${gerarIdLocal()}-${file.name}`;
  await salvarFotoLocal(caminhoLocal, file, file.type || "image/jpeg", segmento);
  urlsFotosLocais.set(caminhoLocal, URL.createObjectURL(file));
  return caminhoLocal;
}

export async function excluirFotoRelatorio(caminho: string): Promise<void> {
  if (ehIdLocal(caminho)) {
    const url = urlsFotosLocais.get(caminho);
    if (url) URL.revokeObjectURL(url);
    urlsFotosLocais.delete(caminho);
    await removerFotoLocal(caminho);
    return;
  }
  try {
    await api.excluirFotoRelatorio(caminho);
  } catch (e) {
    if (!pareceErroDeRede(e)) throw e;
    // offline apagando uma foto já sincronizada — melhor deixar órfã no Storage do que travar o fluxo do usuário
  }
}

export async function criarEstrutura(dados: DadosNovaEstrutura): Promise<EstruturaFotografica> {
  try {
    const nova = await api.criarEstrutura(dados);
    await salvarEstruturaCache(nova);
    return nova;
  } catch (e) {
    if (!pareceErroDeRede(e)) throw e;
  }
  const agora = new Date().toISOString();
  const localId = gerarIdLocal();
  const registro: EstruturaFotografica = {
    id: localId,
    projeto_id: dados.projetoId,
    user_id: dados.userId,
    is_avulso: dados.isAvulso,
    obra_nome: dados.obraNome,
    tipo_projeto: dados.tipoProjeto,
    banco: dados.banco,
    modelo_relatorio: dados.modeloRelatorio,
    equipamentos: [],
    servicos_habilitados: [],
    ambientes_ordem: [],
    agencia: dados.agencia ?? null,
    programa: dados.programa ?? null,
    upe: dados.upe ?? null,
    sap: dados.sap ?? null,
    gestor: dados.gestor ?? null,
    fiscalizacao_empresa: dados.fiscalizacao_empresa ?? null,
    fiscal: dados.fiscal ?? null,
    construtora: dados.construtora ?? null,
    responsavel: dados.responsavel ?? null,
    data_inicio_obra: dados.data_inicio_obra ?? null,
    data_termino_obra: dados.data_termino_obra ?? null,
    created_at: agora,
    updated_at: agora,
  };
  await salvarEstruturaCache(registro);
  await enfileirar("criar_estrutura", { localId, dados });
  return registro;
}

export async function atualizarEstrutura(id: string, patch: Partial<EstruturaFotografica>): Promise<EstruturaFotografica> {
  if (!ehIdLocal(id)) {
    try {
      const atualizada = await api.atualizarEstrutura(id, patch);
      await salvarEstruturaCache(atualizada);
      return atualizada;
    } catch (e) {
      if (!pareceErroDeRede(e)) throw e;
    }
  }
  const atual = await lerEstruturaCache<EstruturaFotografica>(id);
  if (!atual) throw new Error("Relatório não encontrado localmente.");
  const mesclada: EstruturaFotografica = { ...atual, ...patch, updated_at: new Date().toISOString() };
  await salvarEstruturaCache(mesclada);
  await enfileirar("atualizar_estrutura", { id, patch });
  return mesclada;
}

export async function obterEstrutura(id: string): Promise<EstruturaFotografica | null> {
  if (ehIdLocal(id)) return lerEstruturaCache<EstruturaFotografica>(id);
  try {
    const remota = await api.obterEstrutura(id);
    if (remota) await salvarEstruturaCache(remota);
    return remota;
  } catch (e) {
    if (!pareceErroDeRede(e)) throw e;
    return lerEstruturaCache<EstruturaFotografica>(id);
  }
}

export async function listarRelatoriosDoUsuario(userId: string): Promise<EstruturaFotografica[]> {
  let remotos: EstruturaFotografica[] = [];
  try {
    remotos = await api.listarRelatoriosDoUsuario(userId);
    for (const r of remotos) await salvarEstruturaCache(r);
  } catch (e) {
    if (!pareceErroDeRede(e)) throw e;
  }
  const todosCache = await listarEstruturasCache<EstruturaFotografica>();
  const pendentesLocais = todosCache.filter((e) => ehIdLocal(e.id) && e.user_id === userId);
  const mapa = new Map<string, EstruturaFotografica>();
  for (const r of remotos) mapa.set(r.id, r);
  for (const p of pendentesLocais) mapa.set(p.id, p);
  return Array.from(mapa.values()).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

/* ---------- serviços/equipamentos habilitados no relatório ---------- */

export async function habilitarServico(estruturaId: string, nome: string): Promise<EstruturaFotografica> {
  const limpo = limpaNome(nome).toUpperCase();
  if (!limpo) throw new Error("Nome do serviço vazio.");
  // registro do nome no catálogo global fica de fora offline — não bloqueia o
  // relatório atual, só significa que o nome não aparece como sugestão em
  // outros relatórios até alguém repetir o mesmo nome já online
  if (!ehIdLocal(estruturaId)) {
    try {
      await api.habilitarServico(estruturaId, nome);
    } catch (e) {
      if (!pareceErroDeRede(e)) throw e;
    }
  }
  const atual = await obterEstrutura(estruturaId);
  if (!atual) throw new Error("Relatório não encontrado.");
  if (atual.servicos_habilitados.includes(limpo)) return atual;
  return atualizarEstrutura(estruturaId, { servicos_habilitados: [...atual.servicos_habilitados, limpo] });
}

export async function desabilitarServico(estruturaId: string, nome: string): Promise<EstruturaFotografica> {
  const atual = await obterEstrutura(estruturaId);
  if (!atual) throw new Error("Relatório não encontrado.");
  return atualizarEstrutura(estruturaId, { servicos_habilitados: atual.servicos_habilitados.filter((s) => s !== nome) });
}

export async function atualizarEquipamentos(estruturaId: string, equipamentos: EstruturaFotografica["equipamentos"]): Promise<EstruturaFotografica> {
  return atualizarEstrutura(estruturaId, { equipamentos });
}

/* ---------- catálogos globais (banco/serviço/ambiente) — cache local pra ter opções offline ---------- */

async function comCacheCatalogo(chave: string, buscar: () => Promise<string[]>): Promise<string[]> {
  try {
    const valores = await buscar();
    await salvarCatalogoCache(chave, valores);
    return valores;
  } catch (e) {
    if (!pareceErroDeRede(e)) throw e;
    return lerCatalogoCache(chave);
  }
}

export const lerBancosCatalogo = () => comCacheCatalogo("bancos", api.lerBancosCatalogo);
export const lerServicosGlobais = () => comCacheCatalogo("servicos", api.lerServicosGlobais);
export const lerAmbientesGlobais = () => comCacheCatalogo("ambientes", api.lerAmbientesGlobais);

/* ---------- fotos e progresso (slides antes/depois) ---------- */

export async function listarProgresso(relatorioId: string): Promise<ProgressoSlide[]> {
  let remotos: ProgressoSlide[] = [];
  if (!ehIdLocal(relatorioId)) {
    try {
      remotos = await api.listarProgresso(relatorioId);
      for (const r of remotos) await salvarProgressoCache(r);
    } catch (e) {
      if (!pareceErroDeRede(e)) throw e;
    }
  }
  const cacheados = await listarProgressoCachePorRelatorio<ProgressoSlide>(relatorioId);
  const mapa = new Map<string, ProgressoSlide>();
  for (const r of remotos) mapa.set(r.id, r);
  for (const c of cacheados) mapa.set(c.id, c); // cache é sempre a versão mais recente conhecida localmente
  return Array.from(mapa.values()).sort((a, b) => a.ordem - b.ordem);
}

export async function criarProgresso(relatorioId: string, dados: DadosNovoProgresso): Promise<ProgressoSlide> {
  if (!ehIdLocal(relatorioId)) {
    try {
      const novo = await api.criarProgresso(relatorioId, dados);
      await salvarProgressoCache(novo);
      return novo;
    } catch (e) {
      if (!pareceErroDeRede(e)) throw e;
    }
  }
  const agora = new Date().toISOString();
  const localId = gerarIdLocal();
  const existentes = await listarProgressoCachePorRelatorio<ProgressoSlide>(relatorioId);
  const ordem = existentes.length ? Math.max(...existentes.map((p) => p.ordem)) + 1 : 0;
  const registro: ProgressoSlide = {
    id: localId,
    relatorio_id: relatorioId,
    ordem,
    servico: dados.servico ?? null,
    ambiente: dados.ambiente ?? null,
    equipamento: dados.equipamento ?? null,
    numero_ponto: dados.numeroPonto ?? null,
    local: dados.local ?? null,
    etapa1: dados.etapa1,
    foto_antes_path: dados.fotoAntesPath,
    foto_depois_path: dados.fotoDepoisPath,
    created_at: agora,
  };
  await salvarProgressoCache(registro);
  await enfileirar("criar_progresso", { localId, relatorioId, dados });
  return registro;
}

export async function atualizarProgresso(
  id: string,
  patch: Partial<Pick<ProgressoSlide, "servico" | "ambiente" | "equipamento" | "numero_ponto" | "local" | "etapa1" | "foto_antes_path" | "foto_depois_path">>
): Promise<ProgressoSlide> {
  if (!ehIdLocal(id)) {
    try {
      const atualizado = await api.atualizarProgresso(id, patch);
      await salvarProgressoCache(atualizado);
      return atualizado;
    } catch (e) {
      if (!pareceErroDeRede(e)) throw e;
    }
  }
  const { lerProgressoCache } = await import("@/shared/lib/offlineStore");
  const atual = await lerProgressoCache<ProgressoSlide>(id);
  if (!atual) throw new Error("Slide não encontrado localmente.");
  const mesclado: ProgressoSlide = { ...atual, ...patch };
  await salvarProgressoCache(mesclado);
  await enfileirar("atualizar_progresso", { id, patch });
  return mesclado;
}

export async function excluirProgresso(id: string): Promise<void> {
  if (ehIdLocal(id)) {
    await removerProgressoCache(id);
    // nunca existiu no servidor — cancela a criação enfileirada em vez de empilhar uma exclusão
    const { listarFila, removerDaFila } = await import("@/shared/lib/offlineStore");
    const fila = await listarFila();
    const opCriacao = fila.find((o) => o.tipo === "criar_progresso" && (o.payload as { localId?: string }).localId === id);
    if (opCriacao) await removerDaFila(opCriacao.id);
    return;
  }
  try {
    await api.excluirProgresso(id);
    await removerProgressoCache(id);
  } catch (e) {
    if (!pareceErroDeRede(e)) throw e;
    await removerProgressoCache(id);
    await enfileirar("excluir_progresso", { id });
  }
}
