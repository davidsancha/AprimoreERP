import { registerPlugin } from '@capacitor/core';

interface AbrirArquivoPluginApi {
  abrir(options: { path: string; mimeType?: string }): Promise<void>;
}

const AbrirArquivo = registerPlugin<AbrirArquivoPluginApi>('AbrirArquivo');

/**
 * Dispara o Android pra abrir um arquivo já salvo no aparelho (ACTION_VIEW
 * via FileProvider — ver AbrirArquivoPlugin.kt). Usado pela atualização do
 * app: assim que o .apk termina de baixar, chama isso com
 * "application/vnd.android.package-archive" e o instalador do sistema abre
 * sozinho, em vez de só avisar "abra o arquivo pra instalar".
 */
export async function abrirArquivoNativo(path: string, mimeType?: string): Promise<void> {
  await AbrirArquivo.abrir({ path, mimeType });
}
