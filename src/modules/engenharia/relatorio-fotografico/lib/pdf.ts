import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Exportação em PDF — alternativa ao "Montar PowerPoint" pra quem só quer
 * mandar o relatório pra frente rapidamente (WhatsApp, e-mail) sem precisar
 * abrir/editar num editor de slides depois. Não reaproveita o template do
 * banco (aquele é um .pptx real, editável) — é um layout próprio, fixo,
 * pensado só pra leitura.
 */

export interface SlidePdfEntrada {
  descricao?: string;
  ambiente?: string;
  comentario?: string;
  antes: Buffer;
  depois: Buffer;
  durante?: Buffer;
}

export interface CabecalhoPdf {
  titulo: string;
  banco: string;
  subtitulo?: string; // agência/UNIORG etc., já formatado
}

const A4_LARGURA = 595.28;
const A4_ALTURA = 841.89;
const MARGEM = 40;
const LARGURA_ALVO_FOTO = 700; // px — mantém o PDF leve, papel só precisa de ~150dpi numa metade de página

/** Redimensiona (sem cortar) pra manter o PDF leve — mesma lógica de DPI do pptx, ver lib/imagem.ts. */
async function prepararFoto(bytes: Buffer): Promise<{ bytes: Buffer; largura: number; altura: number }> {
  const normalizada = await sharp(bytes).rotate().resize({ width: LARGURA_ALVO_FOTO, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true });
  return { bytes: normalizada.data, largura: normalizada.info.width, altura: normalizada.info.height };
}

function escreverTextoQuebrado(page: PDFPage, texto: string, x: number, yInicial: number, larguraMax: number, font: PDFFont, tamanho: number, cor = rgb(0.15, 0.15, 0.15)): number {
  const palavras = texto.split(/\s+/);
  let linha = "";
  let y = yInicial;
  for (const palavra of palavras) {
    const tentativa = linha ? `${linha} ${palavra}` : palavra;
    if (font.widthOfTextAtSize(tentativa, tamanho) > larguraMax && linha) {
      page.drawText(linha, { x, y, size: tamanho, font, color: cor });
      y -= tamanho + 4;
      linha = palavra;
    } else {
      linha = tentativa;
    }
  }
  if (linha) {
    page.drawText(linha, { x, y, size: tamanho, font, color: cor });
    y -= tamanho + 4;
  }
  return y;
}

export async function montarRelatorioPdf(cabecalho: CabecalhoPdf, linhasCapa: [string, string | undefined][], slides: SlidePdfEntrada[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const ocre = rgb(0.78, 0.55, 0.13);

  // Capa
  const capa = doc.addPage([A4_LARGURA, A4_ALTURA]);
  capa.drawRectangle({ x: 0, y: A4_ALTURA - 180, width: A4_LARGURA, height: 180, color: ocre });
  capa.drawText(cabecalho.titulo, { x: MARGEM, y: A4_ALTURA - 100, size: 26, font: fontBold, color: rgb(1, 1, 1) });
  if (cabecalho.subtitulo) {
    capa.drawText(cabecalho.subtitulo, { x: MARGEM, y: A4_ALTURA - 130, size: 13, font, color: rgb(1, 1, 1) });
  }
  capa.drawText(`Banco: ${cabecalho.banco || "—"}`, { x: MARGEM, y: A4_ALTURA - 230, size: 12, font: fontBold });
  let yCapa = A4_ALTURA - 260;
  for (const [rotulo, valor] of linhasCapa) {
    if (!valor) continue;
    capa.drawText(`${rotulo}: ${valor}`, { x: MARGEM, y: yCapa, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
    yCapa -= 20;
  }
  capa.drawText(`${slides.length} registro(s) fotográfico(s)`, { x: MARGEM, y: MARGEM, size: 10, font, color: rgb(0.5, 0.5, 0.5) });

  // Um slide por página
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const page = doc.addPage([A4_LARGURA, A4_ALTURA]);
    let y = A4_ALTURA - MARGEM;

    page.drawText(`${i + 1}`, { x: MARGEM, y, size: 14, font: fontBold, color: ocre });
    const tituloSlide = s.descricao || s.ambiente || `Registro ${i + 1}`;
    page.drawText(tituloSlide, { x: MARGEM + 24, y, size: 14, font: fontBold });
    y -= 24;

    if (s.comentario) {
      y = escreverTextoQuebrado(page, s.comentario, MARGEM, y, A4_LARGURA - MARGEM * 2, font, 10);
    }
    y -= 10;

    const temTerceira = !!s.durante;
    const numFotos = temTerceira ? 3 : 2;
    const espacamento = 12;
    const larguraFoto = (A4_LARGURA - MARGEM * 2 - espacamento * (numFotos - 1)) / numFotos;
    const alturaMaxFoto = y - MARGEM - 20;

    const fotos = temTerceira ? [s.antes, s.durante!, s.depois] : [s.antes, s.depois];
    const rotulos = temTerceira ? ["ANTES", "DURANTE", "DEPOIS"] : ["ANTES", "DEPOIS"];

    let x = MARGEM;
    for (let f = 0; f < fotos.length; f++) {
      const preparada = await prepararFoto(fotos[f]);
      const img = await doc.embedJpg(preparada.bytes);
      const escala = Math.min(larguraFoto / img.width, alturaMaxFoto / img.height);
      const w = img.width * escala;
      const h = img.height * escala;
      const yImg = y - alturaMaxFoto + (alturaMaxFoto - h) / 2;
      page.drawImage(img, { x: x + (larguraFoto - w) / 2, y: yImg, width: w, height: h });
      page.drawText(rotulos[f], {
        x: x + larguraFoto / 2 - font.widthOfTextAtSize(rotulos[f], 9) / 2,
        y: yImg - 14,
        size: 9,
        font: fontBold,
        color: rgb(0.4, 0.4, 0.4),
      });
      x += larguraFoto + espacamento;
    }
  }

  return doc.save();
}
