'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, FolderOpen, Share2, Eye, Pencil, ShieldCheck, GraduationCap, PlayCircle } from 'lucide-react';
import { useAuth } from '@/core/auth/AuthProvider';
import { supabase } from '@/shared/lib/supabaseClient';

const PASSOS = [
  {
    icone: FolderOpen,
    titulo: 'Meus relatórios',
    texto: 'Na sua página inicial, esse cartão mostra todos os relatórios fotográficos que você mesmo criou.',
  },
  {
    icone: Share2,
    titulo: 'Compartilhados comigo',
    texto: 'Aqui aparecem os relatórios que outras pessoas do sistema compartilharam com você — sem precisar pedir nada, já fica disponível.',
  },
  {
    icone: Camera,
    titulo: 'Criar novo relatório',
    texto: 'É só tocar em "Criar novo relatório", escolher entre Infraestrutura ou Reforma, e começar a adicionar fotos.',
  },
];

export default function TutorialPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [naoMostrar, setNaoMostrar] = useState(!!profile?.tutorial_visto);
  const [salvando, setSalvando] = useState(false);

  const alternarNaoMostrar = async (valor: boolean) => {
    setNaoMostrar(valor);
    setSalvando(true);
    try {
      await supabase?.rpc('marcar_tutorial_visto', { p_visto: valor });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="border-b border-card-border pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-main flex items-center gap-2.5 font-vomzom">
          <GraduationCap size={28} className="text-brand-ocre" />
          Como usar o sistema
        </h2>
        <p className="text-sub text-sm mt-1">Um resumo rápido do seu espaço no Aprimore ERP.</p>
      </div>

      <button
        type="button"
        onClick={() => router.push('/?tour=1')}
        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-brand-ocre text-brand-dark font-bold text-sm shadow-lg shadow-brand-ocre/20 hover:bg-brand-ocre/90 transition-all"
      >
        <PlayCircle size={18} /> Rever o tour guiado
      </button>

      <div className="space-y-4">
        {PASSOS.map((p) => (
          <div key={p.titulo} className="bg-card border border-card-border rounded-2xl p-5 shadow-sm flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-brand-ocre/10 text-brand-ocre flex items-center justify-center shrink-0">
              <p.icone size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-main">{p.titulo}</h3>
              <p className="text-xs text-sub mt-1 leading-relaxed">{p.texto}</p>
            </div>
          </div>
        ))}

        <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-brand-ocre/10 text-brand-ocre flex items-center justify-center shrink-0">
              <Share2 size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-main">Compartilhar (Cowork)</h3>
              <p className="text-xs text-sub mt-1 leading-relaxed">
                Dentro de qualquer relatório seu, o botão <strong className="text-main">Compartilhar</strong> deixa
                você convidar outras pessoas (que já tenham conta no sistema) com um destes níveis de acesso:
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-14">
            <div className="flex items-start gap-2 bg-background rounded-xl p-3 border border-card-border/60">
              <Eye size={15} className="text-brand-blue dark:text-brand-ocre shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-main">Leitor</div>
                <div className="text-[10px] text-sub">Só visualiza.</div>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-background rounded-xl p-3 border border-card-border/60">
              <Pencil size={15} className="text-brand-blue dark:text-brand-ocre shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-main">Editor</div>
                <div className="text-[10px] text-sub">Adiciona fotos e edita.</div>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-background rounded-xl p-3 border border-card-border/60">
              <ShieldCheck size={15} className="text-brand-blue dark:text-brand-ocre shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-main">Admin</div>
                <div className="text-[10px] text-sub">Edita e gerencia acessos.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2.5 text-xs font-semibold text-sub cursor-pointer select-none bg-card border border-card-border rounded-xl px-4 py-3">
        <input
          type="checkbox"
          checked={naoMostrar}
          disabled={salvando}
          onChange={(e) => alternarNaoMostrar(e.target.checked)}
          className="w-4 h-4 rounded text-brand-ocre focus:ring-brand-ocre border-card-border cursor-pointer accent-brand-ocre shrink-0"
        />
        Não mostrar a introdução automaticamente quando eu entrar
      </label>
    </div>
  );
}
