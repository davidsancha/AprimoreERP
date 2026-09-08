/** Máscara de telefone BR: XX XXXXX-XXXX — só números, até 11 dígitos. */
export function formatarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 7) return `${digitos.slice(0, 2)} ${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)} ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

export interface RegraSenha {
  regra: string;
  atendida: boolean;
}

/** Mesmas regras aplicadas de novo no banco (RPC aceitar_convite) — defesa em profundidade. */
export function regrasSenha(senha: string): RegraSenha[] {
  return [
    { regra: 'Pelo menos 8 caracteres', atendida: senha.length >= 8 },
    { regra: 'Uma letra maiúscula', atendida: /[A-Z]/.test(senha) },
    { regra: 'Uma letra minúscula', atendida: /[a-z]/.test(senha) },
    { regra: 'Um número', atendida: /[0-9]/.test(senha) },
    { regra: 'Um caractere especial', atendida: /[^A-Za-z0-9]/.test(senha) },
  ];
}

export function senhaForte(senha: string): boolean {
  return regrasSenha(senha).every((r) => r.atendida);
}
