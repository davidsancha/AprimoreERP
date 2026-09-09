'use client';

import { useState } from 'react';
import { Joyride, STATUS, type Step, type EventData } from 'react-joyride';
import { supabase } from '@/shared/lib/supabaseClient';

const PASSOS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: 'Bem-vindo(a) ao seu espaço! 👋',
    content: 'Rapidinho vamos te mostrar onde fica tudo por aqui. Pode clicar em Avançar quando quiser.',
  },
  {
    target: '[data-tour="meus-relatorios"]',
    title: 'Meus relatórios',
    content: 'Aqui ficam os relatórios fotográficos que você mesmo criou.',
  },
  {
    target: '[data-tour="compartilhados"]',
    title: 'Compartilhados comigo',
    content: 'E aqui, os relatórios que outras pessoas compartilharam com você.',
  },
  {
    target: '[data-tour="criar-relatorio"]',
    title: 'Criar novo relatório',
    content: 'Toque aqui pra começar um relatório fotográfico novo, das suas próprias obras.',
  },
  {
    target: '[data-tour="cowork"]',
    title: 'Compartilhamento (Cowork)',
    content: 'Você também pode compartilhar os seus relatórios com outras pessoas — leitor, editor ou admin.',
  },
  {
    target: '[data-tour="tutorial"]',
    title: 'Precisa rever isso?',
    content: 'Esse botão te traz de volta pra essa explicação completa a qualquer momento.',
  },
];

export default function TourParceiroEgf({ rodar, onTerminar }: { rodar: boolean; onTerminar: () => void }) {
  const [mostrarDespedida, setMostrarDespedida] = useState(false);
  const [naoMostrarNovamente, setNaoMostrarNovamente] = useState(false);

  const handleEvent = (data: EventData) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      onTerminar();
      setMostrarDespedida(true);
    }
  };

  const confirmarDespedida = async () => {
    if (naoMostrarNovamente && supabase) {
      try {
        await supabase.rpc('marcar_tutorial_visto', { p_visto: true });
      } catch {
        // não crítico — a introdução só reaparece de novo, sem quebrar nada
      }
    }
    setMostrarDespedida(false);
  };

  return (
    <>
      <Joyride
        steps={PASSOS}
        run={rodar}
        continuous
        onEvent={handleEvent}
        options={{
          buttons: ['back', 'close', 'skip', 'primary'],
          primaryColor: '#D9A441',
          zIndex: 10000,
          showProgress: true,
        }}
        locale={{ back: 'Voltar', close: 'Fechar', last: 'Concluir', next: 'Avançar', skip: 'Pular' }}
      />

      {mostrarDespedida && (
        <div className="fixed inset-0 z-[10001] bg-black/60 flex items-center justify-center p-4" onClick={confirmarDespedida}>
          <div
            className="bg-card border border-card-border rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-main">Prontinho! 🎉</h3>
            <p className="text-sm text-sub">Você já sabe onde fica tudo. Se quiser rever, é só tocar em "Como usar o sistema" a qualquer hora.</p>
            <label className="flex items-center gap-2 text-xs font-semibold text-sub cursor-pointer select-none justify-center">
              <input
                type="checkbox"
                checked={naoMostrarNovamente}
                onChange={(e) => setNaoMostrarNovamente(e.target.checked)}
                className="w-4 h-4 rounded text-brand-ocre focus:ring-brand-ocre border-card-border cursor-pointer accent-brand-ocre"
              />
              Não mostrar essa introdução automaticamente de novo
            </label>
            <button
              type="button"
              onClick={confirmarDespedida}
              className="w-full bg-brand-ocre text-brand-dark font-bold py-2.5 rounded-xl hover:bg-brand-ocre/90 transition-all"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
