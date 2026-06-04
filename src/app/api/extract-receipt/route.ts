import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'Conteúdo do QR Code é obrigatório' }, { status: 400 });
    }

    let htmlContent = '';
    const isHttpUrl = url.trim().startsWith('http://') || url.trim().startsWith('https://');

    if (isHttpUrl) {
      // Tentar acessar a URL (se for uma URL direta do QR Code - NFC-e como RJ, etc.)
      try {
        const fetchResponse = await fetch(url.trim(), {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
          },
          signal: AbortSignal.timeout(10000)
        });
        htmlContent = await fetchResponse.text();
      } catch (e) {
        console.error('Erro ao fazer fetch da URL SEFAZ:', e);
        htmlContent = `Falha ao carregar HTML. URL do QR Code: ${url}`;
      }
    } else {
      // É provável que seja um Cupom SAT (SP) que é uma string separada por Pipes (|) ou apenas a chave de acesso.
      // O SAT QR Code possui o Valor Total, CNPJ, Data/Hora e Chave, mas NÃO possui os itens.
      htmlContent = `Conteúdo bruto do QR Code (SAT / Outros): ${url}`;
    }

    // Prompt para o Gemini extrair os dados
    const prompt = `
      Você é um especialista em extração de dados de notas fiscais eletrônicas brasileiras (NFC-e / SAT).
      Abaixo está o conteúdo extraído do QR Code. Pode ser o HTML da página da SEFAZ (ex: RJ) ou o texto bruto de um QR Code SAT (ex: SP).
      Sua tarefa é extrair os seguintes dados e retornar APENAS UM JSON válido.
      
      IMPORTANTE:
      - Se for NFC-e (HTML), tente extrair a lista de itens comprados.
      - Se for SAT (string com pipes '|'), os itens NÃO estarão presentes no texto. Nesse caso, extraia o CNPJ, Data, Total e Chave de Acesso, e retorne o array "itens" vazio ou apenas com um item genérico com o valor total.
      
      Estrutura do JSON esperada:
      {
        "notaFiscal": {
          "loja_nome": "Nome do Estabelecimento ou Não Identificado",
          "cnpj": "CNPJ sem formatação",
          "data_emissao": "YYYY-MM-DDTHH:mm:ssZ (tente inferir do texto)",
          "endereco": "Endereço completo se disponível",
          "valor_total": 0.00,
          "chave_acesso": "chave de 44 digitos",
          "url_qr_code": "${url}",
          "itens": [
            {
              "nome_item": "Nome do produto",
              "quantidade": 1.0,
              "valor_unitario": 0.00,
              "valor_total": 0.00
            }
          ]
        }
      }

      Certifique-se de que os valores numéricos sejam floats (ex: 15.50).

      Conteúdo:
      ${htmlContent.substring(0, 15000)}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const textResult = response.text;
    
    if (!textResult) {
      throw new Error('Nenhuma resposta do Gemini');
    }

    let jsonResult;
    try {
      jsonResult = JSON.parse(textResult);
    } catch (e) {
      console.error('Falha ao fazer parse do JSON:', textResult);
      throw new Error('Formato de resposta inválido do LLM');
    }

    return NextResponse.json(jsonResult);
  } catch (error) {
    console.error('Erro no processamento da nota fiscal:', error);
    return NextResponse.json({ error: 'Erro interno ao processar a nota fiscal' }, { status: 500 });
  }
}
