import { NextResponse } from 'next/server';
import { montarRelatorio, MODELOS_CFG, nomeArquivoRelatorio } from '@/modules/engenharia/relatorio-fotografico/lib/pptx';
import { normalizarFoto } from '@/modules/engenharia/relatorio-fotografico/lib/imagem';
import { IMAGEM_PENDENTE_BASE64 } from '@/modules/engenharia/relatorio-fotografico/lib/imagemPendente';
import type { CamposRelatorio } from '@/modules/engenharia/relatorio-fotografico/types';

/**
 * Roda em Node (não Edge) — `sharp` (recorte/compressão real da foto, ver
 * lib/imagem.ts) é um binário nativo, não existe em runtime de browser nem
 * Edge. Bucket `relatorios-fotograficos` é público (migration 00008), então
 * baixar template e fotos por URL não precisa de sessão autenticada aqui —
 * os dados em si (campos, lista de slides) vêm prontos no corpo da
 * requisição, já buscados pelo client autenticado antes de chamar esta rota.
 */
export const runtime = 'nodejs';

interface SlideEntrada {
  descricao?: string;
  ambiente?: string;
  comentario?: string;
  etapa1: 'ANTES' | 'DURANTE';
  // foto ausente (null/vazia) vira a imagem padrão "IMAGEM PENDENTE" — o
  // usuário confirma isso na tela antes de chamar esta rota
  fotoAntesPath?: string | null;
  fotoDepoisPath?: string | null;
  // só o modelo Santander usa (3 fotos por slide — ver ModeloCfg.formaDurante)
  fotoDurantePath?: string | null;
}

interface CorpoRequisicao {
  configId: string;
  templatePath: string;
  campos: CamposRelatorio;
  slides: SlideEntrada[];
  banco: string;
  agencia: string;
  nomeFallback: string;
  uniorg?: string;
}

function baseStorage(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL não configurada.');
  return `${url}/storage/v1/object/public/relatorios-fotograficos`;
}

/**
 * Nomes de serviço/equipamento viram segmento de pasta (ex.: "TROCA DE
 * ATMS/ANTES/arquivo.jpg") e podem ter espaço — sem codificar cada segmento,
 * o `fetch` monta uma URL inválida e o download falha silenciosamente (era
 * a causa do "Montar PowerPoint" não gerar arquivo nenhum).
 */
async function baixar(caminho: string): Promise<Buffer> {
  const codificado = caminho.split('/').map(encodeURIComponent).join('/');
  const resp = await fetch(`${baseStorage()}/${codificado}`);
  if (!resp.ok) throw new Error(`Falha ao baixar "${caminho}" do Storage (${resp.status}).`);
  return Buffer.from(await resp.arrayBuffer());
}

function imagemPendente(): Promise<Buffer> {
  return Promise.resolve(Buffer.from(IMAGEM_PENDENTE_BASE64, 'base64'));
}

export async function POST(req: Request) {
  try {
    const corpo = (await req.json()) as CorpoRequisicao;
    const cfg = MODELOS_CFG[corpo.configId];
    if (!cfg) {
      return NextResponse.json({ erro: 'Este modelo ainda não tem marcadores de geração configurados.' }, { status: 400 });
    }
    if (!corpo.templatePath) {
      return NextResponse.json({ erro: 'Modelo sem arquivo de template no Storage.' }, { status: 400 });
    }
    if (!corpo.slides.length) {
      return NextResponse.json({ erro: 'Nenhum slide para montar.' }, { status: 400 });
    }
    const bufferModelo = await baixar(corpo.templatePath);

    const slides = await Promise.all(
      corpo.slides.map(async (s) => {
        const [antesBruto, depoisBruto, duranteBruto] = await Promise.all([
          s.fotoAntesPath ? baixar(s.fotoAntesPath) : imagemPendente(),
          s.fotoDepoisPath ? baixar(s.fotoDepoisPath) : imagemPendente(),
          s.fotoDurantePath ? baixar(s.fotoDurantePath) : cfg.formaDurante ? imagemPendente() : Promise.resolve(null),
        ]);
        const [antes, depois, durante] = await Promise.all([
          normalizarFoto(antesBruto),
          normalizarFoto(depoisBruto),
          duranteBruto ? normalizarFoto(duranteBruto) : Promise.resolve(undefined),
        ]);
        return { descricao: s.descricao, ambiente: s.ambiente, comentario: s.comentario, etapa1: s.etapa1, antes, depois, durante };
      }),
    );

    const pptx = await montarRelatorio(bufferModelo, cfg, { campos: corpo.campos, slides });
    const nomeArquivo = nomeArquivoRelatorio(corpo.banco, corpo.agencia, corpo.nomeFallback, corpo.configId, corpo.uniorg);

    return new NextResponse(new Uint8Array(pptx), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(nomeArquivo)}"`,
      },
    });
  } catch (e) {
    console.error('[relatorio-fotografico/gerar]', e);
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
