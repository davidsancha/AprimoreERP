/** Primeiro nome — usado sempre que o ambiente precisa se dirigir à pessoa de forma direta/pessoal. */
export function primeiroNome(nomeCompleto: string | null | undefined): string {
  const nome = (nomeCompleto || '').trim();
  if (!nome) return '';
  return nome.split(/\s+/)[0];
}
