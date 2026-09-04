/**
 * `navigator.onLine` só diz se a interface de rede está ativa (Wi-Fi/4G
 * conectado), não se a internet de verdade funciona (captive portal, sem
 * sinal de dados mas com Wi-Fi "conectado" sem internet, etc.) — por isso
 * complementamos com um ping real e leve pro próprio Supabase.
 */

type Ouvinte = (online: boolean) => void;

const ouvintes = new Set<Ouvinte>();
let ultimoEstadoConhecido = typeof navigator !== "undefined" ? navigator.onLine : true;

export function estaOnlineSegundoNavegador(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/** Ping leve e rápido (timeout curto) — usado antes de tentar sincronizar, não em toda interação. */
export async function verificarConexaoReal(timeoutMs = 4000): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const alvo = supabaseUrl ? `${supabaseUrl}/auth/v1/health` : "https://www.gstatic.com/generate_204";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    await fetch(alvo, { method: "GET", mode: "no-cors", cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

export function ouvirMudancaConectividade(fn: Ouvinte): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

function notificar(online: boolean) {
  if (online === ultimoEstadoConhecido) return;
  ultimoEstadoConhecido = online;
  ouvintes.forEach((fn) => fn(online));
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => notificar(true));
  window.addEventListener("offline", () => notificar(false));
}
