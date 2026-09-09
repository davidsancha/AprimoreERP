import { NextResponse } from 'next/server';
import { montarRelatorioPdf } from '@/modules/engenharia/relatorio-fotografico/lib/pdf';
import { limpaNome } from '@/modules/engenharia/relatorio-fotografico/lib/util';

/**
 * Roda em Node (não Edge) — mesma razão do /gerar (sharp é binário nativo).
 * Ver ali para o porquê do bucket público / download por URL sem sessão.
 */
export const runtime = 'nodejs';

interface SlideEntrada {
  descricao?: string;
  ambiente?: string;
  comentario?: string;
  fotoAntesPath: string;
  fotoDepoisPath: string;
  fotoDurantePath?: string;
}

interface CorpoRequisicao {
  linhasCapa: [string, string | undefined][];
  slides: SlideEntrada[];
  banco: string;
  subtitulo?: string;
  nomeFallback: string;
}

function baseStorage(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL não configurada.');
  return `${url}/storage/v1/object/public/relatorios-fotograficos`;
}

async function baixar(caminho: string): Promise<Buffer> {
  const codificado = caminho.split('/').map(encodeURIComponent).join('/');
  const resp = await fetch(`${baseStorage()}/${codificado}`);
  if (!resp.ok) throw new Error(`Falha ao baixar "${caminho}" do Storage (${resp.status}).`);
  return Buffer.from(await resp.arrayBuffer());
}

export async function POST(req: Request) {
  try {
    const corpo = (await req.json()) as CorpoRequisicao;
    if (!corpo.slides.length) {
      return NextResponse.json({ erro: 'Nenhum slide para montar.' }, { status: 400 });
    }
    if (corpo.slides.some((s) => !s.fotoAntesPath || !s.fotoDepoisPath)) {
      return NextResponse.json({ erro: 'Há slide(s) sem as duas fotos — complete antes de exportar.' }, { status: 400 });
    }

    const slides = await Promise.all(
      corpo.slides.map(async (s) => {
        const [antes, depois, durante] = await Promise.all([
          baixar(s.fotoAntesPath),
          baixar(s.fotoDepoisPath),
          s.fotoDurantePath ? baixar(s.fotoDurantePath) : Promise.resolve(undefined),
        ]);
        return { descricao: s.descricao, ambiente: s.ambiente, comentario: s.comentario, antes, depois, durante };
      }),
    );

    const pdf = await montarRelatorioPdf(
      { titulo: 'Relatório Fotográfico', banco: corpo.banco, subtitulo: corpo.subtitulo },
      corpo.linhasCapa || [],
      slides,
    );

    const nomeArquivo = `${limpaNome(corpo.nomeFallback || 'relatorio')}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(nomeArquivo)}"`,
      },
    });
  } catch (e) {
    console.error('[relatorio-fotografico/gerar-pdf]', e);
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
