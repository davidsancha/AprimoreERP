import { supabase } from "@/shared/lib/supabaseClient";
import { atualizarCamposEngenharia } from "@/modules/operacional/services/apiProjetos";
import { caminhoStorage, limpaNome } from "../calc";
import type {
  CamposObraProjeto,
  Equipamento,
  EstruturaFotografica,
  FiltrosBuscaProjeto,
  ModeloRelatorioOpcao,
  ProgressoSlide,
  ProjetoResumo,
  TipoProjetoFotografico,
} from "../types";

const BUCKET_FOTOS = "relatorios-fotograficos";

const CAMPOS_PROJETO_RESUMO =
  "id, nome, os, tipologia, status, data_prevista_inicio, data_prevista_termino, data_efetiva_inicio, data_efetiva_termino, cliente_final_id, agencia, upe, sap, gestor, fiscalizacao_empresa, fiscal, construtora, responsavel";

async function resolverNomesClientes(sb: ReturnType<typeof exigirSupabase>, ids: (string | null)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter(Boolean))] as string[];
  const nomesPorId = new Map<string, string>();
  if (!unicos.length) return nomesPorId;
  const { data, error } = await sb.from("crm_clientes").select("id, nome").in("id", unicos);
  if (error) throw error;
  for (const c of data || []) nomesPorId.set(c.id, c.nome);
  return nomesPorId;
}

function paraProjetoResumo(p: any, nomesPorId: Map<string, string>): ProjetoResumo {
  return {
    id: p.id,
    nome: p.nome,
    os: p.os,
    tipologia: p.tipologia,
    status: p.status,
    data_prevista_inicio: p.data_prevista_inicio,
    data_prevista_termino: p.data_prevista_termino,
    data_efetiva_inicio: p.data_efetiva_inicio,
    data_efetiva_termino: p.data_efetiva_termino,
    cliente_final_id: p.cliente_final_id,
    cliente_final_nome: p.cliente_final_id ? nomesPorId.get(p.cliente_final_id) ?? null : null,
    agencia: p.agencia ?? null,
    upe: p.upe ?? null,
    sap: p.sap ?? null,
    gestor: p.gestor ?? null,
    fiscalizacao_empresa: p.fiscalizacao_empresa ?? null,
    fiscal: p.fiscal ?? null,
    construtora: p.construtora ?? null,
    responsavel: p.responsavel ?? null,
  };
}

function exigirSupabase() {
  if (!supabase) throw new Error("Supabase client não inicializado.");
  return supabase;
}

/**
 * Busca projetos por nome ou OS, com o nome do cliente final (~banco)
 * resolvido à parte — `cliente_final_id` existe na tabela `projetos` mas
 * não achei o ALTER TABLE dele em nenhuma migration rastreada (só em
 * src/modules/operacional/types.ts e apiProjetos.ts). Pode ter sido
 * adicionado direto no painel do Supabase. Por segurança, evito depender
 * do nome exato da FK (`tabela!nome_da_fk(coluna)`) e resolvo em duas
 * consultas — funciona independente de como a constraint foi nomeada.
 */
export async function buscarProjetos(termo: string): Promise<ProjetoResumo[]> {
  const sb = exigirSupabase();
  const query = sb.from("projetos").select(CAMPOS_PROJETO_RESUMO).order("created_at", { ascending: false }).limit(20);

  const { data, error } = termo.trim() ? await query.or(`nome.ilike.%${termo}%,os.ilike.%${termo}%`) : await query;
  if (error) throw error;

  const projetos = data || [];
  const nomesPorId = await resolverNomesClientes(sb, projetos.map((p) => p.cliente_final_id));
  return projetos.map((p) => paraProjetoResumo(p, nomesPorId));
}

/**
 * Lista ampliada para o modal "ver todos os projetos" — filtra por texto,
 * cliente final e/ou status, sem o limite de 20 do autocomplete.
 */
