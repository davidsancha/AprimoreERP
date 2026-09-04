/**
 * Processa a fila de operações offline (ver offlineStore.ts) contra o
 * Supabase de verdade, na ordem em que foram criadas. Usa `api` (a camada
 * SEM fallback offline) diretamente — nunca a wrapper offline-aware —
 * pra não reenfileirar em cima de si mesmo.
 */
import * as api from "./apiRelatorioFotografico";
import type { DadosNovaEstrutura, DadosNovoProgresso } from "./apiRelatorioFotografico";
import type { EstruturaFotografica, ProgressoSlide } from "../types";
import {
  ehIdLocal,
  lerEstruturaCache,
  lerFotoLocal,
  lerProgressoCache,
  listarFila,
  listarProgressoCachePorRelatorio,
  removerDaFila,
  removerEstruturaCache,
  removerFotoLocal,
  removerProgressoCache,
  salvarEstruturaCache,
  salvarProgressoCache,
  type OperacaoOffline,
} from "@/shared/lib/offlineStore";

let sincronizando = false;
let mapaIds: Record<string, string> = {};

function resolverId(id: string): string {
  return mapaIds[id] ?? id;
}

async function migrarEstruturaLocal(localId: string, realId: string): Promise<void> {
  mapaIds[localId] = realId;
  await removerEstruturaCache(localId);
  const progressos = await listarProgressoCachePorRelatorio<ProgressoSlide>(localId);
  for (const p of progressos) {
    await removerProgressoCache(p.id);
    await salvarProgressoCache({ ...p, relatorio_id: realId });
  }
}

async function resolverCaminhoFoto(relatorioIdReal: string, caminho: string | null): Promise<string | null> {
  if (!caminho || !ehIdLocal(caminho)) return caminho;
  const local = await lerFotoLocal(caminho);
  if (!local) return null; // blob sumiu (ex. app reinstalado) — segue sem travar o resto da sincronização
  const file = new File([local.blob], caminho, { type: local.mimeType });
  const caminhoReal = await api.uploadFotoRelatorio(relatorioIdReal, local.segmento, file);
  await removerFotoLocal(caminho);
  return caminhoReal;
}

/** Tudo que pode ter sido editado localmente ANTES do relatório existir de verdade no servidor — reaplicado logo após o insert. */
function extrairPatchPosCriacao(e: EstruturaFotografica): Partial<EstruturaFotografica> {
  return {
    equipamentos: e.equipamentos,
    servicos_habilitados: e.servicos_habilitados,
    ambientes_ordem: e.ambientes_ordem,
    agencia: e.agencia,
    programa: e.programa,
    upe: e.upe,
    sap: e.sap,
    gestor: e.gestor,
    fiscalizacao_empresa: e.fiscalizacao_empresa,
    fiscal: e.fiscal,
    construtora: e.construtora,
    responsavel: e.responsavel,
    data_inicio_obra: e.data_inicio_obra,
    data_termino_obra: e.data_termino_obra,
    obra_nome: e.obra_nome,
    banco: e.banco,
    modelo_relatorio: e.modelo_relatorio,
  };
}

