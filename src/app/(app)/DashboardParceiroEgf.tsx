'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Camera, FolderOpen, Share2, Sparkles, Eye, Pencil, ShieldCheck, GraduationCap } from 'lucide-react';
import { useAuth } from '@/core/auth/AuthProvider';
import { supabase } from '@/shared/lib/supabaseClient';
import { listarRelatoriosDoUsuario } from '@/modules/engenharia/relatorio-fotografico/services/apiRelatorioFotograficoOffline';
import type { EstruturaFotografica } from '@/modules/engenharia/relatorio-fotografico/types';
import { primeiroNome } from '@/shared/lib/nomes';
import TourParceiroEgf from '@/shared/components/TourParceiroEgf';

export default function DashboardParceiroEgf() {
  return (
    <Suspense fallback={null}>
      <DashboardParceiroEgfInner />
    </Suspense>
  );
}

function DashboardParceiroEgfInner() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [relatorios, setRelatorios] = useState<EstruturaFotografica[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [rodarTour, setRodarTour] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    listarRelatoriosDoUsuario(user.id)
      .then(setRelatorios)
      .catch(() => setRelatorios([]))
      .finally(() => setCarregando(false));
  }, [user?.id]);

  useEffect(() => {
    if (searchParams.get('tour') === '1') {
      setRodarTour(true);
      router.replace('/');
    } else if (profile && !profile.tutorial_visto) {
      setRodarTour(true);
    }
  }, [searchParams, profile, router]);

  const meus = relatorios.filter((r) => r.user_id === user?.id);
  const compartilhados = relatorios.filter((r) => r.user_id !== user?.id);

  return (
    <div className="space-y-8">
      <TourParceiroEgf rodar={rodarTour} onTerminar={() => setRodarTour(false)} />

      <div className="border-b border-card-border pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-main flex items-center gap-2.5 font-vomzom">
          <Sparkles className="text-brand-ocre" size={28} />
          Olá, {primeiroNome(profile?.nome) || 'bem-vindo(a)'}!
        </h2>
        <p className="text-sub text-sm mt-1">Aqui está o seu espaço no Aprimore ERP — seus relatórios fotográficos, num só lugar.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div data-tour="meus-relatorios" className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-brand-ocre font-bold text-sm">
            <FolderOpen size={18} /> Meus relatórios
            <span className="ml-auto text-xs font-black bg-brand-ocre/10 text-brand-ocre px-2 py-0.5 rounded-full">{meus.length}</span>
          </div>
          {carregando ? (
            <p className="text-xs text-sub">Carregando…</p>
          ) : meus.length === 0 ? (
            <p className="text-xs text-sub">Nenhum relatório seu ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {meus.slice(0, 4).map((r) => (
                <li key={r.id} className="text-xs text-main font-semibold truncate">{r.obra_nome || 'Sem nome'}</li>
              ))}
            </ul>
          )}
          <Link href="/engenharia/relatorio-fotografico" className="inline-block text-xs font-bold text-brand-ocre hover:underline">
            Ver todos →
          </Link>
        </div>

        <div data-tour="compartilhados" className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-brand-blue dark:text-brand-ocre font-bold text-sm">
            <Share2 size={18} /> Compartilhados comigo
            <span className="ml-auto text-xs font-black bg-brand-blue/10 dark:bg-brand-ocre/10 text-brand-blue dark:text-brand-ocre px-2 py-0.5 rounded-full">{compartilhados.length}</span>
          </div>
          {carregando ? (
            <p className="text-xs text-sub">Carregando…</p>
          ) : compartilhados.length === 0 ? (
            <p className="text-xs text-sub">Ninguém compartilhou nenhum relatório com você ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {compartilhados.slice(0, 4).map((r) => (
                <li key={r.id} className="text-xs text-main font-semibold truncate">{r.obra_nome || 'Sem nome'}</li>
              ))}
            </ul>
          )}
          <Link href="/engenharia/relatorio-fotografico" className="inline-block text-xs font-bold text-brand-ocre hover:underline">
            Ver todos →
          </Link>
        </div>
      </div>

      <Link
        data-tour="criar-relatorio"
        href="/engenharia/relatorio-fotografico"
        className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-brand-ocre text-brand-dark font-bold text-sm shadow-lg shadow-brand-ocre/20 hover:bg-brand-ocre/90 hover:-translate-y-0.5 transition-all"
      >
        <Camera size={18} /> Criar novo relatório
      </Link>

      <div data-tour="cowork" className="bg-card border border-card-border rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-main flex items-center gap-2">
          <Share2 size={16} className="text-brand-ocre" /> Como funciona o compartilhamento (Cowork)
        </h3>
        <p className="text-xs text-sub leading-relaxed">
          Dentro de qualquer relatório seu, o botão <strong className="text-main">Compartilhar</strong> deixa você
          convidar outras pessoas (que já tenham conta no sistema) pra acessar aquele relatório com um destes níveis:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-start gap-2 bg-background rounded-xl p-3 border border-card-border/60">
            <Eye size={15} className="text-brand-blue dark:text-brand-ocre shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-main">Leitor</div>
              <div className="text-[10px] text-sub">Só visualiza o relatório.</div>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-background rounded-xl p-3 border border-card-border/60">
            <Pencil size={15} className="text-brand-blue dark:text-brand-ocre shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-main">Editor</div>
              <div className="text-[10px] text-sub">Adiciona fotos e edita o conteúdo.</div>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-background rounded-xl p-3 border border-card-border/60">
            <ShieldCheck size={15} className="text-brand-blue dark:text-brand-ocre shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-main">Admin</div>
              <div className="text-[10px] text-sub">Edita e também gerencia quem tem acesso.</div>
            </div>
          </div>
        </div>
      </div>

      <Link
        data-tour="tutorial"
        href="/tutorial"
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-brand-ocre/30 bg-brand-ocre/5 text-brand-ocre font-bold text-xs hover:bg-brand-ocre/10 transition-all"
      >
        <GraduationCap size={16} /> Como usar o sistema
      </Link>
    </div>
  );
}
