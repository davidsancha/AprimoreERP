'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useRouter } from 'next/navigation';

/**
 * Destino do link de "esqueci minha senha" (`resetPasswordForEmail`, ver
 * `(auth)/login/page.tsx`). O supabase-js processa o token da URL
 * automaticamente e abre uma sessão de recovery — só precisamos aguardar o
 * evento `PASSWORD_RECOVERY` antes de liberar o formulário, senão um clique
 * rápido demais tentaria `updateUser` sem sessão ainda.
 */
export default function RedefinirSenhaPage() {
  const [pronto, setPronto] = useState(false);
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setPronto(true);
    });
    // se a sessão de recovery já foi processada antes deste efeito montar
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setPronto(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setErro('Supabase não configurado.');
      return;
    }
    if (senha !== confirmarSenha) {
      setErro('As senhas não são iguais.');
      return;
    }
    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    setCarregando(true);
    setErro(null);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setCarregando(false);
    if (error) {
      setErro(error.message);
    } else {
      setConcluido(true);
      setTimeout(() => router.push('/'), 2000);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-ocre/5 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-brand-ocre/5 blur-[120px]" />

      <div className="w-full max-w-md bg-card/80 backdrop-blur-xl border border-card-border p-8 rounded-2xl shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand-ocre/10 rounded-2xl border border-brand-ocre/20 flex items-center justify-center mb-4">
            <span className="text-brand-ocre font-bold text-2xl">A</span>
          </div>
          <h1 className="text-2xl font-bold text-main">Nova senha</h1>
          <p className="text-sub text-sm mt-1 text-center">Escolha uma senha nova pra sua conta no Aprimore ERP.</p>
        </div>

        {!pronto && !concluido && (
          <p className="text-sub text-sm text-center">Confirmando o link…</p>
        )}

        {pronto && !concluido && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {erro && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">{erro}</div>
            )}
            <div>
              <label className="block text-xs font-semibold text-sub uppercase tracking-wider mb-2">Nova senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-main focus:outline-none focus:ring-2 focus:ring-brand-ocre/50 focus:border-brand-ocre transition-all"
                placeholder="••••••••"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-sub uppercase tracking-wider mb-2">Confirmar senha</label>
              <input
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-main focus:outline-none focus:ring-2 focus:ring-brand-ocre/50 focus:border-brand-ocre transition-all"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-brand-ocre text-brand-dark font-bold py-3 px-4 rounded-xl hover:bg-brand-ocre/90 hover:-translate-y-0.5 transition-all shadow-lg shadow-brand-ocre/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {carregando ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        )}

        {concluido && (
          <p className="text-sm text-center text-emerald-600 font-semibold">Senha alterada! Entrando…</p>
        )}
      </div>
    </div>
  );
}
