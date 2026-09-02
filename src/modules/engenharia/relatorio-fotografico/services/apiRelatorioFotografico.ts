import { supabase } from "@/shared/lib/supabaseClient";
import { atualizarCamposEngenharia } from "@/modules/operacional/services/apiProjetos";
import { limpaNome } from "../calc";
import type { CamposObraProjeto, Equipamento, EstruturaFotografica, ProjetoResumo, TipoProjetoFotografico } from "../types";

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
  const query = sb
    .from("projetos")
    .select(
      "id, nome, os, tipologia, data_prevista_inicio, data_prevista_termino, cliente_final_id, agencia, upe, sap, gestor, fiscalizacao_empresa, fiscal, construtora, responsavel",
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const { data, error } = termo.trim() ? await query.or(`nome.ilike.%${termo}%,os.ilike.%${termo}%`) : await query;
  if (error) throw error;

  const projetos = data || [];
  const idsClientesFinais = [...new Set(projetos.map((p) => p.cliente_final_id).filter(Boolean))] as string[];
  const nomesPorId = new Map<string, string>();
  if (idsClientesFinais.length) {
    const { data: clientes, error: errClientes } = await sb.from("crm_clientes").select("id, nome").in("id", idsClientesFinais);
    if (errClientes) throw errClientes;
    for (const c of clientes || []) nomesPorId.set(c.id, c.nome);
  }

  return projetos.map((p) => ({
    id: p.id,
    nome: p.nome,
    os: p.os,
    tipologia: p.tipologia,
    data_prevista_inicio: p.data_prevista_inicio,
    data_prevista_termino: p.data_prevista_termino,
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
  }));
}

/**
 * Grava os campos de obra (agência, UPE, SAP, gestor, fiscalização,
 * construtora, responsável) direto na tabela `projetos` — fonte única
 * dessa informação para toda a empresa quando o relatório está vinculado
 * a um projeto oficial. Só usada quando NÃO é avulso (avulso não tem
 * projeto_id, guarda esses campos na própria engenharia_estrutura_fotografica).
 */
export async function atualizarCamposProjeto(projetoId: string, campos: CamposObraProjeto): Promise<void> {
  await atualizarCamposEngenharia(projetoId, {
    agencia: campos.agencia,
    upe: campos.upe,
    sap: campos.sap,
    gestor: campos.gestor,
    fiscalizacao_empresa: campos.fiscalizacao_empresa,
    fiscal: campos.fiscal,
    construtora: campos.construtora,
    responsavel: campos.responsavel,
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

export interface DadosNovaEstrutura {
  projetoId: string | null; // null quando avulso
  userId: string | null;
  isAvulso: boolean;
  obraNome: string | null;
  tipoProjeto: TipoProjetoFotografico;
  banco: string | null;
  modeloRelatorio: string | null;
  agencia?: string | null;
  programa?: string | null;
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

/* ---------- equipamentos/pontos (infraestrutura) ---------- */

export async function atualizarEquipamentos(estruturaId: string, equipamentos: Equipamento[]): Promise<EstruturaFotografica> {
  return atualizarEstrutura(estruturaId, { equipamentos });
}
