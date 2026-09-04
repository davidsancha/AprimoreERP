import { Capacitor, registerPlugin } from '@capacitor/core';

interface FastGalleryPhoto {
  path: string;
  name: string;
  mimeType: string;
}

interface FastGalleryResult {
  photos: FastGalleryPhoto[];
}

interface FastGalleryPluginApi {
  pick(): Promise<FastGalleryResult>;
}

const FastGallery = registerPlugin<FastGalleryPluginApi>('FastGallery');

/** True só dentro do app nativo (Capacitor/Android) — no navegador comum usamos o `<input type="file">` normal. */
export function temGaleriaNativa(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Abre a grade nativa estilo WhatsApp (pasta da câmera por padrão, ver
 * FastGalleryActivity.kt) e devolve as fotos escolhidas já como `File`,
 * prontas pro mesmo pipeline de upload usado no navegador
 * (uploadFotoRelatorio espera um `File`).
 */
export async function escolherFotosDaGaleriaNativa(): Promise<File[]> {
  const { photos } = await FastGallery.pick();
  const arquivos: File[] = [];
  for (const foto of photos) {
    const url = Capacitor.convertFileSrc(foto.path);
    const resposta = await fetch(url);
    const blob = await resposta.blob();
    arquivos.push(new File([blob], foto.name, { type: foto.mimeType || blob.type }));
  }
  return arquivos;
}
