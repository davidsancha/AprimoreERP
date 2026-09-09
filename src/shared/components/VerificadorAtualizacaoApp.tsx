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

  // O plugin nativo (AbrirArquivo) só existe a partir da atualização que o
  // introduziu — quem ainda está numa versão do app anterior a ele não tem
  // o plugin instalado (o JS carrega remoto e atualiza na hora, mas plugin
  // nativo só entra com um APK novo de verdade). Sem ele, tentar salvar o
  // .apk de dentro do próprio app (Filesystem.writeFile, em qualquer pasta
  // — Documents ou External) deu "open failed: EACCES" nesse aparelho: o
  // app nunca declarou a permissão de escrita legada que o Android exige
  // pra isso em várias versões, e não dá pra corrigir isso plugin nenhum
  // sem antes já ter o plugin (mesmo problema do ovo e da galinha). Única
  // saída confiável pra essa primeira instalação: baixar pelo navegador de
  // verdade do celular (Chrome), que tem seu próprio gerenciador de
  // download/instalação sem essas restrições — em vez de tentar salvar o
  // arquivo de dentro do WebView do app.
  const pluginDisponivel = Capacitor.isPluginAvailable('AbrirArquivo');

  async function baixarAtualizacao() {
    if (!atualizacao?.apkUrl) return;
    setBaixando(true);
    setMensagemBaixar(null);
    try {
      const resp = await fetch(atualizacao.apkUrl);
      if (!resp.ok) throw new Error(`Falha ao baixar (HTTP ${resp.status})`);
      const blob = await resp.blob();
      const nomeArquivo = atualizacao.apkUrl.split('/').pop()?.split('?')[0] || 'aprimore-erp.apk';
      const base64 = await blobParaBase64(blob);
      const caminho = `AprimoreERP/${nomeArquivo}`;
      // Directory.External (armazenamento externo PRÓPRIO do app) — não
      // precisa de nenhuma permissão especial, ao contrário da pasta
      // pública. Só chega até aqui quando o plugin já existe (ver botão
      // abaixo), então quem abre o arquivo de volta é o próprio app via
      // FileProvider — ninguém precisa navegar até essa pasta na mão.
      const { uri } = await Filesystem.writeFile({
        path: caminho,
        data: base64,
        directory: Directory.External,
        recursive: true,
      });
      const caminhoLocal = uri.replace(/^file:\/\//, '');
      await abrirArquivoNativo(caminhoLocal, 'application/vnd.android.package-archive');
      // Fecha a notificação assim que o instalador abre — não precisa mais
      // ficar na tela, o Android já assumiu o resto do fluxo.
      setAtualizacao(null);
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

        {pluginDisponivel ? (
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
        ) : (
          // Sem o plugin, nada que a gente faça de dentro do WebView do app
          // consegue baixar/instalar sozinho (nem navegação de link comum
          // funciona pra ejetar pro navegador — allowNavigation: ['*']
          // mantém tudo dentro do próprio app). Único caminho confiável:
          // a pessoa abrir esse link no navegador de verdade do celular.
          <div className="space-y-2.5">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-500 leading-relaxed">
              Essa é a primeira atualização depois de uma mudança grande — dessa vez precisa ser pelo navegador do celular, fora do app. Copie o link abaixo e abra no Chrome (ou outro navegador). Depois de instalar, as próximas atualizações já acontecem sozinhas por aqui.
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={atualizacao.apkUrl}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-background border border-card-border text-[10px] text-main"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(atualizacao.apkUrl);
                    setMensagemBaixar({ texto: 'Link copiado! Cole no navegador do celular.', erro: false });
                  } catch {
                    setMensagemBaixar({ texto: 'Não deu pra copiar automaticamente — selecione o link acima na mão.', erro: true });
                  }
                }}
                className="shrink-0 px-3 py-2.5 rounded-lg bg-brand-ocre text-white text-[11px] font-bold"
              >
                Copiar
              </button>
            </div>
            <button
              type="button"
              onClick={dispensar}
              className="w-full py-2.5 rounded-xl border border-card-border text-xs font-bold text-sub hover:text-main hover:bg-card-hover transition-colors"
            >
              Lembrar depois
            </button>
          </div>
        )}
        {mensagemBaixar && (
          <p className={`mt-3 text-[11px] font-semibold text-center ${mensagemBaixar.erro ? 'text-red-600' : 'text-emerald-600'}`}>
            {mensagemBaixar.texto}
          </p>
        )}
      </div>
    </div>
  );
}
