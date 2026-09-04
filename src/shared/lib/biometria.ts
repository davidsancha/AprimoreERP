import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "capacitor-native-biometric";

/**
 * Login por biometria — só existe dentro do app nativo instalado (não no
 * navegador, nem no PC). Nunca guardamos a senha: depois do primeiro login
 * normal, guardamos o `refresh_token` da sessão do Supabase atrás da
 * biometria do aparelho (Keystore no Android); pra entrar de novo, a
 * biometria libera esse token e trocamos por uma sessão nova via
 * `supabase.auth.refreshSession()`.
 */
const SERVIDOR = "com.aprimoreegf.erp";

export function temAppNativo(): boolean {
  return Capacitor.isNativePlatform();
}

export async function biometriaDisponivel(): Promise<boolean> {
  if (!temAppNativo()) return false;
  try {
    const resultado = await NativeBiometric.isAvailable();
    return resultado.isAvailable;
  } catch {
    return false;
  }
}

export async function temBiometriaAtiva(): Promise<boolean> {
  if (!temAppNativo()) return false;
  try {
    await NativeBiometric.getCredentials({ server: SERVIDOR });
    return true;
  } catch {
    return false;
  }
}

export async function ativarBiometria(email: string, refreshToken: string): Promise<void> {
  await NativeBiometric.setCredentials({ username: email, password: refreshToken, server: SERVIDOR });
}

export async function desativarBiometria(): Promise<void> {
  try {
    await NativeBiometric.deleteCredentials({ server: SERVIDOR });
  } catch {
    // não tinha nada salvo — sem problema
  }
}

/** Pede a biometria e devolve o refresh token guardado — quem chama troca por uma sessão de verdade via supabase.auth.refreshSession(). */
export async function entrarComBiometria(): Promise<{ email: string; refreshToken: string }> {
  await NativeBiometric.verifyIdentity({
    title: "Entrar no Aprimore ERP",
    subtitle: "Confirme sua identidade",
    maxAttempts: 3,
  });
  const cred = await NativeBiometric.getCredentials({ server: SERVIDOR });
  return { email: cred.username, refreshToken: cred.password };
}
