import sharp from "sharp";

/*
 * NOTA (integração): `sharp` ainda não é dependência deste repositório —
 * precisa ser adicionado (`npm install sharp`) antes deste módulo compilar.
 * Ver README.md desta pasta, pergunta 5 para o Antigravity.
 */

export interface FotoLida {
  bytes: Buffer;
  largura: number;
  altura: number;
  ext: "png" | "jpg";
}

/**
 * Recebe os bytes já baixados do Supabase Storage (não lê mais de disco
 * local — porta leFoto() de APRIMORE_ERP/server/src/lib/imagem.ts). Usa
 * sharp pra normalizar rotação EXIF: fotos de celular (retrato) costumam
 * vir com os pixels em paisagem + uma flag de rotação; sem normalizar,
 * o corte abaixo calcularia a proporção errada e a foto sairia deitada.
 */
export async function normalizarFoto(bruto: Buffer): Promise<FotoLida> {
  const normalizada = await sharp(bruto).rotate().toBuffer({ resolveWithObject: true });
  return {
    bytes: normalizada.data,
    largura: normalizada.info.width,
    altura: normalizada.info.height,
    ext: normalizada.info.format === "png" ? "png" : "jpg",
  };
}

const EMU_POR_POLEGADA = 914400;
const DPI_ALVO = 150;
const QUALIDADE_JPEG = 85;

/**
 * Corta de verdade (não só via srcRect do PowerPoint) a foto para a área que
 * efetivamente aparece dentro da forma do slide, redimensiona pra ~150 DPI
 * em relação ao tamanho físico real da forma e recomprime como JPEG.
 *
 * Sem isso, a foto inteira (resolução de câmera) vai parar dentro do
 * .pptx — um relatório de 35 slides chegou a 161MB por essa causa exata,
 * no app local. Sempre aplica, não é opcional.
 */
export async function recortarEComprimir(foto: FotoLida, quadroEMU: { cx: number; cy: number }): Promise<FotoLida> {
  const larguraAlvo = Math.max(1, Math.round((quadroEMU.cx / EMU_POR_POLEGADA) * DPI_ALVO));
  const alturaAlvo = Math.max(1, Math.round((quadroEMU.cy / EMU_POR_POLEGADA) * DPI_ALVO));

  const ari = foto.largura / foto.altura;
  const ars = larguraAlvo / alturaAlvo;
  let left = 0;
  let top = 0;
  let width = foto.largura;
  let height = foto.altura;
  if (ari > ars) {
    width = Math.max(1, Math.round(foto.altura * ars));
    left = Math.round((foto.largura - width) / 2);
  } else if (ari < ars) {
    height = Math.max(1, Math.round(foto.largura / ars));
    top = Math.round((foto.altura - height) / 2);
  }

  const bytes = await sharp(foto.bytes)
    .extract({ left, top, width, height })
    .resize(larguraAlvo, alturaAlvo)
    .jpeg({ quality: QUALIDADE_JPEG })
    .toBuffer();

  return { bytes, largura: larguraAlvo, altura: alturaAlvo, ext: "jpg" };
}