export async function buscarProjetosComFiltros(filtros: FiltrosBuscaProjeto): Promise<ProjetoResumo[]> {
  const sb = exigirSupabase();
  let query = sb.from("projetos").select(CAMPOS_PROJETO_RESUMO).order("nome", { ascending: true }).limit(200);

  if (filtros.texto?.trim()) query = query.or(`nome.ilike.%${filtros.texto}%,os.ilike.%${filtros.texto}%`);
  if (filtros.clienteFinalId) query = query.eq("cliente_final_id", filtros.clienteFinalId);
  if (filtros.status) query = query.eq("status", filtros.status);

  const { data, error } = await query;
  if (error) throw error;

  const projetos = data || [];
  const nomesPorId = await resolverNomesClientes(sb, projetos.map((p) => p.cliente_final_id));
  return projetos.map((p) => paraProjetoResumo(p, nomesPorId));
}

/** Clientes finais distintos já usados em projetos — para o filtro "Banco/Cliente final" do modal de busca. */
export async function listarClientesFinaisUsados(): Promise<{ id: string; nome: string }[]> {
  const sb = exigirSupabase();
  const { data, error } = await sb.from("projetos").select("cliente_final_id").not("cliente_final_id", "is", null);
  if (error) throw error;
  const ids = [...new Set((data || []).map((p) => p.cliente_final_id))] as string[];
  if (!ids.length) return [];
  const { data: clientes, error: errClientes } = await sb.from("crm_clientes").select("id, nome").in("id", ids).order("nome");
  if (errClientes) throw errClientes;
  return clientes || [];
}

/* ---------- catálogo de bancos e modelos de relatório (migration 00011) ---------- */

export async function lerBancosCatalogo(): Promise<string[]> {
  const sb = exigirSupabase();
  const { data, error } = await sb.from("engenharia_bancos_catalogo").select("nome").order("nome");
  if (error) throw error;
  return (data || []).map((r) => r.nome);
}

/** Modelos disponíveis para um banco — a tela filtra também por tipo de projeto (infra/reforma) no cliente. */
export async function lerModelosPorBanco(banco: string): Promise<ModeloRelatorioOpcao[]> {
  const sb = exigirSupabase();
  const { data, error } = await sb.from("engenharia_modelos_relatorio").select("*").eq("banco", banco).order("nome");
  if (error) throw error;
  return data || [];
}

/**
 * Grava os campos de obra (agência, UPE, SAP, gestor, fiscalização,
 * construtora, responsável) direto na tabela `projetos` — fonte única
 * dessa informação para toda a empresa quando o relatório está vinculado
 * a um projeto oficial. Só usada quando NÃO é avulso (avulso não tem
 * projeto_id, guarda esses campos na própria engenharia_estrutura_fotografica).
 */
export async function atualizarCamposProjeto(
  projetoId: string,
  campos: CamposObraProjeto & { data_efetiva_inicio?: string | null; data_efetiva_termino?: string | null }
): Promise<void> {
  await atualizarCamposEngenharia(projetoId, {
    agencia: campos.agencia,
    upe: campos.upe,
    sap: campos.sap,
    gestor: campos.gestor,
    fiscalizacao_empresa: campos.fiscalizacao_empresa,
    fiscal: campos.fiscal,
    construtora: campos.construtora,
    responsavel: campos.responsavel,
    ...(campos.data_efetiva_inicio !== undefined ? { data_efetiva_inicio: campos.data_efetiva_inicio } : {}),
    ...(campos.data_efetiva_termino !== undefined ? { data_efetiva_termino: campos.data_efetiva_termino } : {}),
  });
}

