import type { CamposRelatorio, ModeloCfg } from "../types";
import { escXml } from "./util";
import { limpaNome } from "./util";
import { gravarZip, lerZip, type Partes } from "./zip";
import { recortarEComprimir, type FotoLida } from "./imagem";

/*
 * Motor de geração do PowerPoint — porta fiel de
 * APRIMORE_ERP/server/src/lib/pptx.ts, por sua vez porta linha a linha do
 * protótipo original (relatorio-fotografico.html). Regras descobertas por
 * tentativa e erro contra arquivos reais do banco — ver
 * docs/02-REGRAS-DE-NEGOCIO.md daquele projeto. NÃO redescubra por
 * tentativa, NÃO simplifique — um arquivo que passa em validadores
 * automáticos (python-pptx, LibreOffice) já foi rejeitado pelo PowerPoint
 * de verdade sem essas sete correções.
 */

interface Retangulo {
  l: number;
  t: number;
  r: number;
  b: number;
}

function recorte(iw: number, ih: number, sw: number, sh: number): Retangulo {
  const ari = iw / ih;
  const ars = sw / sh;
  if (ari > ars) {
    const f = Math.round(((1 - ars / ari) / 2) * 100000);
    return { l: f, t: 0, r: f, b: 0 };
  }
  const f = Math.round(((1 - ari / ars) / 2) * 100000);
  return { l: 0, t: f, r: 0, b: f };
}

function achaForma(xml: string, nome: string): string {
  const re = new RegExp(
    '<p:sp>(?:(?!</p:sp>)[\\s\\S])*?name="' +
      nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
      '"(?:(?!</p:sp>)[\\s\\S])*?</p:sp>',
  );
  const m = xml.match(re);
  if (!m) throw new Error('Forma "' + nome + '" não encontrada no slide modelo.');
  return m[0];
}

interface Quadro {
  x: number;
  y: number;
  cx: number;
  cy: number;
}

function xfrmDe(bloco: string): Quadro | null {
  const off = bloco.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
  const ext = bloco.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
  if (!off || !ext) return null;
  return { x: +off[1]!, y: +off[2]!, cx: +ext[1]!, cy: +ext[2]! };
}

/* Alguns modelos preenchem a moldura direto (blipFill na própria forma);
   outros colocam uma <p:pic> solta por cima de uma moldura decorativa sem
   preenchimento. Detecta o caso encontrando a p:pic cujo centro cai dentro
   da moldura nomeada. */
function achaPicSobreForma(xml: string, quadro: Quadro): string | null {
  const re = /<p:pic>[\s\S]*?<\/p:pic>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const fr = xfrmDe(m[0]);
    if (!fr) continue;
    const cx = fr.x + fr.cx / 2;
    const cy = fr.y + fr.cy / 2;
    if (cx >= quadro.x && cx <= quadro.x + quadro.cx && cy >= quadro.y && cy <= quadro.y + quadro.cy) {
      return m[0];
    }
  }
  return null;
}

