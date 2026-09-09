'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, Smartphone, X } from 'lucide-react';
import { URL_VERSAO_APK_JSON, type VersaoRemotaApk } from '@/shared/lib/apkAtualizacao';

const CHAVE_DISPENSADA = 'sugestao_instalar_app_dispensada';

/**
 * Barra fina no topo da navegação mobile sugerindo baixar o app nativo —
 * só aparece pra quem já está acessando pelo navegador do celular (nunca
 * dentro do próprio app instalado) e ainda não dispensou o aviso. O app
 * nativo evita o problema do WebView pra anexar fotos (câmera/galeria
 * direto, ver fastGallery.ts) que o navegador comum não tem.
 */
export default function SugestaoInstalarApp() {
  const [apkUrl, setApkUrl] = useState<string | null>(null);
  const [dispensada, setDispensada] = useState(true);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    try {
      if (localStorage.getItem(CHAVE_DISPENSADA) === 'true') return;
    } catch {
      // localStorage indisponível — segue sem lembrar a dispensa
    }
    setDispensada(false);

    fetch(`${URL_VERSAO_APK_JSON}?_t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((remota: VersaoRemotaApk | null) => {
        if (remota?.apkUrl) setApkUrl(remota.apkUrl);
      })
      .catch(() => {});
  }, []);

  if (dispensada || !apkUrl) return null;

  function dispensar() {
    try {
      localStorage.setItem(CHAVE_DISPENSADA, 'true');
    } catch {
      // segue mesmo sem conseguir persistir — só não vai lembrar da escolha
    }
    setDispensada(true);
  }

  return (
    <div className="md:hidden flex items-center gap-2 px-3 py-2 bg-brand-ocre/10 border-b border-brand-ocre/20 text-brand-ocre">
      <Smartphone size={16} className="shrink-0" />
      <p className="flex-1 text-[11px] font-semibold leading-tight">
        Baixe o app Aprimore ERP — melhor pra anexar fotos.
      </p>
      <a
        href={apkUrl}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-ocre text-white text-[11px] font-bold shrink-0"
      >
        <Download size={12} /> Baixar
      </a>
      <button type="button" onClick={dispensar} className="p-1 text-brand-ocre/70 hover:text-brand-ocre shrink-0" title="Dispensar">
        <X size={16} />
      </button>
    </div>
  );
}
