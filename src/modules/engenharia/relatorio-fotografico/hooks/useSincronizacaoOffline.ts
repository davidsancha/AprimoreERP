import { useCallback, useEffect, useRef, useState } from "react";
import { listarFila } from "@/shared/lib/offlineStore";
import { estaOnlineSegundoNavegador, ouvirMudancaConectividade, verificarConexaoReal } from "@/shared/lib/conectividade";
import { prepararFotosLocaisEmMemoria } from "../services/apiRelatorioFotograficoOffline";
import { sincronizar, sincronizacaoEmAndamento, type ResultadoSincronizacao } from "../services/sincronizadorOffline";

const INTERVALO_TENTATIVA_MS = 30_000;

/**
 * Estado de conectividade + fila offline pra tela de Relatório
 * Fotográfico. `offline` reflete se dá pra tentar sincronizar agora
 * (não só o evento do navegador — ver conectividade.ts); `pendencias` é o
 * tamanho da fila, pra badge/aviso na tela.
 */
export function useSincronizacaoOffline() {
  const [offline, setOffline] = useState(!estaOnlineSegundoNavegador());
  const [pendencias, setPendencias] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoSincronizacao | null>(null);
  const montadoRef = useRef(true);

  const atualizarPendencias = useCallback(async () => {
    const fila = await listarFila();
    if (montadoRef.current) setPendencias(fila.length);
  }, []);

  const sincronizarAgora = useCallback(async () => {
    if (sincronizacaoEmAndamento()) return;
    const online = await verificarConexaoReal();
    if (!montadoRef.current) return;
    setOffline(!online);
    if (!online) return;

    setSincronizando(true);
    try {
      const resultado = await sincronizar();
      if (!montadoRef.current) return;
      if (resultado.sincronizados > 0 || resultado.falhas > 0) setUltimoResultado(resultado);
      await atualizarPendencias();
    } finally {
      if (montadoRef.current) setSincronizando(false);
    }
  }, [atualizarPendencias]);

  useEffect(() => {
    montadoRef.current = true;
    prepararFotosLocaisEmMemoria();
    atualizarPendencias();
    sincronizarAgora();

    const cancelarOuvinte = ouvirMudancaConectividade((online) => {
      setOffline(!online);
      if (online) sincronizarAgora();
    });
    const intervalo = setInterval(sincronizarAgora, INTERVALO_TENTATIVA_MS);

    return () => {
      montadoRef.current = false;
      cancelarOuvinte();
      clearInterval(intervalo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { offline, pendencias, sincronizando, ultimoResultado, sincronizarAgora };
}