function preencheForma(xml: string, nomeForma: string, rId: string, foto: FotoLida): string {
  const sp = achaForma(xml, nomeForma);
  const quadro = xfrmDe(sp);
  if (!quadro) throw new Error('Sem dimensões na forma "' + nomeForma + '".');

  const picAntigo = achaPicSobreForma(xml, quadro);

  if (picAntigo) {
    // modelo com foto solta por cima da moldura: redimensiona a foto para
    // cobrir a moldura inteira e troca a imagem
    const rc = recorte(foto.largura, foto.altura, quadro.cx, quadro.cy);
    let novoPic = picAntigo.replace(/<a:blip r:embed="[^"]+"/, '<a:blip r:embed="' + rId + '"');
    novoPic = novoPic.replace(
      /<a:xfrm[^>]*>\s*<a:off x="-?\d+" y="-?\d+"\/>\s*<a:ext cx="\d+" cy="\d+"\/>\s*<\/a:xfrm>/,
      '<a:xfrm><a:off x="' + quadro.x + '" y="' + quadro.y + '"/><a:ext cx="' + quadro.cx + '" cy="' + quadro.cy + '"/></a:xfrm>',
    );
    const srcRect = '<a:srcRect l="' + rc.l + '" t="' + rc.t + '" r="' + rc.r + '" b="' + rc.b + '"/>';
    if (novoPic.includes("<a:srcRect")) novoPic = novoPic.replace(/<a:srcRect[^/]*\/>/, srcRect);
    else novoPic = novoPic.replace("<a:stretch>", srcRect + "<a:stretch>");
    return xml.replace(picAntigo, novoPic);
  }

  // modelo com preenchimento direto na própria forma
  const rc = recorte(foto.largura, foto.altura, quadro.cx, quadro.cy);
  let novo = sp.replace(/<a:custGeom>[\s\S]*?<\/a:custGeom>/, '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>');
  const fill =
    '<a:blipFill rotWithShape="1"><a:blip r:embed="' +
    rId +
    '"/>' +
    '<a:srcRect l="' +
    rc.l +
    '" t="' +
    rc.t +
    '" r="' +
    rc.r +
    '" b="' +
    rc.b +
    '"/>' +
    "<a:stretch><a:fillRect/></a:stretch></a:blipFill>";

  if (novo.includes("<a:noFill/>")) novo = novo.replace("<a:noFill/>", fill);
  else if (novo.includes("<a:blipFill")) novo = novo.replace(/<a:blipFill[\s\S]*?<\/a:blipFill>/, fill);
  else novo = novo.replace(/(<\/a:prstGeom>)/, "$1" + fill);

  return xml.replace(sp, novo);
}

const TIPO_IMG = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const TIPO_SLIDE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide";
const CT_SLIDE = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml";

export interface SlideDados {
  descricao: string;
  etapa1: "ANTES" | "DURANTE";
  antes: FotoLida;
  depois: FotoLida;
}

export interface DadosRelatorio {
  campos: CamposRelatorio;
  slides: SlideDados[];
}

function resolveRel(dirBase: string, alvo: string): string {
  const partesCaminho = dirBase.split("/");
  for (const seg of alvo.split("/")) {
    if (seg === "..") partesCaminho.pop();
    else if (seg !== ".") partesCaminho.push(seg);
  }
  return partesCaminho.join("/");
}

