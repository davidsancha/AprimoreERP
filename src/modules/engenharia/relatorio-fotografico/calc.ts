/**
 * Regras de negócio do relatório fotográfico — portadas linha a linha de
 * APRIMORE_ERP/packages/shared e APRIMORE_ERP/web (Estrutura.tsx/Relatorio.tsx).
 * Validadas contra pastas e arquivos reais de banco — não redescubra por
 * tentativa. Ver docs/02-REGRAS-DE-NEGOCIO.md naquele projeto para o porquê
 * de cada regra.
 */
import { ETAPAS, type Equipamento, type Servico, type TipoProjetoFotografico } from "./types";

export function limpaNome(s: string | undefined | null): string {
  return (s || "").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Lista de caminhos (segmentos) que a estrutura fotográfica precisa ter —
 * infraestrutura: EQUIPAMENTO/NUMERO; reforma: SERVIÇO/ANTES|DURANTE|DEPOIS.
 * No app local isso virava pasta de verdade; aqui vira a lista de "gavetas"
 * esperadas dentro do Storage (ex.: prefixo do caminho do arquivo).
 */
export function estruturaCaminhos(
  tipo: TipoProjetoFotografico,
  equipamentos: Equipamento[],
  servicos: Servico[],
): string[][] {
  const caminhos: string[][] = [];
  if (tipo === "infraestrutura") {
    for (const eq of equipamentos) {
      const nome = limpaNome(eq.nome).toUpperCase();
      if (!nome) continue;
      if (eq.pontos.length === 0) {
        caminhos.push([nome]);
        continue;
      }
      for (const p of eq.pontos) caminhos.push([nome, p.numero]);
    }
  } else {
    for (const s of servicos) {
      const nome = limpaNome(s.nome).toUpperCase();
      if (!nome) continue;
      for (const et of ETAPAS) caminhos.push([nome, et]);
    }
  }
  return caminhos;
}

export function descricaoDe(equip: string, numero: string, local: string, caixa: "alta" | "normal"): string {
  const n = String(parseInt(numero, 10)).padStart(2, "0");
  const d = equip + " " + n + (local ? " (" + local + ")" : "");
  return caixa === "alta" ? d.toUpperCase() : d;
}

export function descricaoReforma(servico: string, ambiente: string, caixa: "alta" | "normal"): string {
  const d = (servico || "").trim() + (ambiente ? " (" + ambiente + ")" : "");
  return caixa === "alta" ? d.toUpperCase() : d;
}
