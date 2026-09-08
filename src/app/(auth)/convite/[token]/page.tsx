'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { formatarTelefone, regrasSenha, senhaForte } from '@/shared/lib/validacao';

interface ConviteInfo {
  valido: boolean;
  motivo?: string;
  email?: string;
  nome?: string;
  telefone?: string | null;
  role?: string;
}

const MOTIVO_MENSAGEM: Record<string, string> = {
  nao_encontrado: 'Não encontramos esse convite. Confira se copiou o link certinho.',
  ja_aceito: 'Esse convite já foi usado — se é você, é só entrar normalmente.',
  revogado: 'Esse convite foi cancelado. Peça um novo pra quem te convidou.',
  expirado: 'Esse convite expirou. Peça um novo pra quem te convidou.',
};

export default function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [convite, setConvite] = useState<ConviteInfo | null>(null);

  // Fora do ThemeProvider (só envolve as rotas autenticadas) — lê a
  // preferência salva direto, mesmo padrão da tela de login.
  const [logoSrc, setLogoSrc] = useState('/brand/LogoVbranco.png');
  useEffect(() => {
    try {
      const salvo = localStorage.getItem('aprimore-theme');
      setLogoSrc(salvo === 'light' ? '/brand/LogoVpreto.png' : '/brand/LogoVbranco.png');
    } catch {
      // localStorage indisponível — mantém o padrão
    }
  }, []);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data, error } = await supabase.rpc('obter_convite_por_token', { p_token: token });
      if (error) {
        setConvite({ valido: false, motivo: 'nao_encontrado' });
      } else {
        setConvite(data as ConviteInfo);
        setNome(data?.nome || '');
        setTelefone(data?.telefone || '');
      }
      setCarregando(false);
    })();
  }, [token]);

  const ehParceiroEgf = convite?.role === 'convidado';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro('Informe seu nome completo.');
      return;
    }
    if (senha !== confirmarSenha) {
      setErro('As senhas não são iguais.');
      return;
    }
    if (!senhaForte(senha)) {
      setErro('A senha ainda não atende todos os requisitos abaixo.');
      return;
    }
    if (!supabase) return;

    setEnviando(true);
    try {
      const { error: aceitarError } = await supabase.rpc('aceitar_convite', {
        p_token: token,
        p_nome: nome,
        p_telefone: telefone || null,
        p_password: senha,
      });
      if (aceitarError) throw aceitarError;

      const { error: loginError } = await supabase.auth.signInWithPassword({ email: convite!.email!, password: senha });
      if (loginError) throw loginError;

      router.push('/');
    } catch (err: any) {
      setErro(err.message || 'Não foi possível completar o cadastro.');
      setEnviando(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-brand-ocre" size={32} />
      </div>
    );
  }

  if (!convite?.valido) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md bg-card border border-card-border rounded-2xl shadow-xl p-8 text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
            <X size={26} />
          </div>
          <h1 className="text-lg font-bold text-main">Convite indisponível</h1>
          <p className="text-sm text-sub">{MOTIVO_MENSAGEM[convite?.motivo || 'nao_encontrado']}</p>
          <a href="/login" className="inline-block mt-2 text-sm font-bold text-brand-ocre hover:underline">
            Ir para o login
          </a>
        </div>
      </div>
    );
  }

  const regras = regrasSenha(senha);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-ocre/5 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-brand-ocre/5 blur-[120px]" />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-12 space-y-6">
        {/* Convite — mensagem convidativa, sempre no topo */}
        <div className="bg-card border border-card-border rounded-2xl shadow-xl p-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="Aprimore" className="h-16 w-auto mx-auto mb-5 object-contain" />

          {ehParceiroEgf ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/egflogo.jpg" alt="EGF Construtora" className="h-14 w-14 rounded-full object-cover shadow-md" />
                <Sparkles className="text-brand-ocre" size={22} />
              </div>
              <h1 className="text-xl font-bold text-main">
                Olá, {convite.nome?.split(' ')[0]}! Você foi convidado(a) pra fazer parte do Aprimore ERP
              </h1>
              <p className="text-sm text-sub mt-3 leading-relaxed">
                A EGF Construtora é uma parceira que a Aprimore tem muito orgulho de ter por perto — e por isso
                queremos te dar acesso direto aos relatórios fotográficos das obras que a gente compartilha com
                vocês. É um espaço seu, pra acompanhar o que for combinado com a gente.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-main">Olá, {convite.nome?.split(' ')[0]}! Você foi convidado(a) pro Aprimore ERP</h1>
              <p className="text-sm text-sub mt-3 leading-relaxed">
                Complete seu cadastro abaixo pra começar a usar o sistema.
              </p>
            </>
          )}

          {!mostrarForm && (
            <button
              type="button"
              onClick={() => setMostrarForm(true)}
              className="mt-6 w-full bg-brand-ocre text-brand-dark font-bold py-3 px-4 rounded-xl hover:bg-brand-ocre/90 hover:-translate-y-0.5 transition-all shadow-lg shadow-brand-ocre/20"
            >
              Completar meu cadastro
            </button>
          )}
        </div>

        {/* Formulário — revelado ao clicar, mesma página */}
        {mostrarForm && (
          <form onSubmit={handleSubmit} className="bg-card border border-card-border rounded-2xl shadow-xl p-8 space-y-5">
            {erro && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">{erro}</div>
            )}

            <div>
              <label className="block text-xs font-semibold text-sub uppercase tracking-wider mb-2">Nome completo</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-main focus:outline-none focus:ring-2 focus:ring-brand-ocre/50 focus:border-brand-ocre transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-sub uppercase tracking-wider mb-2">E-mail</label>
              <input
                type="email"
                value={convite.email}
                disabled
                className="w-full bg-background/50 border border-card-border rounded-xl px-4 py-3 text-sub cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-sub uppercase tracking-wider mb-2">
                Telefone <span className="normal-case font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                placeholder="XX XXXXX-XXXX"
                className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-main focus:outline-none focus:ring-2 focus:ring-brand-ocre/50 focus:border-brand-ocre transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-sub uppercase tracking-wider mb-2">Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-main focus:outline-none focus:ring-2 focus:ring-brand-ocre/50 focus:border-brand-ocre transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-sub uppercase tracking-wider mb-2">Confirmar senha</label>
              <input
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
                className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-main focus:outline-none focus:ring-2 focus:ring-brand-ocre/50 focus:border-brand-ocre transition-all"
              />
              {confirmarSenha && senha !== confirmarSenha && (
                <p className="mt-1.5 text-xs text-red-500 font-semibold">As senhas não são iguais.</p>
              )}
            </div>

            <ul className="space-y-1">
              {regras.map((r) => (
                <li key={r.regra} className={`flex items-center gap-2 text-xs font-semibold ${r.atendida ? 'text-emerald-600' : 'text-sub'}`}>
                  <Check size={13} className={r.atendida ? 'opacity-100' : 'opacity-30'} />
                  {r.regra}
                </li>
              ))}
            </ul>

            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-brand-ocre text-brand-dark font-bold py-3 px-4 rounded-xl hover:bg-brand-ocre/90 hover:-translate-y-0.5 transition-all shadow-lg shadow-brand-ocre/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {enviando ? 'Criando sua conta...' : 'Concluir cadastro e entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
