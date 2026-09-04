'use client';

import { useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { ativarBiometria, biometriaDisponivel, entrarComBiometria, temBiometriaAtiva } from '@/shared/lib/biometria';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [parceiroEgf, setParceiroEgf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Biometria — só existe dentro do app nativo instalado (ver src/shared/lib/biometria.ts)
  const [biometriaOk, setBiometriaOk] = useState(false);
  const [biometriaJaAtiva, setBiometriaJaAtiva] = useState(false);
  const [ativarBiometriaNoLogin, setAtivarBiometriaNoLogin] = useState(true);
  const [entrandoComBiometria, setEntrandoComBiometria] = useState(false);

  useEffect(() => {
    biometriaDisponivel().then(setBiometriaOk);
    temBiometriaAtiva().then(setBiometriaJaAtiva);
  }, []);

  async function handleEntrarComBiometria() {
    if (!supabase) return;
    setEntrandoComBiometria(true);
    setError(null);
    try {
      const { refreshToken } = await entrarComBiometria();
      const { error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
      if (error) throw error;
      router.push('/');
    } catch {
      setError('Não foi possível entrar com biometria. Use e-mail e senha.');
    } finally {
      setEntrandoComBiometria(false);
    }
  }

  // "Esqueci minha senha" — estado próprio, não é mais uma aba do form principal
  const [recuperarAberto, setRecuperarAberto] = useState(false);
  const [emailRecuperar, setEmailRecuperar] = useState('');
  const [recuperarEnviado, setRecuperarEnviado] = useState(false);
  const [recuperarCarregando, setRecuperarCarregando] = useState(false);
  const [recuperarErro, setRecuperarErro] = useState<string | null>(null);

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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        if (biometriaOk && ativarBiometriaNoLogin && data.session?.refresh_token) {
          try {
            await ativarBiometria(email, data.session.refresh_token);
          } catch {
            // ativar biometria é um bônus — não deve travar o login se falhar
          }
        }
        router.push('/');
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            // Trigger handle_new_user (Antigravity) atribui a role
            // 'convidado' quando esse metadata vem preenchido — Parceiro
            // EGF entra com acesso restrito (só os próprios relatórios +
            // Cowork compartilhado com ele), nunca com acesso corporativo
            // total como um cadastro comum hoje.
            ...(parceiroEgf ? { role: 'convidado' } : {}),
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

  const handleRecuperarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setRecuperarErro('Supabase não configurado.');
      return;
    }
    setRecuperarCarregando(true);
    setRecuperarErro(null);
    const { error } = await supabase.auth.resetPasswordForEmail(emailRecuperar, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setRecuperarCarregando(false);
    if (error) {
      setRecuperarErro(error.message);
    } else {
      setRecuperarEnviado(true);
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

        {isLogin && biometriaOk && biometriaJaAtiva && (
          <button
            type="button"
            disabled={entrandoComBiometria}
            onClick={handleEntrarComBiometria}
            className="w-full flex items-center justify-center gap-2 mb-6 py-3 px-4 rounded-xl border border-brand-ocre/30 bg-brand-ocre/10 text-brand-ocre font-bold hover:bg-brand-ocre/20 transition-all disabled:opacity-50"
          >
            <Fingerprint size={18} />
            {entrandoComBiometria ? 'Confirmando…' : 'Entrar com biometria'}
          </button>
        )}

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
            {error === 'Invalid login credentials' ? 'Email ou senha inválidos' : error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-sub uppercase tracking-wider mb-2">
                {parceiroEgf ? 'Nome de usuário' : 'Nome Completo'}
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-main focus:outline-none focus:ring-2 focus:ring-brand-ocre/50 focus:border-brand-ocre transition-all"
                placeholder={parceiroEgf ? 'Como você quer ser chamado' : 'Seu nome'}
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
            {isLogin && (
              <button
                type="button"
                onClick={() => {
                  setRecuperarAberto(true);
                  setEmailRecuperar(email);
                  setRecuperarEnviado(false);
                  setRecuperarErro(null);
                }}
                className="mt-2 text-xs font-semibold text-brand-ocre hover:underline"
              >
                Esqueci minha senha
              </button>
            )}
          </div>

          {isLogin && biometriaOk && !biometriaJaAtiva && (
            <label className="flex items-center gap-2.5 text-xs font-semibold text-sub cursor-pointer select-none bg-background border border-card-border rounded-xl px-4 py-3">
              <input
                type="checkbox"
                checked={ativarBiometriaNoLogin}
                onChange={(e) => setAtivarBiometriaNoLogin(e.target.checked)}
                className="w-4 h-4 rounded text-brand-ocre focus:ring-brand-ocre border-card-border cursor-pointer accent-brand-ocre shrink-0"
              />
              <span className="flex items-center gap-1.5">
                <Fingerprint size={14} className="text-brand-ocre shrink-0" />
                Ativar entrada por biometria neste aparelho
              </span>
            </label>
          )}

          {!isLogin && (
            <label className="flex items-start gap-2.5 text-xs font-semibold text-sub cursor-pointer select-none bg-background border border-card-border rounded-xl px-4 py-3">
              <input
                type="checkbox"
                checked={parceiroEgf}
                onChange={(e) => setParceiroEgf(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-brand-ocre focus:ring-brand-ocre border-card-border cursor-pointer accent-brand-ocre shrink-0"
              />
              <span>
                Sou <strong className="text-main">Parceiro EGF</strong> — acesso convidado, só aos meus próprios
                relatórios (e aos que compartilharem comigo).
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-ocre text-brand-dark font-bold py-3 px-4 rounded-xl hover:bg-brand-ocre/90 hover:-translate-y-0.5 transition-all shadow-lg shadow-brand-ocre/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? 'Aguarde...' : (isLogin ? 'Entrar no Sistema' : 'Criar Conta')}
          </button>
        </form>
      </div>

      {recuperarAberto && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setRecuperarAberto(false)}
        >
          <div
            className="w-full max-w-sm bg-card border border-card-border p-6 rounded-2xl shadow-2xl relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-main mb-1">Recuperar senha</h2>
            {recuperarEnviado ? (
              <>
                <p className="text-sub text-sm mt-2">
                  Se <strong className="text-main">{emailRecuperar}</strong> tiver uma conta aqui, chega um e-mail
                  com o link pra você definir uma senha nova.
                </p>
                <button
                  type="button"
                  onClick={() => setRecuperarAberto(false)}
                  className="w-full mt-5 bg-brand-ocre text-brand-dark font-bold py-2.5 px-4 rounded-xl hover:bg-brand-ocre/90 transition-all"
                >
                  Entendi
                </button>
              </>
            ) : (
              <form onSubmit={handleRecuperarSenha}>
                <p className="text-sub text-sm mt-1 mb-4">Digite o e-mail da sua conta — mandamos o link de redefinição pra ele.</p>
                {recuperarErro && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
                    {recuperarErro}
                  </div>
                )}
                <label className="block text-xs font-semibold text-sub uppercase tracking-wider mb-2">E-mail</label>
                <input
                  type="email"
                  value={emailRecuperar}
                  onChange={(e) => setEmailRecuperar(e.target.value)}
                  className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-main focus:outline-none focus:ring-2 focus:ring-brand-ocre/50 focus:border-brand-ocre transition-all"
                  placeholder="seu@email.com"
                  required
                  autoFocus
                />
                <div className="flex gap-2 mt-5">
                  <button
                    type="button"
                    onClick={() => setRecuperarAberto(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-card-border text-sub font-bold hover:bg-background transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={recuperarCarregando}
                    className="flex-1 bg-brand-ocre text-brand-dark font-bold py-2.5 px-4 rounded-xl hover:bg-brand-ocre/90 transition-all disabled:opacity-50"
                  >
                    {recuperarCarregando ? 'Enviando…' : 'Enviar link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