async function processarOperacao(op: OperacaoOffline): Promise<void> {
  switch (op.tipo) {
    case "criar_estrutura": {
      const { localId, dados } = op.payload as { localId: string; dados: DadosNovaEstrutura };
      const cacheAtual = await lerEstruturaCache<EstruturaFotografica>(localId);
      const nova = await api.criarEstrutura(dados);
      const patchPosCriacao = cacheAtual ? extrairPatchPosCriacao(cacheAtual) : null;
      let final = patchPosCriacao ? await api.atualizarEstrutura(nova.id, patchPosCriacao) : nova;

      // Criado avulso offline porque o projeto buscado não estava em cache
      // (ver criarEstrutura em apiRelatorioFotograficoOffline.ts) — agora
      // que a rede voltou, tenta achar e religar ao projeto certo. Só
      // religa em match único e exato pelo nome — ambíguo ou sem match
      // fica avulso mesmo, pra não vincular errado silenciosamente.
      if (dados.vinculoPendenteNome) {
        try {
          const candidatos = await api.buscarProjetos(dados.vinculoPendenteNome);
          const exato = candidatos.filter((c) => c.nome.trim().toLowerCase() === dados.vinculoPendenteNome!.trim().toLowerCase());
          const alvo = exato.length === 1 ? exato[0] : candidatos.length === 1 ? candidatos[0] : null;
          if (alvo) {
            await api.atualizarCamposProjeto(alvo.id, {
              agencia: final.agencia,
              upe: final.upe,
              sap: final.sap,
              gestor: final.gestor,
              fiscalizacao_empresa: final.fiscalizacao_empresa,
              fiscal: final.fiscal,
              construtora: final.construtora,
              responsavel: final.responsavel,
              data_efetiva_inicio: final.data_inicio_obra,
              data_efetiva_termino: final.data_termino_obra,
            });
            final = await api.atualizarEstrutura(final.id, { projeto_id: alvo.id, is_avulso: false });
          }
        } catch (e) {
          // achar/religar o projeto é um bônus — se falhar, o relatório
          // continua existindo e usável como avulso, só sem o vínculo
          console.error("Não foi possível religar ao projeto automaticamente:", e);
        }
      }

      await migrarEstruturaLocal(localId, final.id);
      await salvarEstruturaCache(final);
      return;
    }
    case "atualizar_estrutura": {
      const { id, patch } = op.payload as { id: string; patch: Partial<EstruturaFotografica> };
      const idReal = resolverId(id);
      const atualizada = await api.atualizarEstrutura(idReal, patch);
      await salvarEstruturaCache(atualizada);
      return;
    }
    case "criar_progresso": {
      const { localId, relatorioId, dados } = op.payload as { localId: string; relatorioId: string; dados: DadosNovoProgresso };
      const relatorioIdReal = resolverId(relatorioId);
      const dadosResolvidos: DadosNovoProgresso = {
        ...dados,
        fotoAntesPath: await resolverCaminhoFoto(relatorioIdReal, dados.fotoAntesPath),
        fotoDepoisPath: await resolverCaminhoFoto(relatorioIdReal, dados.fotoDepoisPath),
        fotoDurantePath: await resolverCaminhoFoto(relatorioIdReal, dados.fotoDurantePath ?? null),
      };
      const novo = await api.criarProgresso(relatorioIdReal, dadosResolvidos);
      mapaIds[localId] = novo.id;
      await removerProgressoCache(localId);
      await salvarProgressoCache(novo);
      return;
    }
    case "atualizar_progresso": {
      const { id, patch } = op.payload as { id: string; patch: Partial<ProgressoSlide> };
      const idReal = resolverId(id);
      const cacheado = await lerProgressoCache<ProgressoSlide>(idReal);
      const relatorioIdReal = cacheado ? resolverId(cacheado.relatorio_id) : null;
      const patchResolvido = { ...patch };
      if (relatorioIdReal) {
        if ("foto_antes_path" in patchResolvido) {
          patchResolvido.foto_antes_path = await resolverCaminhoFoto(relatorioIdReal, patchResolvido.foto_antes_path ?? null);
        }
        if ("foto_depois_path" in patchResolvido) {
          patchResolvido.foto_depois_path = await resolverCaminhoFoto(relatorioIdReal, patchResolvido.foto_depois_path ?? null);
        }
      }
      const atualizado = await api.atualizarProgresso(idReal, patchResolvido);
      await salvarProgressoCache(atualizado);
      return;
    }
    case "excluir_progresso": {
      const { id } = op.payload as { id: string };
      const idReal = resolverId(id);
      await api.excluirProgresso(idReal);
      await removerProgressoCache(idReal);
      return;
    }
  }
}

function pareceErroDeRede(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /fetch|network|failed to fetch/i.test(msg);
}

export interface ResultadoSincronizacao {
  sincronizados: number;
  falhas: number;
  interrompidaPorRede: boolean;
}

/** Roda a fila inteira uma vez. Seguro chamar várias vezes (é no-op se já estiver rodando). */
export async function sincronizar(): Promise<ResultadoSincronizacao> {
  if (sincronizando) return { sincronizados: 0, falhas: 0, interrompidaPorRede: false };
  sincronizando = true;
  mapaIds = {};
  let sincronizados = 0;
  let falhas = 0;
  let interrompidaPorRede = false;
  try {
    const fila = await listarFila();
    for (const op of fila) {
      try {
        await processarOperacao(op);
        await removerDaFila(op.id);
        sincronizados++;
      } catch (e) {
        if (pareceErroDeRede(e)) {
          interrompidaPorRede = true;
          break; // perdeu conexão de novo no meio do processo — tenta o resto depois
        }
        // erro real (não de rede): não trava a fila inteira presa nesse item pra sempre
        console.error("Falha ao sincronizar operação offline:", op, e);
        await removerDaFila(op.id);
        falhas++;
      }
    }
  } finally {
    sincronizando = false;
  }
  return { sincronizados, falhas, interrompidaPorRede };
}

export function sincronizacaoEmAndamento(): boolean {
  return sincronizando;
}
