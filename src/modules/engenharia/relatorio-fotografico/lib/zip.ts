import zlib from "node:zlib";

/*
 * Leitura e escrita de .pptx sem bibliotecas externas — porta fiel de
 * APRIMORE_ERP/server/src/lib/zip.ts (por sua vez, porta do protótipo
 * relatorio-fotografico.html trocando DecompressionStream do navegador por
 * zlib.inflateRawSync do Node). Grava sempre sem compressão (STORE).
 */

const TAB_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TAB_CRC[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export type Partes = Map<string, Buffer>;

/** Lê um .pptx e devolve Map(nome -> Buffer) com o conteúdo já descompactado. */
export function lerZip(buffer: Buffer): Partes {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 66000); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Arquivo .pptx inválido (fim do zip não encontrado).");

  const total = buffer.readUInt16LE(eocd + 10);
  let p = buffer.readUInt32LE(eocd + 16);
  const partes: Partes = new Map();

  for (let n = 0; n < total; n++) {
    if (buffer.readUInt32LE(p) !== 0x02014b50) throw new Error("Zip corrompido.");
    const metodo = buffer.readUInt16LE(p + 10);
    const tamComp = buffer.readUInt32LE(p + 20);
    const lenNome = buffer.readUInt16LE(p + 28);
    const lenExtra = buffer.readUInt16LE(p + 30);
    const lenCom = buffer.readUInt16LE(p + 32);
    const offLocal = buffer.readUInt32LE(p + 42);
    const nome = buffer.subarray(p + 46, p + 46 + lenNome).toString("utf-8");

    const lnNome = buffer.readUInt16LE(offLocal + 26);
    const lnExtra = buffer.readUInt16LE(offLocal + 28);
    const ini = offLocal + 30 + lnNome + lnExtra;
    const bruto = buffer.subarray(ini, ini + tamComp);

    partes.set(nome, metodo === 8 ? zlib.inflateRawSync(bruto) : Buffer.from(bruto));
    p += 46 + lenNome + lenExtra + lenCom;
  }
  return partes;
}

/** Monta um .pptx a partir de Map(nome -> Buffer | string). */
export function gravarZip(partes: Map<string, Buffer | string>): Buffer {
  const locais: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const [nome, conteudo] of partes) {
    const dados = typeof conteudo === "string" ? Buffer.from(conteudo, "utf-8") : conteudo;
    const nomeBytes = Buffer.from(nome, "utf-8");
    const crc = crc32(dados);

    const lh = Buffer.alloc(30 + nomeBytes.length);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6); // nomes em UTF-8
    lh.writeUInt16LE(0, 8); // STORE
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(dados.length, 18);
    lh.writeUInt32LE(dados.length, 22);
    lh.writeUInt16LE(nomeBytes.length, 26);
    nomeBytes.copy(lh, 30);

    locais.push(lh, dados);

    const ch = Buffer.alloc(46 + nomeBytes.length);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(0, 10);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(dados.length, 20);
    ch.writeUInt32LE(dados.length, 24);
    ch.writeUInt16LE(nomeBytes.length, 28);
    ch.writeUInt32LE(offset, 42);
    nomeBytes.copy(ch, 46);
    central.push(ch);

    offset += lh.length + dados.length;
  }

  const inicioCD = offset;
  const tamCD = central.reduce((s, c) => s + c.length, 0);

  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(partes.size, 8);
  fim.writeUInt16LE(partes.size, 10);
  fim.writeUInt32LE(tamCD, 12);
  fim.writeUInt32LE(inicioCD, 16);

  return Buffer.concat([...locais, ...central, fim]);
}
