'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import {
  contarNaoLidas,
  listarNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
  type Notificacao,
} from '@/shared/lib/notificacoes';

const INTERVALO_POLL_MS = 60_000;

export default function SininhoNotificacoes() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [posicao, setPosicao] = useState<{ top: number; left: number; largura: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Posição calculada na mão (em vez de `absolute right-0` relativo ao
  // botão) porque o dropdown é portalizado pra fora do <header> — precisa
  // ser assim: o <header> tem `backdrop-blur-md`, e `backdrop-filter` cria
  // um novo containing block pra elementos `fixed` dentro dele, então um
  // `position: fixed` comum ali ficava ancorado no próprio header (não na
  // viewport) e cortava a caixa pra fora da tela no mobile.
  useEffect(() => {
    if (!aberto) return;
    function recalcular() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const largura = Math.min(320, window.innerWidth - 16);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - largura - 8);
      setPosicao({ top: rect.bottom + 8, left, largura });
    }
    recalcular();
    window.addEventListener('resize', recalcular);
    return () => window.removeEventListener('resize', recalcular);
  }, [aberto]);

  useEffect(() => {
    contarNaoLidas().then(setNaoLidas).catch(() => {});
    const intervalo = setInterval(() => {
      contarNaoLidas().then(setNaoLidas).catch(() => {});
    }, INTERVALO_POLL_MS);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    setCarregando(true);
    listarNotificacoes()
      .then(setNotificacoes)
      .catch(() => setNotificacoes([]))
      .finally(() => setCarregando(false));
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      const alvo = e.target as Node;
      // O dropdown é portalizado pra fora do botão (document.body, ver
      // comentário acima), então "dentro" agora conta o botão E o próprio
      // dropdown portalizado — sem isso, clicar dentro da lista de
      // notificações contava como clique "fora" e fechava na hora.
      if (containerRef.current?.contains(alvo)) return;
      if (dropdownRef.current?.contains(alvo)) return;
      setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  async function abrirNotificacao(n: Notificacao) {
    if (!n.lida) {
      setNotificacoes((atual) => atual.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
      setNaoLidas((atual) => Math.max(0, atual - 1));
      marcarNotificacaoLida(n.id).catch(() => {});
    }
    setAberto(false);
    if (n.link) router.push(n.link);
  }

  async function marcarTodasLidas() {
    setNotificacoes((atual) => atual.map((x) => ({ ...x, lida: true })));
    setNaoLidas(0);
    try {
      await marcarTodasNotificacoesLidas();
    } catch {
      // não crítico — o pior caso é o contador voltar a subir no próximo poll
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="relative p-1.5 rounded-lg text-sub hover:text-main hover:bg-background transition-colors"
        title="Notificações"
      >
        <Bell size={19} />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto &&
        posicao &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ position: 'fixed', top: posicao.top, left: posicao.left, width: posicao.largura }}
            className="bg-card border border-card-border rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-card-border">
              <span className="text-xs font-bold text-main">Notificações</span>
              {naoLidas > 0 && (
                <button type="button" onClick={marcarTodasLidas} className="text-[10px] font-bold text-brand-ocre hover:underline">
                  Marcar todas como lidas
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {carregando ? (
                <p className="text-[11px] text-sub text-center py-6">Carregando…</p>
              ) : notificacoes.length === 0 ? (
                <p className="text-[11px] text-sub text-center py-6">Nenhuma notificação ainda.</p>
              ) : (
                notificacoes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => abrirNotificacao(n)}
                    className={`w-full text-left px-4 py-2.5 border-b border-card-border/60 last:border-0 hover:bg-background transition-colors ${!n.lida ? 'bg-brand-ocre/5' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.lida && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-ocre shrink-0" />}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-main truncate">{n.titulo}</div>
                        {n.mensagem && <div className="text-[10px] text-sub truncate">{n.mensagem}</div>}
                        <div className="text-[9px] text-desc mt-0.5">{new Date(n.created_at).toLocaleString('pt-BR')}</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
