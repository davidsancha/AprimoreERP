'use client';

import { useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { ativarBiometria, biometriaDisponivel, entrarComBiometria, temBiometriaAtiva } from '@/shared/lib/biometria';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Logo tema-claro/escuro — esta página fica fora do ThemeProvider (só
  // envolve as rotas autenticadas, ver src/app/(app)/layout.tsx), então lê
  // a preferência salva direto do localStorage em vez de usar useTheme().
  const [logoSrc, setLogoSrc] = useState('/brand/LogoVbranco.png');
  const [logoError, setLogoError] = useState(false);
  useEffect(() => {
    try {
      const salvo = localStorage.getItem('aprimore-theme');
      setLogoSrc(salvo === 'light' ? '/brand/LogoVpreto.png' : '/brand/LogoVbranco.png');
    } catch {
      // localStorage indisponível — mantém o padrão (logo branca)
    }
  }, []);

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

  // "Esqueci minha senha" — modal próprio
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

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

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
          <div className="w-20 h-20 bg-brand-ocre/10 rounded-2xl border border-brand-ocre/20 flex items-center justify-center mb-4 p-2">
            {!logoError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt="Aprimore" className="h-full w-full object-contain" onError={() => setLogoError(true)} />
            ) : (
              <span className="text-brand-ocre font-bold text-2xl">A</span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-main">Aprimore ERP</h1>
          <p className="text-sub text-sm mt-1">Acesse sua conta para continuar</p>
        </div>

        {biometriaOk && biometriaJaAtiva && (
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
            {error === 'Invalid login credentials'
              ? 'Email ou senha inválidos'
              : error === 'Email not confirmed'
                ? 'Confirme seu e-mail antes de entrar — verifique a caixa de entrada e o spam.'
                : error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
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
          </div>

          {biometriaOk && !biometriaJaAtiva && (
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-ocre text-brand-dark font-bold py-3 px-4 rounded-xl hover:bg-brand-ocre/90 hover:-translate-y-0.5 transition-all shadow-lg shadow-brand-ocre/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? 'Aguarde...' : 'Entrar no Sistema'}
          </button>
        </form>

        {/* Cadastro só acontece por convite (ver /convite/[token]) — não existe
            mais um caminho de auto-cadastro aberto aqui. */}
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
