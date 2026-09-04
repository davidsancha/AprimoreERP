import { useEffect, useState } from "react";
import { estaOnlineSegundoNavegador, ouvirMudancaConectividade, verificarConexaoReal } from "@/shared/lib/conectividade";

const INTERVALO_VERIFICACAO_MS = 30_000;

/** Estado de conectividade pra indicadores de UI (ex. bolinha no cabeçalho) — leve, sem fila/sincronização, só o status. */
export function useConectividade() {
  const [online, setOnline] = useState(estaOnlineSegundoNavegador());

  useEffect(() => {
    let montado = true;
    const checar = async () => {
      const real = await verificarConexaoReal();
      if (montado) setOnline(real);
    };
    checar();

    const cancelar = ouvirMudancaConectividade((novoEstado) => {
      setOnline(novoEstado);
      if (novoEstado) checar();
    });
    const intervalo = setInterval(checar, INTERVALO_VERIFICACAO_MS);

    return () => {
      montado = false;
      cancelar();
      clearInterval(intervalo);
    };
  }, []);

  return online;
}
