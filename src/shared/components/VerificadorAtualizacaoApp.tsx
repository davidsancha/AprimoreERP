'use client';

import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Download, Sparkles, X } from 'lucide-react';
import { abrirArquivoNativo } from '@/shared/lib/abrirArquivo';
import { blobParaBase64 } from '@/shared/lib/salvarArquivo';
import { URL_VERSAO_APK_JSON, type VersaoRemotaApk } from '@/shared/lib/apkAtualizacao';

export default function VerificadorAtualizacaoApp() {
  const [atualizacao, setAtualizacao] = useState<VersaoRemotaApk | null>(null);
  const [versaoInstalada, setVersaoInstalada] = useState<string>('');
  const [baixando, setBaixando] = useState(false);
  const [mensagemBaixar, setMensagemBaixar] = useState<{ texto: string; erro: boolean } | null>(null);

  useEffect(() => {
    // Só executa quando o usuário estiver rodando pelo App Android instalado
    if (!Capacitor.isNativePlatform()) return;

    let cancelado = false;

    async function verificar() {
      try {
        const info = await App.getInfo();
        if (cancelado) return;
        setVersaoInstalada(info.version || info.build);

        const resp = await fetch(`${URL_VERSAO_APK_JSON}?_t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!resp.ok) return;

        const remota: VersaoRemotaApk = await resp.json();
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

  async function baixarAtualizacao() {
    if (!atualizacao?.apkUrl) return;
    setBaixando(true);
    setMensagemBaixar(null);
    try {
      // `window.location.href = apkUrl` funcionava antes porque navegar pra
      // fora do domínio do app ejetava pro Chrome (que sabe baixar/instalar
      // .apk) — ver Bridge.launchIntent(). Isso parou de acontecer quando
      // `allowNavigation: ['*']` passou a manter toda navegação dentro do
      // próprio WebView (fix do problema de SSO da Vercel): agora o link do
      // APK "carrega" dentro do app, que não tem gerenciador de download, e
      // o clique parecia não fazer nada — mesma causa raiz do bug do PPTX.
      const resp = await fetch(atualizacao.apkUrl);
      if (!resp.ok) throw new Error(`Falha ao baixar (HTTP ${resp.status})`);
      const blob = await resp.blob();
      const nomeArquivo = atualizacao.apkUrl.split('/').pop()?.split('?')[0] || 'aprimore-erp.apk';
      const base64 = await blobParaBase64(blob);
      const caminho = `AprimoreERP/${nomeArquivo}`;
      // Directory.External (armazenamento externo PRÓPRIO do app) em vez de
      // Directory.Documents (pasta pública) — a pública esbarra no escopo de
      // storage do Android 10+ e dava "open failed: EACCES" ao tentar abrir
      // o arquivo de volta pra instalar (Directory.Documents só funciona sem
      // travas com android:requestLegacyExternalStorage, que este app não
      // tem). Directory.External não precisa de permissão nenhuma.
      const { uri } = await Filesystem.writeFile({
        path: caminho,
        data: base64,
        directory: Directory.External,
        recursive: true,
      });
      const caminhoLocal = uri.replace(/^file:\/\//, '');

      // O plugin nativo (AbrirArquivo) só existe a partir desta própria
      // atualização — quem ainda está numa versão do app anterior a ele não
      // tem o plugin instalado (o JS carrega remoto e atualiza na hora, mas
      // plugin nativo só entra com um APK novo de verdade), e chamá-lo
      // quebraria com "plugin is not implemented on Android". Checa antes:
      // se não tiver, cai pro fluxo manual de sempre (só dessa vez — depois
      // que a pessoa instalar esta versão, as próximas já vêm com o plugin
      // e instalam sozinhas).
      if (Capacitor.isPluginAvailable('AbrirArquivo')) {
        await abrirArquivoNativo(caminhoLocal, 'application/vnd.android.package-archive');
        // Fecha a notificação assim que o instalador abre — não precisa
        // mais ficar na tela, o Android já assumiu o resto do fluxo.
        setAtualizacao(null);
      } else {
        setMensagemBaixar({
          texto: 'Baixado! Abra o arquivo pelo app Arquivos do celular pra instalar (a partir da próxima atualização isso já acontece sozinho).',
          erro: false,
        });
      }
    } catch (err) {
      setMensagemBaixar({ texto: err instanceof Error ? err.message : 'Não foi possível baixar a atualização.', erro: true });
    } finally {
      setBaixando(false);
    }
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
            {baixando ? 'Baixando...' : 'Atualizar Agora'}
          </button>
        </div>
        {mensagemBaixar && (
          <p className={`mt-3 text-[11px] font-semibold text-center ${mensagemBaixar.erro ? 'text-red-600' : 'text-emerald-600'}`}>
            {mensagemBaixar.texto}
          </p>
        )}
      </div>
    </div>
  );
}
