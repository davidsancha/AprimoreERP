import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'Conteúdo do QR Code é obrigatório' }, { status: 400 });
    }

    const isHttpUrl = url.trim().startsWith('http://') || url.trim().startsWith('https://');

    if (!isHttpUrl) {
      return NextResponse.json({ error: 'Formato inválido. Apenas URLs da SEFAZ são suportadas nesta versão sem IA.' }, { status: 400 });
    }

    let htmlContent = '';
    try {
      const fetchResponse = await fetch(url.trim(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(10000)
      });
      htmlContent = await fetchResponse.text();
    } catch (e) {
      console.error('Erro ao fazer fetch da URL SEFAZ:', e);
      return NextResponse.json({ error: 'Falha ao carregar os dados da SEFAZ.' }, { status: 500 });
    }

    const $ = cheerio.load(htmlContent);

    // 1. Extrair Nome da Loja
    let loja_nome = $('#u20').text().trim() || 'Nome do Estabelecimento Não Identificado';

    // 2. Extrair CNPJ
    let cnpj = '';
    const textElements = $('.text').toArray();
    for (const el of textElements) {
      const text = $(el).text();
      if (text.includes('CNPJ:')) {
        const match = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2}/);
        if (match) {
          cnpj = match[0].replace(/\D/g, '');
          break;
        }
      }
    }

    // 3. Extrair Data de Emissão
    let data_emissao = null;
    for (const el of textElements) {
      const text = $(el).text();
      if (text.includes('Emissão:')) {
        // Formato: Emissão: 03/06/2026 14:30:00
        const match = text.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})/);
        if (match) {
          data_emissao = `${match[3]}-${match[2]}-${match[1]}T${match[4]}Z`;
          break;
        }
      }
    }

    // 4. Extrair Chave de Acesso
    let chave_acesso = '';
    const chaveEl = $('.chave').text().trim() || $('#conteudo .text').text().trim();
    const chaveMatch = chaveEl.replace(/\s/g, '').match(/\d{44}/);
    if (chaveMatch) {
      chave_acesso = chaveMatch[0];
    }

    // 5. Extrair Valor Total
    let valor_total = 0;
    const totalText = $('#totalNota .txtMax').text() || $('#totalNota').text() || $('.txtMax').text();
    const totalMatch = totalText.match(/[\d\.]+\,\d{2}/);
    if (totalMatch) {
      valor_total = parseFloat(totalMatch[0].replace('.', '').replace(',', '.'));
    }

    // 6. Extrair Itens
    const itens: any[] = [];
    $('#tabResult tr').each((i, el) => {
      const nome_item = $(el).find('.txtTit').text().trim();
      const qtdText = $(el).find('.Rqtd').text().match(/[\d\.]+\,\d+/);
      const vUnitText = $(el).find('.RvlUnit').text().match(/[\d\.]+\,\d{2}/);
      const vTotalText = $(el).find('.valor').text().match(/[\d\.]+\,\d{2}/);

      if (nome_item) {
        const quantidade = qtdText ? parseFloat(qtdText[0].replace('.', '').replace(',', '.')) : 1;
        const valor_unitario = vUnitText ? parseFloat(vUnitText[0].replace('.', '').replace(',', '.')) : 0;
        const valor_total_item = vTotalText ? parseFloat(vTotalText[0].replace('.', '').replace(',', '.')) : (quantidade * valor_unitario);

        itens.push({
          nome_item,
          quantidade,
          valor_unitario,
          valor_total: valor_total_item
        });
      }
    });

    const notaFiscal = {
      loja_nome,
      cnpj,
      data_emissao,
      endereco: 'Não extraído via HTML básico',
      valor_total,
      chave_acesso,
      url_qr_code: url,
      itens
    };

    return NextResponse.json({ notaFiscal });
  } catch (error) {
    console.error('Erro no processamento da nota fiscal (Cheerio):', error);
    return NextResponse.json({ error: 'Erro interno ao extrair a nota fiscal via Cheerio' }, { status: 500 });
  }
}
