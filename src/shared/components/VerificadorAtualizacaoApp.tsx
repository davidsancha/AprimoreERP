'use client';

import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Download, Sparkles, X } from 'lucide-react';

interface VersaoRemota {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  notes?: string;
  publishedAt?: string;
}

const URL_VERSAO_JSON =
  'https://fbctoskurwbdlqwrdbqg.supabase.co/storage/v1/object/public/relatorios-fotograficos/apk/version.json';

export default function VerificadorAtualizacaoApp() {
  const [atualizacao, setAtualizacao] = useState<VersaoRemota | null>(null);
  const [versaoInstalada, setVersaoInstalada] = useState<string>('');
  const [baixando, setBaixando] = useState(false);

  useEffect(() => {
    // Só executa quando o usuário estiver rodando pelo App Android instalado
    if (!Capacitor.isNativePlatform()) return;

    let cancelado = false;

    async function verificar() {
      try {
        const info = await App.getInfo();
        if (cancelado) return;
        setVersaoInstalada(info.version || info.build);

        const resp = await fetch(`${URL_VERSAO_JSON}?_t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!resp.ok) return;

        const remota: VersaoRemota = await resp.json();
        if (!remota || !remota.apkUrl) return;

        const buildAtual = parseInt(info.build, 10) || 0;
        const codigoRemoto = remota.versionCode || 0;

        // Se o build remoto for maior ou a versão for diferente
        const temNovaVersao =
          (codigoRemoto > 0 && codigoRemoto > buildAtual) ||
          (remota.versionName && remota.versionName !== info.version && buildAtual === 0);

        if (temNovaVersao) {
          // Verifica se o usuário optou por ignorar nesta sessão
          const ignorado = sessionStorage.getItem(`ignorar_update_${remota.versionName}`);
          if (!ignorado && !cancelado) {
            setAtualizacao(remota);
          }
        }
      } catch (err) {
        // Silencioso se estiver sem rede no momento
        console.warn('Verificação de atualização de APK:', err);
      }
    }

    verificar();

    return () => {
      cancelado = true;
    };
  }, []);

  if (!atualizacao) return null;

  function dispensar() {
    if (atualizacao) {
      sessionStorage.setItem(`ignorar_update_${atualizacao.versionName}`, 'true');
    }
    setAtualizacao(null);
  }

  function baixarAtualizacao() {
    if (!atualizacao?.apkUrl) return;
    setBaixando(true);
    // No Android Capacitor, redirecionar para a URL do APK inicia o download nativo do pacote
    window.location.href = atualizacao.apkUrl;
    setTimeout(() => {
      setBaixando(false);
    }, 4000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-card border border-card-border p-6 shadow-2xl relative">
        <button
          onClick={dispensar}
          className="absolute top-4 right-4 text-sub hover:text-main p-1 rounded-lg"
          title="Fechar"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-xl bg-brand-ocre/15 border border-brand-ocre/30 flex items-center justify-center text-brand-ocre shrink-0 shadow-inner">
            <Sparkles size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-ocre/15 text-brand-ocre text-[11px] font-bold tracking-wide uppercase mb-1">
              Nova Versão Disponível
            </div>
            <h3 className="text-base font-bold text-main">
              Atualização do Aprimore ERP
            </h3>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <p className="text-xs text-sub">
            Uma nova versão nativa do aplicativo está disponível para o seu celular.
          </p>
          <div className="p-3 rounded-xl bg-background border border-card-border/80 text-xs">
            <div className="flex justify-between items-center mb-1 text-[11px]">
              <span className="text-sub font-medium">Versão atual: <b className="text-main">{versaoInstalada || '1.0.0'}</b></span>
              <span className="text-emerald-500 font-bold">Nova: v{atualizacao.versionName}</span>
            </div>
            {atualizacao.notes && (
              <p className="text-[11px] text-sub pt-1 border-t border-card-border/50 leading-relaxed">
                {atualizacao.notes}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={dispensar}
            className="flex-1 py-3 px-4 rounded-xl border border-card-border text-xs font-bold text-sub hover:text-main hover:bg-card-hover transition-colors"
          >
            Lembrar depois
          </button>

          <button
            type="button"
            onClick={baixarAtualizacao}
            disabled={baixando}
            className="flex-1 py-3 px-4 rounded-xl bg-brand-ocre hover:bg-brand-ocre/90 text-white text-xs font-bold shadow-lg shadow-brand-ocre/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <Download size={16} />
            {baixando ? 'Iniciando...' : 'Atualizar Agora'}
          </button>
        </div>
      </div>
    </div>
  );
}
