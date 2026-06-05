import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';

// Instância do Gemini. Utilizará a variável de ambiente GEMINI_API_KEY
const ai = new GoogleGenAI();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { images, qrCodeUrl } = body;

    if ((!images || images.length === 0) && !qrCodeUrl) {
      return NextResponse.json({ error: 'Nenhuma imagem ou QR Code fornecido' }, { status: 400 });
    }

    let loja_nome = 'Nome do Estabelecimento Não Identificado';
    let endereco = '';
    let chave_acesso = '';
    let cnpj = '';
    let data_emissao = '';
    let valor_total = 0;
    
    // Passo 1: Extração rápida via Código/QR Code (se URL existir)
    if (qrCodeUrl) {
      const url = qrCodeUrl.trim();
      
      // Extrair Chave de Acesso da URL (padrão RJ ?p=CHAVE|...)
      const urlMatch = url.match(/p=(\d{44})/);
      if (urlMatch) {
        chave_acesso = urlMatch[1];
        cnpj = chave_acesso.substring(6, 20); // Extrai CNPJ da chave
      }

      // Tentar raspar a SEFAZ
      const isHttpUrl = url.startsWith('http://') || url.startsWith('https://');
      if (isHttpUrl) {
        try {
          const fetchResponse = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              'Accept': 'text/html,application/xhtml+xml,application/xml'
            },
            signal: AbortSignal.timeout(5000)
          });
          
          if (fetchResponse.ok) {
            const htmlContent = await fetchResponse.text();
            
            if (!htmlContent.includes('bloqueia acessos provenientes') && !htmlContent.includes('bloqueio')) {
              const $ = cheerio.load(htmlContent);
              
              const lojaText = $('#u20').text().trim();
              if (lojaText) loja_nome = lojaText;

              const chaveEl = $('.chave').text().trim() || $('#conteudo .text').text().trim();
              const chaveMatch = chaveEl.replace(/\s/g, '').match(/\d{44}/);
              if (chaveMatch) {
                chave_acesso = chaveMatch[0];
                if (!cnpj) cnpj = chave_acesso.substring(6, 20);
              }

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

              const totalText = $('#totalNota .txtMax').text() || $('#totalNota').text() || $('.txtMax').text();
              const totalMatch = totalText.match(/[\d\.]+\,\d{2}/);
              if (totalMatch) {
                valor_total = parseFloat(totalMatch[0].replace('.', '').replace(',', '.'));
              }
            }
          }
        } catch (e) {
          console.warn('Scraping da SEFAZ falhou (fallback para IA):', e);
        }
      }
    }

    // Passo 2: Extração Inteligente via Gemini Flash (Fallback + Itens)
    let aiData: any = null;
    
    if (images && images.length > 0) {
      try {
        const prompt = `
Você é um assistente especializado em ler cupons fiscais brasileiros.
Vou te enviar imagens de um cupom fiscal (podem ser várias partes do mesmo cupom).
Já extraímos alguns dados via código, não reescreva se não for necessário para economizar tokens:
- Chave de Acesso: ${chave_acesso || 'Não encontrada'}
- Nome da Loja: ${loja_nome !== 'Nome do Estabelecimento Não Identificado' ? loja_nome : 'Não encontrado'}
- CNPJ: ${cnpj || 'Não encontrado'}
- Data de Emissão: ${data_emissao || 'Não encontrada'}

Sua tarefa:
1. Extrair a Forma de Pagamento (Dinheiro, Cartão de Crédito, Pix, etc).
2. Extrair os ITENS da compra (descrição, quantidade, valor_unitario, valor_total do item).
3. SE os dados do emissor (Nome, Endereço, CNPJ, Data) não foram encontrados acima, extraia-os da imagem.
4. O valor total da compra.

Retorne APENAS um JSON válido no seguinte formato estrito, sem markdown ou formatação adicional:
{
  "loja_nome": "Nome do local (se não tínhamos)",
  "cnpj": "Apenas os números (se não tínhamos)",
  "endereco": "Endereço completo (se visível nas imagens)",
  "data_emissao": "YYYY-MM-DDTHH:mm:ss (se visível e não tínhamos)",
  "forma_pagamento": "Forma de pagamento (Pix, Cartão, Dinheiro...)",
  "valor_total": 0.00,
  "itens": [
    {
      "nome_item": "Descrição do item",
      "quantidade": 1.0,
      "valor_unitario": 0.00,
      "valor_total": 0.00
    }
  ]
}`;

        // Preparar as imagens para o Gemini
        const parts = images.map((imgUrl: string) => {
          // Remove prefixo de base64 se existir
          const base64Data = imgUrl.replace(/^data:image\/\w+;base64,/, '');
          return {
            inlineData: {
              data: base64Data,
              mimeType: 'image/jpeg' // assumimos jpeg, ou pegaríamos da string
            }
          };
        });

        const response = await ai.models.generateContent({
          model: 'gemini-1.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                ...parts
              ]
            }
          ],
          config: {
            temperature: 0.1, // baixa temperatura para maior precisão de extração
            responseMimeType: "application/json",
          }
        });

        const responseText = response.text || '';
        if (responseText) {
          aiData = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
        }

      } catch (aiError) {
        console.error('Erro na extração via Gemini:', aiError);
      }
    }

    // Passo 3: Merge Híbrido dos Dados
    // Priorizamos dados da IA para campos que a IA é melhor (itens, forma_pagamento, endereco), 
    // e o código para chaves matemáticas.
    const notaFiscal = {
      loja_nome: aiData?.loja_nome || loja_nome,
      cnpj: aiData?.cnpj || cnpj,
      endereco: aiData?.endereco || endereco,
      data_emissao: aiData?.data_emissao || data_emissao || new Date().toISOString(),
      valor_total: aiData?.valor_total || valor_total,
      chave_acesso: chave_acesso,
      url_qr_code: qrCodeUrl || null,
      forma_pagamento: aiData?.forma_pagamento || 'Não identificada',
      itens: aiData?.itens || []
    };

    return NextResponse.json({ notaFiscal });

  } catch (error) {
    console.error('Erro interno ao extrair a nota fiscal:', error);
    return NextResponse.json({ error: 'Erro interno ao extrair a nota fiscal.' }, { status: 500 });
  }
}
