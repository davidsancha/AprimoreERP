/**
 * Regras de negócio do relatório fotográfico — portadas do app de
 * referência (APRIMORE_ERP local). Validadas contra pastas e arquivos
 * reais de banco — não redescubra por tentativa.
 */

export function limpaNome(s: string | undefined | null): string {
  return (s || "").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
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

/**
 * Só pra montar a CHAVE do Storage (nunca pro que aparece na tela) — o
 * bucket é S3-compatível e rejeita bytes fora de ASCII na chave com
 * "Invalid key" (ex.: "SENSOR DE PRESENÇA" tem "Ç"). NFD separa a letra do
 * acento (Ç -> C + combining cedilla) e o replace descarta só a marca
 * combinante, sobrando "C" puro.
 */
function paraChaveAscii(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Caminho do arquivo no bucket `relatorios-fotograficos` — não existe mais
 * "pasta a criar" (Storage não precisa de pasta vazia pré-existente, é só
 * um prefixo de caminho), mas a convenção de nome continua a mesma:
 * reforma -> SERVIÇO/ETAPA/arquivo; infraestrutura -> EQUIPAMENTO/NUMERO/arquivo.
 */
export function caminhoStorage(
  relatorioId: string,
  segmento: string[],
  nomeArquivo: string,
): string {
  const partes = [relatorioId, ...segmento.map((s) => paraChaveAscii(limpaNome(s).toUpperCase())), nomeArquivo];
  return partes.join("/");
}
