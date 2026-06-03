'use client';

import { useState } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!supabase) {
      setError('Supabase não configurado.');
      setLoading(false);
      return;
    }

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        router.push('/');
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        // Se auto confirm enabled, já faz login. Senão precisa checar email.
        // No nosso caso não tem confirmação de email no localhost.
        router.push('/');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background Decorativo */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-ocre/5 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-brand-ocre/5 blur-[120px]" />
      
      <div className="w-full max-w-md bg-card/80 backdrop-blur-xl border border-card-border p-8 rounded-2xl shadow-2xl relative z-10">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand-ocre/10 rounded-2xl border border-brand-ocre/20 flex items-center justify-center mb-4">
            <span className="text-brand-ocre font-bold text-2xl">A</span>
          </div>
          <h1 className="text-2xl font-bold text-main">Aprimore ERP</h1>
          <p className="text-sub text-sm mt-1">Acesse sua conta para continuar</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-card-border mb-6">
          <button
            className={`flex-1 py-2 text-sm font-bold border-b-2 transition-colors ${
              isLogin 
                ? 'border-brand-ocre text-brand-ocre' 
                : 'border-transparent text-sub hover:text-main'
            }`}
            onClick={() => { setIsLogin(true); setError(null); }}
          >
            Entrar
          </button>
          <button
            className={`flex-1 py-2 text-sm font-bold border-b-2 transition-colors ${
              !isLogin 
                ? 'border-brand-ocre text-brand-ocre' 
                : 'border-transparent text-sub hover:text-main'
            }`}
            onClick={() => { setIsLogin(false); setError(null); }}
          >
            Primeiro Acesso
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
            {error === 'Invalid login credentials' ? 'Email ou senha inválidos' : error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-sub uppercase tracking-wider mb-2">Nome Completo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-main focus:outline-none focus:ring-2 focus:ring-brand-ocre/50 focus:border-brand-ocre transition-all"
                placeholder="Seu nome"
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-sub uppercase tracking-wider mb-2">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-main focus:outline-none focus:ring-2 focus:ring-brand-ocre/50 focus:border-brand-ocre transition-all"
              placeholder="seu@email.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-sub uppercase tracking-wider mb-2">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-main focus:outline-none focus:ring-2 focus:ring-brand-ocre/50 focus:border-brand-ocre transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-ocre text-brand-dark font-bold py-3 px-4 rounded-xl hover:bg-brand-ocre/90 hover:-translate-y-0.5 transition-all shadow-lg shadow-brand-ocre/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? 'Aguarde...' : (isLogin ? 'Entrar no Sistema' : 'Criar Conta')}
          </button>
        </form>
      </div>
    </div>
  );
}
