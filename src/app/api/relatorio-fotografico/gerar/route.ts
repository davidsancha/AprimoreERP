import { NextResponse } from 'next/server';
import { montarRelatorio, MODELOS_CFG, nomeArquivoRelatorio } from '@/modules/engenharia/relatorio-fotografico/lib/pptx';
import { normalizarFoto } from '@/modules/engenharia/relatorio-fotografico/lib/imagem';
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
  descricao: string;
  etapa1: 'ANTES' | 'DURANTE';
  fotoAntesPath: string;
  fotoDepoisPath: string;
}

interface CorpoRequisicao {
  configId: string;
  templatePath: string;
  campos: CamposRelatorio;
  slides: SlideEntrada[];
  banco: string;
  agencia: string;
  nomeFallback: string;
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
    // defesa em profundidade — o client já bloqueia isso, mas a rota não confia cegamente no corpo
    if (corpo.slides.some((s) => !s.fotoAntesPath || !s.fotoDepoisPath)) {
      return NextResponse.json({ erro: 'Há slide(s) sem as duas fotos — complete antes de montar.' }, { status: 400 });
    }

    const bufferModelo = await baixar(corpo.templatePath);

    const slides = await Promise.all(
      corpo.slides.map(async (s) => {
        const [antesBruto, depoisBruto] = await Promise.all([baixar(s.fotoAntesPath), baixar(s.fotoDepoisPath)]);
        const [antes, depois] = await Promise.all([normalizarFoto(antesBruto), normalizarFoto(depoisBruto)]);
        return { descricao: s.descricao, etapa1: s.etapa1, antes, depois };
      }),
    );

    const pptx = await montarRelatorio(bufferModelo, cfg, { campos: corpo.campos, slides });
    const nomeArquivo = nomeArquivoRelatorio(corpo.banco, corpo.agencia, corpo.nomeFallback, corpo.configId);

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