export async function obterEstruturaPorProjeto(projetoId: string): Promise<EstruturaFotografica | null> {
  const sb = exigirSupabase();
  const { data, error } = await sb.from("engenharia_estrutura_fotografica").select("*").eq("projeto_id", projetoId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function obterEstrutura(id: string): Promise<EstruturaFotografica | null> {
  const sb = exigirSupabase();
  const { data, error } = await sb.from("engenharia_estrutura_fotografica").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Relatórios que o usuário criou OU dos quais participa como colaborador
 * (Cowork, migration 00014/00015) — base do "Meus Relatórios" do Parceiro
 * EGF. Duas consultas simples + merge no cliente em vez de um OR/join
 * complexo, porque a RLS de `engenharia_relatorio_colaboradores` já resolve
 * a visibilidade — aqui só precisamos juntar os dois conjuntos de ids.
 */
export async function listarRelatoriosDoUsuario(userId: string): Promise<EstruturaFotografica[]> {
  const sb = exigirSupabase();
  const [proprios, colaboracoes] = await Promise.all([
    sb.from("engenharia_estrutura_fotografica").select("*").eq("user_id", userId),
    sb.from("engenharia_relatorio_colaboradores").select("relatorio_id").eq("user_id", userId),
  ]);
  if (proprios.error) throw proprios.error;
  if (colaboracoes.error) throw colaboracoes.error;

  const idsCompartilhados = (colaboracoes.data || []).map((c) => c.relatorio_id);
  const idsProprios = new Set((proprios.data || []).map((r) => r.id));
  const idsFaltantes = idsCompartilhados.filter((id) => !idsProprios.has(id));

  let compartilhados: EstruturaFotografica[] = [];
  if (idsFaltantes.length) {
    const { data, error } = await sb.from("engenharia_estrutura_fotografica").select("*").in("id", idsFaltantes);
    if (error) throw error;
    compartilhados = data || [];
  }

  return [...(proprios.data || []), ...compartilhados].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

/* ---------- Cowork: compartilhamento de relatório (migration 00015) ---------- */

export interface ColaboradorRelatorio {
  id: string;
  relatorio_id: string;
  user_id: string;
  papel: "leitor" | "editor" | "admin";
  nome: string;
  email: string;
}

export async function listarColaboradores(relatorioId: string): Promise<ColaboradorRelatorio[]> {
  const sb = exigirSupabase();
  const { data, error } = await sb.rpc("listar_colaboradores_relatorio", { p_relatorio_id: relatorioId });
  if (error) throw error;
  return data || [];
}

export async function adicionarColaborador(
  relatorioId: string,
  email: string,
  papel: "leitor" | "editor" | "admin" = "editor"
): Promise<ColaboradorRelatorio> {
  const sb = exigirSupabase();
  const { data, error } = await sb.rpc("adicionar_colaborador_relatorio", {
    p_relatorio_id: relatorioId,
    p_email: email,
    p_papel: papel,
  });
  if (error) throw error;
  return data[0];
}

export async function removerColaborador(colaboradorId: string): Promise<void> {
  const sb = exigirSupabase();
  const { error } = await sb.rpc("remover_colaborador_relatorio", { p_colaborador_id: colaboradorId });
  if (error) throw error;
}

export interface DadosNovaEstrutura extends Partial<CamposObraProjeto> {
  projetoId: string | null; // null quando avulso
  userId: string | null;
  isAvulso: boolean;
  obraNome: string | null;
  tipoProjeto: TipoProjetoFotografico;
  banco: string | null;
  modeloRelatorio: string | null;
  agencia?: string | null;
  programa?: string | null;
  data_inicio_obra?: string | null;
  data_termino_obra?: string | null;
}

export async function criarEstrutura(dados: DadosNovaEstrutura): Promise<EstruturaFotografica> {
  const sb = exigirSupabase();
  const { data, error } = await sb
    .from("engenharia_estrutura_fotografica")
    .insert([
      {
        projeto_id: dados.projetoId,
        user_id: dados.userId,
        is_avulso: dados.isAvulso,
        obra_nome: dados.obraNome,
        tipo_projeto: dados.tipoProjeto,
        banco: dados.banco,
        modelo_relatorio: dados.modeloRelatorio,
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
        equipamentos: [],
        servicos_habilitados: [],
      },
    ])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function atualizarEstrutura(id: string, patch: Partial<EstruturaFotografica>): Promise<EstruturaFotografica> {
  const sb = exigirSupabase();
  const { data, error } = await sb
    .from("engenharia_estrutura_fotografica")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ---------- catálogo global de serviços/ambientes ---------- */

export async function lerServicosGlobais(): Promise<string[]> {
  const sb = exigirSupabase();
  const { data, error } = await sb.from("engenharia_servicos_catalogo").select("nome").order("nome");
  if (error) throw error;
  return (data || []).map((r) => r.nome);
}

export async function lerAmbientesGlobais(): Promise<string[]> {
  const sb = exigirSupabase();
  const { data, error } = await sb.from("engenharia_ambientes_catalogo").select("nome").order("nome");
  if (error) throw error;
  return (data || []).map((r) => r.nome);
}

export async function adicionarAmbienteGlobal(nome: string): Promise<void> {
  const sb = exigirSupabase();
  const limpo = limpaNome(nome).toUpperCase();
  if (!limpo) return;
  const { error } = await sb.from("engenharia_ambientes_catalogo").upsert({ nome: limpo });
  if (error) throw error;
}

export async function removerAmbienteGlobal(nome: string): Promise<void> {
  const sb = exigirSupabase();
  const { error } = await sb.from("engenharia_ambientes_catalogo").delete().eq("nome", nome);
  if (error) throw error;
}

/* ---------- serviços habilitados por relatório (reforma) ---------- */

/** Marcar cria/garante o nome no catálogo global e habilita no relatório atual — nunca cria pasta, Storage não precisa. */
export async function habilitarServico(estruturaId: string, nome: string): Promise<EstruturaFotografica> {
  const sb = exigirSupabase();
  const limpo = limpaNome(nome).toUpperCase();
  if (!limpo) throw new Error("Nome do serviço vazio.");

  await sb.from("engenharia_servicos_catalogo").upsert({ nome: limpo });

  const atual = await obterEstrutura(estruturaId);
  if (!atual) throw new Error("Relatório não encontrado.");
  if (atual.servicos_habilitados.includes(limpo)) return atual;

  return atualizarEstrutura(estruturaId, { servicos_habilitados: [...atual.servicos_habilitados, limpo] });
}

/** Desabilitar só tira da lista deste relatório — nunca apaga o nome do catálogo global nem fotos já enviadas. */
export async function desabilitarServico(estruturaId: string, nome: string): Promise<EstruturaFotografica> {
  const atual = await obterEstrutura(estruturaId);
  if (!atual) throw new Error("Relatório não encontrado.");
  return atualizarEstrutura(estruturaId, { servicos_habilitados: atual.servicos_habilitados.filter((s) => s !== nome) });
}

export async function atualizarEquipamentos(estruturaId: string, equipamentos: Equipamento[]): Promise<EstruturaFotografica> {
  return atualizarEstrutura(estruturaId, { equipamentos });
}

export async function buscarProjetoPorId(id: string): Promise<ProjetoResumo | null> {
  const sb = exigirSupabase();
  const { data: p, error } = await sb.from("projetos").select(CAMPOS_PROJETO_RESUMO).eq("id", id).single();
  if (error || !p) return null;
  const nomesPorId = await resolverNomesClientes(sb, [p.cliente_final_id]);
  return paraProjetoResumo(p, nomesPorId);
}

/* ---------- fotos e progresso (slides antes/depois) ---------- */

/**
 * Normalização/corte/compressão real da foto acontece só na hora de montar
 * o PowerPoint (lib/imagem.ts), igual ao app de referência — aqui é upload
 * puro do arquivo original pro Storage, sem reprocessar.
 */
export async function uploadFotoRelatorio(relatorioId: string, segmento: string[], file: File): Promise<string> {
  const sb = exigirSupabase();
  const extensao = (file.name.split(".").pop() || "jpg").toLowerCase();
  const nomeArquivo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao}`;
  const caminho = caminhoStorage(relatorioId, segmento, nomeArquivo);
  const { error } = await sb.storage.from(BUCKET_FOTOS).upload(caminho, file, { contentType: file.type || undefined });
  if (error) throw error;
  return caminho;
}

/** Bucket é público (migration 00008) — resolve o caminho salvo pra uma URL exibível. */
export function urlPublicaFoto(caminho: string): string {
  const sb = exigirSupabase();
  return sb.storage.from(BUCKET_FOTOS).getPublicUrl(caminho).data.publicUrl;
}

export async function excluirFotoRelatorio(caminho: string): Promise<void> {
  const sb = exigirSupabase();
  const { error } = await sb.storage.from(BUCKET_FOTOS).remove([caminho]);
  if (error) throw error;
}

export async function listarProgresso(relatorioId: string): Promise<ProgressoSlide[]> {
  const sb = exigirSupabase();
  const { data, error } = await sb
    .from("engenharia_progresso_relatorio")
    .select("*")
    .eq("relatorio_id", relatorioId)
    .order("ordem", { ascending: true });
  if (error) throw error;
  return data || [];
}

export interface DadosNovoProgresso {
  servico?: string | null;
  ambiente?: string | null;
  equipamento?: string | null;
  numeroPonto?: string | null;
  local?: string | null;
  etapa1: "ANTES" | "DURANTE";
  // null = pendente (migration 00013) — serviço/ambiente valem sozinhos, a
  // foto pode ser enviada depois; só bloqueia montar o PowerPoint.
  fotoAntesPath: string | null;
  fotoDepoisPath: string | null;
}

/** Adiciona ao fim da lista — `ordem` é sempre o próximo índice livre. */
export async function criarProgresso(relatorioId: string, dados: DadosNovoProgresso): Promise<ProgressoSlide> {
  const sb = exigirSupabase();
  const atuais = await listarProgresso(relatorioId);
  const proximaOrdem = atuais.length ? Math.max(...atuais.map((p) => p.ordem)) + 1 : 0;
  const { data, error } = await sb
    .from("engenharia_progresso_relatorio")
    .insert([
      {
        relatorio_id: relatorioId,
        ordem: proximaOrdem,
        servico: dados.servico ?? null,
        ambiente: dados.ambiente ?? null,
        equipamento: dados.equipamento ?? null,
        numero_ponto: dados.numeroPonto ?? null,
        local: dados.local ?? null,
        etapa1: dados.etapa1,
        foto_antes_path: dados.fotoAntesPath,
        foto_depois_path: dados.fotoDepoisPath,
      },
    ])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function atualizarProgresso(
  id: string,
  patch: Partial<Pick<ProgressoSlide, "servico" | "ambiente" | "equipamento" | "numero_ponto" | "local" | "etapa1" | "foto_antes_path" | "foto_depois_path">>,
): Promise<ProgressoSlide> {
  const sb = exigirSupabase();
  const { data, error } = await sb.from("engenharia_progresso_relatorio").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function excluirProgresso(id: string): Promise<void> {
  const sb = exigirSupabase();
  const { error } = await sb.from("engenharia_progresso_relatorio").delete().eq("id", id);
  if (error) throw error;
}

/** Grava a nova ordem (0..n-1) na sequência exata dos ids recebidos — usado no reordenar por arrastar/mover. */
export async function reordenarProgresso(ids: string[]): Promise<void> {
  const sb = exigirSupabase();
  await Promise.all(ids.map((id, ordem) => sb.from("engenharia_progresso_relatorio").update({ ordem }).eq("id", id)));
}