export async function montarRelatorio(
  bufferModelo: Buffer,
  cfg: ModeloCfg,
  dados: DadosRelatorio,
  aoProgredir?: (i: number, n: number) => void,
): Promise<Buffer> {
  const partes: Partes = lerZip(bufferModelo);
  const txt = (n: string): string => {
    const v = partes.get(n);
    if (v === undefined) throw new Error("Parte ausente no modelo: " + n);
    return v.toString("utf-8");
  };

  // --- descarta slides de exemplo além de capa (1,2) e do slide-molde ---
  const manter = new Set([1, 2, cfg.slideModelo]);
  const relsPresXml0 = txt("ppt/_rels/presentation.xml.rels");
  const mapaRid = new Map(
    [...relsPresXml0.matchAll(/<Relationship Id="(rId\d+)"[^>]*Target="slides\/slide(\d+)\.xml"/g)].map((m) => [
      m[1]!,
      +m[2]!,
    ]),
  );
  const extras: { tag: string; rid: string; num: number }[] = [];
  for (const m of txt("ppt/presentation.xml").matchAll(/<p:sldId[^>]*r:id="(rId\d+)"[^>]*\/>/g)) {
    const num = mapaRid.get(m[1]!);
    if (num && !manter.has(num)) extras.push({ tag: m[0], rid: m[1]!, num });
  }

  const candidatos = new Set<string>(); // caminhos completos que podem ficar órfãos
  let presRelsXml = relsPresXml0;
  let presXml = txt("ppt/presentation.xml");
  let ctXml = txt("[Content_Types].xml");

  for (const ex of extras) {
    const relsPath = "ppt/slides/_rels/slide" + ex.num + ".xml.rels";
    if (partes.has(relsPath)) {
      for (const m of txt(relsPath).matchAll(/Target="([^"]+)"/g)) {
        if (m[1]!.startsWith("http")) continue;
        candidatos.add(resolveRel("ppt/slides", m[1]!));
      }
      partes.delete(relsPath);
    }
    partes.delete("ppt/slides/slide" + ex.num + ".xml");
    presXml = presXml.replace(ex.tag, "");
    presRelsXml = presRelsXml.replace(new RegExp('<Relationship Id="' + ex.rid + '"[^>]*/>'), "");
    ctXml = ctXml.replace(new RegExp('<Override PartName="/ppt/slides/slide' + ex.num + '\\.xml"[^>]*/>'), "");
  }

  if (extras.length) {
    partes.set("ppt/presentation.xml", Buffer.from(presXml, "utf-8"));
    partes.set("ppt/_rels/presentation.xml.rels", Buffer.from(presRelsXml, "utf-8"));
    partes.set("[Content_Types].xml", Buffer.from(ctXml, "utf-8"));

    // remove partes (mídia, notas...) que só os slides descartados usavam
    let mudou = true;
    while (mudou) {
      mudou = false;
      const restante = [...partes.entries()]
        .filter(([n]) => n.endsWith(".rels") && !candidatos.has(n))
        .map(([, v]) => v.toString("utf-8"))
        .join("\n");
      for (const caminho of [...candidatos]) {
        const base = caminho.split("/").pop()!;
        if (partes.has(caminho) && !restante.includes(base)) {
          partes.delete(caminho);
          candidatos.delete(caminho);
          partes.set(
            "[Content_Types].xml",
            Buffer.from(
              txt("[Content_Types].xml").replace(
                new RegExp('<Override PartName="/' + caminho.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"[^>]*/>'),
                "",
              ),
              "utf-8",
            ),
          );
          const relsIrmao = caminho.replace(/([^/]+)$/, "_rels/$1.rels");
          if (partes.has(relsIrmao)) partes.delete(relsIrmao);
          mudou = true;
        }
      }
    }
  }

  // slides 1 e 2 — dados do projeto
  for (const campo of cfg.campos) {
    const valor = (dados.campos[campo.id] || "").trim();
    if (!valor) continue;
    const alvo = "ppt/slides/slide" + campo.slide + ".xml";
    let xml = txt(alvo);
    if (!xml.includes(campo.marcador)) continue;
    xml = xml.replace(campo.marcador, escXml((campo.prefixo || "") + valor));
    partes.set(alvo, Buffer.from(xml, "utf-8"));
  }

  // slide modelo do relatório
  const nomeBase = "ppt/slides/slide" + cfg.slideModelo + ".xml";
  const xmlBase = txt(nomeBase);
  const relsBase = txt("ppt/slides/_rels/slide" + cfg.slideModelo + ".xml.rels");

  // tamanho real das duas formas de foto no slide-molde (mesmo pra todos os
  // slides clonados) — usado pra cortar e comprimir cada foto no tamanho
  // exato que vai aparecer, em vez de embutir a foto inteira na resolução
  // da câmera.
  const quadroAntes = xfrmDe(achaForma(xmlBase, cfg.formaAntes));
  const quadroDepois = xfrmDe(achaForma(xmlBase, cfg.formaDepois));
  if (!quadroAntes || !quadroDepois) throw new Error("Sem dimensões nas formas de foto do slide-molde.");

  // o slide-molde pode ter uma <p:tags> (custDataLst) associada a UM slide
  // só; se ela for copiada para cada clone, vários slides passam a
  // reivindicar a mesma parte e o PowerPoint recusa o arquivo. Remove essa
  // tag de cada clone e, no fim, apaga a parte se ninguém mais usar.
  const mTag = relsBase.match(/<Relationship Id="(rId\w+)"[^>]*Type="[^"]*\/relationships\/tags"[^>]*Target="([^"]+)"/);
  const ridTags = mTag ? mTag[1]! : null;
  const alvoTags = mTag ? resolveRel("ppt/slides", mTag[2]!) : null;

  let nImg = 0;
  let addCT = "";
  let addRel = "";
  let addSld = "";
  let idSlide = 900;
  let nRid = 900;
  const numeroSlide = (i: number) => cfg.slideModelo + i;

  for (let i = 0; i < dados.slides.length; i++) {
    const s = dados.slides[i]!;
    let xml = xmlBase;
    if (ridTags) xml = xml.replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/, "");

    const etapa1 = s.etapa1 === "DURANTE" ? "DURANTE" : "ANTES";
    const novoRotulo1 = cfg.marcadorFoto1.replace(/\d+/, String(2 * i + 1).padStart(2, "0")).replace(/ANTES$/, etapa1);
    const novoRotulo2 = cfg.marcadorFoto2.replace(/\d+/, String(2 * i + 2).padStart(2, "0"));
    xml = xml.split(cfg.marcadorFoto1).join(novoRotulo1);
    xml = xml.split(cfg.marcadorFoto2).join(novoRotulo2);
    if (cfg.marcadorRotuloAntes) xml = xml.split(cfg.marcadorRotuloAntes).join(etapa1);
    xml = xml.split(cfg.marcadorDescricao).join(escXml(s.descricao));

    const antesComprimido = await recortarEComprimir(s.antes, quadroAntes);
    const depoisComprimido = await recortarEComprimir(s.depois, quadroDepois);

    const ridA = "rIdImgA" + i;
    const ridD = "rIdImgD" + i;
    const nomeA = "rf" + ++nImg + "." + antesComprimido.ext;
    const nomeD = "rf" + ++nImg + "." + depoisComprimido.ext;
    partes.set("ppt/media/" + nomeA, antesComprimido.bytes);
    partes.set("ppt/media/" + nomeD, depoisComprimido.bytes);

    xml = preencheForma(xml, cfg.formaAntes, ridA, antesComprimido);
    xml = preencheForma(xml, cfg.formaDepois, ridD, depoisComprimido);

    let rels = relsBase.replace(
      "</Relationships>",
      '<Relationship Id="' + ridA + '" Type="' + TIPO_IMG + '" Target="../media/' + nomeA + '"/>' +
        '<Relationship Id="' + ridD + '" Type="' + TIPO_IMG + '" Target="../media/' + nomeD + '"/>' +
        "</Relationships>",
    );
    if (ridTags) rels = rels.replace(new RegExp('<Relationship Id="' + ridTags + '"[^>]*/>'), "");

    const num = numeroSlide(i);
    partes.set("ppt/slides/slide" + num + ".xml", Buffer.from(xml, "utf-8"));
    partes.set("ppt/slides/_rels/slide" + num + ".xml.rels", Buffer.from(rels, "utf-8"));

    if (i > 0) {
      addCT += '<Override PartName="/ppt/slides/slide' + num + '.xml" ContentType="' + CT_SLIDE + '"/>';
      addRel += '<Relationship Id="rId' + nRid + '" Type="' + TIPO_SLIDE + '" Target="slides/slide' + num + '.xml"/>';
      addSld += '<p:sldId id="' + idSlide + '" r:id="rId' + nRid + '"/>';
      idSlide++;
      nRid++;
    }
    aoProgredir?.(i + 1, dados.slides.length);
  }

  if (ridTags && alvoTags && partes.has(alvoTags)) {
    partes.delete(alvoTags);
    const relsIrmao = alvoTags.replace(/([^/]+)$/, "_rels/$1.rels");
    if (partes.has(relsIrmao)) partes.delete(relsIrmao);
    partes.set(
      "[Content_Types].xml",
      Buffer.from(
        txt("[Content_Types].xml").replace(
          new RegExp('<Override PartName="/' + alvoTags.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"[^>]*/>'),
          "",
        ),
        "utf-8",
      ),
    );
  }

  if (addCT) {
    partes.set("[Content_Types].xml", Buffer.from(txt("[Content_Types].xml").replace("</Types>", addCT + "</Types>"), "utf-8"));
    partes.set(
      "ppt/_rels/presentation.xml.rels",
      Buffer.from(txt("ppt/_rels/presentation.xml.rels").replace("</Relationships>", addRel + "</Relationships>"), "utf-8"),
    );
    partes.set(
      "ppt/presentation.xml",
      Buffer.from(txt("ppt/presentation.xml").replace("</p:sldIdLst>", addSld + "</p:sldIdLst>"), "utf-8"),
    );
  }

  // correção 5: alguns modelos declaram .jpg com o tipo MIME errado
  // (image/jpg em vez de image/jpeg), o que faz o PowerPoint pedir reparo ao
  // abrir — corrige sempre, independente do que o modelo original trouxer
  const ctFinal = txt("[Content_Types].xml").replace(
    /Extension="jpg" ContentType="image\/jpg"/,
    'Extension="jpg" ContentType="image/jpeg"',
  );
  partes.set("[Content_Types].xml", Buffer.from(ctFinal, "utf-8"));

  // correção 6: docProps/app.xml guarda a contagem de slides e um vetor de
  // títulos; como clonamos slides, essa contagem fica desatualizada e o
  // PowerPoint também pede reparo por causa disso — sincroniza antes de gravar
  const extrasGerados = dados.slides.length - 1;
  if (extrasGerados > 0 && partes.has("docProps/app.xml")) {
    let app = txt("docProps/app.xml");
    app = app.replace(/<Slides>(\d+)<\/Slides>/, (_, n) => "<Slides>" + (parseInt(n, 10) + extrasGerados) + "</Slides>");
    app = app.replace(
      /(<vt:lpstr>Títulos de slides<\/vt:lpstr><\/vt:variant><vt:variant><vt:i4>)(\d+)(<\/vt:i4>)/,
      (_, a, n, b) => a + (parseInt(n, 10) + extrasGerados) + b,
    );
    app = app.replace(/<vt:vector size="(\d+)" baseType="lpstr">([\s\S]*?)<\/vt:vector>/, (_, tamanho, corpo) => {
      const itens = corpo.match(/<vt:lpstr>[\s\S]*?<\/vt:lpstr>/g) || [];
      const ultimo = itens[itens.length - 1] || "";
      return (
        '<vt:vector size="' + (parseInt(tamanho, 10) + extrasGerados) + '" baseType="lpstr">' +
        corpo +
        ultimo.repeat(extrasGerados) +
        "</vt:vector>"
      );
    });
    partes.set("docProps/app.xml", Buffer.from(app, "utf-8"));
  }

  return gravarZip(partes);
}

// Correção 7 (tags duplicadas entre slides clonados) está embutida acima —
// remoção de <p:custDataLst> de cada clone + exclusão da parte órfã no fim.

export const MODELOS_CFG: Record<string, ModeloCfg> = {
  /*
   * Confirmado por inspeção direta do arquivo em
   * Storage (relatorios-fotograficos/_templates/itau-personnalite.pptx,
   * baixado e analisado em 03/09/2026): o slide-molde (slide 3), os
   * marcadores dos slides 1-2 e os nomes das formas de foto são os MESMOS
   * pra infra e reforma — é o mesmo arquivo físico (confirmado pelo David),
   * a diferença entre os dois tipos está só na descrição que cada slide
   * recebe (equipamento+ponto vs. serviço+ambiente), não no template. O
   * config antigo daqui (formaAntes "object 11", marcadores "TROCA DE
   * ATM'S...") vinha de outro arquivo histórico que nunca foi enviado pro
   * Storage — dava erro "Forma não encontrada" na hora de gerar.
   */
  "itau-personnalite-reforma": {
    nome: "Itaú Personnalité — Reforma",
    slideModelo: 3,
    marcadorFoto1: "Foto 01 - ANTES",
    marcadorFoto2: "Foto 02 - DEPOIS",
    marcadorRotuloAntes: "ANTES",
    marcadorDescricao: "SENSOR DE PRESENÇA 01 (SANITÁRIO MASCULINO)",
    formaAntes: "Retângulo 14",
    formaDepois: "Retângulo 17",
    campos: [
      { id: "agencia", slide: 1, marcador: "8647PERSONNALITE RJ-CAMPOS" },
      { id: "programa", slide: 1, marcador: " UNIFICADAS – MODERNIZAÇÃO DO SISTEMA DE ALARME", prefixo: " " },
      { id: "upe", slide: 1, marcador: "226816" },
      { id: "sap", slide: 1, marcador: "CÓDIGO SAP:", prefixo: "CÓDIGO SAP: " },
      { id: "gestor", slide: 2, marcador: "GESTOR DE OBRAS : RITA DE CASSIA N. PINHEIRO", prefixo: "GESTOR DE OBRAS : " },
      { id: "fiscEmpresa", slide: 2, marcador: "EMPRESA: METROLL", prefixo: "EMPRESA: " },
      { id: "fiscal", slide: 2, marcador: "FISCAL: RITA DE CASSIA N. PINHEIRO", prefixo: "FISCAL: " },
      { id: "construtora", slide: 2, marcador: "EMPRESA: EGF CONSTRUTORA", prefixo: "EMPRESA: " },
      { id: "responsavel", slide: 2, marcador: "RESPONSÁVEL: JULIANA SINASTRO", prefixo: "RESPONSÁVEL: " },
      { id: "inicio", slide: 2, marcador: "INÍCIO: 28/08/2026", prefixo: "INÍCIO: " },
      { id: "termino", slide: 2, marcador: "TÉRMINO: 31/08/2026", prefixo: "TÉRMINO: " },
    ],
  },
  "itau-personnalite": {
    nome: "Itaú Personnalité",
    slideModelo: 3,
    marcadorFoto1: "Foto 01 - ANTES",
    marcadorFoto2: "Foto 02 - DEPOIS",
    marcadorRotuloAntes: "ANTES",
    marcadorDescricao: "SENSOR DE PRESENÇA 01 (SANITÁRIO MASCULINO)",
    formaAntes: "Retângulo 14",
    formaDepois: "Retângulo 17",
    campos: [
      { id: "agencia", slide: 1, marcador: "8647PERSONNALITE RJ-CAMPOS" },
      { id: "programa", slide: 1, marcador: " UNIFICADAS – MODERNIZAÇÃO DO SISTEMA DE ALARME", prefixo: " " },
      { id: "upe", slide: 1, marcador: "226816" },
      { id: "sap", slide: 1, marcador: "CÓDIGO SAP:", prefixo: "CÓDIGO SAP: " },
      { id: "gestor", slide: 2, marcador: "GESTOR DE OBRAS : RITA DE CASSIA N. PINHEIRO", prefixo: "GESTOR DE OBRAS : " },
      { id: "fiscEmpresa", slide: 2, marcador: "EMPRESA: METROLL", prefixo: "EMPRESA: " },
      { id: "fiscal", slide: 2, marcador: "FISCAL: RITA DE CASSIA N. PINHEIRO", prefixo: "FISCAL: " },
      { id: "construtora", slide: 2, marcador: "EMPRESA: EGF CONSTRUTORA", prefixo: "EMPRESA: " },
      { id: "responsavel", slide: 2, marcador: "RESPONSÁVEL: JULIANA SINASTRO", prefixo: "RESPONSÁVEL: " },
      { id: "inicio", slide: 2, marcador: "INÍCIO: 28/08/2026", prefixo: "INÍCIO: " },
      { id: "termino", slide: 2, marcador: "TÉRMINO: 31/08/2026", prefixo: "TÉRMINO: " },
    ],
  },
};

/** cfgAtual() no protótipo sempre devolve a config Itaú Personnalité (é o único banco com marcadores definidos até hoje). */
export function cfgAtual(): ModeloCfg {
  return MODELOS_CFG["itau-personnalite"]!;
}

export function nomeArquivoRelatorio(banco: string | undefined, agencia: string, nomeFallback: string): string {
  if (banco === "Itaú Personnalité") {
    return limpaNome("21 - PERSON REL. FOTOGRÁFICO FINAL - CONSTR - AG. " + agencia) + ".pptx";
  }
  return limpaNome("Relatório Fotográfico - " + (agencia || nomeFallback || "projeto")) + ".pptx";
}
