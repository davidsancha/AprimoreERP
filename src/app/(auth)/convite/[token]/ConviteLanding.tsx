'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
import type { ConviteInfo } from './dados';

const MOTIVO_MENSAGEM: Record<string, string> = {
  nao_encontrado: 'Não encontramos esse convite. Confira se copiou o link certinho.',
  ja_aceito: 'Esse convite já foi usado — se é você, é só entrar normalmente.',
  revogado: 'Esse convite foi cancelado. Peça um novo pra quem te convidou.',
  expirado: 'Esse convite expirou. Peça um novo pra quem te convidou.',
};

export default function ConviteLanding({ token, convite }: { token: string; convite: ConviteInfo | null }) {
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

  const ehParceiroEgf = convite.role === 'convidado';
  const primeiroNome = convite.nome?.split(' ')[0] || '';

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-ocre/5 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-brand-ocre/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-lg bg-card border border-card-border rounded-2xl shadow-xl p-8 text-center">
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
              Olá, {primeiroNome}! Você foi convidado(a) pra fazer parte do Aprimore ERP
            </h1>
            <p className="text-sm text-sub mt-3 leading-relaxed">
              A EGF Construtora é uma parceira que a Aprimore tem muito orgulho de ter por perto — e por isso
              queremos te dar acesso direto aos relatórios fotográficos das obras que a gente compartilha com
              vocês. É um espaço seu, pra acompanhar o que for combinado com a gente.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-main">Olá, {primeiroNome}! Você foi convidado(a) pro Aprimore ERP</h1>
            <p className="text-sm text-sub mt-3 leading-relaxed">Complete seu cadastro pra começar a usar o sistema.</p>
          </>
        )}

        <Link
          href={`/convite/${token}/cadastro`}
          className="mt-6 inline-flex w-full items-center justify-center bg-brand-ocre text-brand-dark font-bold py-3 px-4 rounded-xl hover:bg-brand-ocre/90 hover:-translate-y-0.5 transition-all shadow-lg shadow-brand-ocre/20"
        >
          Completar meu cadastro
        </Link>
      </div>
    </div>
  );
}
