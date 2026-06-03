/**
 * Formata um número como BRL sem o símbolo R$.
 * Ex: 850000.5 → "850.000,50"
 */
export function formatarBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte string BRL (com ou sem separadores) para número.
 * Aceita: "850.000,50" | "850000,50" | "850000.50" | "850000"
 */
export function parseBRL(str: string): number {
  if (!str) return 0;
  // Remove separadores de milhar (.) e substitui vírgula decimal por ponto
  const normalizado = str.replace(/\./g, '').replace(',', '.');
  const resultado = parseFloat(normalizado);
  return isNaN(resultado) ? 0 : resultado;
}
