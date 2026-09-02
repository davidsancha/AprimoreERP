# Relatório fotográfico — pacote paralelo (em integração)

Módulo em construção, criado pelo Claude Code a partir do app de
referência em `C:\Users\david\OneDrive\APRIMORE\EGF\ITAÚ\APRIMORE_ERP`
(Node+Express+React, local, já validado com relatórios reais). Ver
naquele repositório: `docs/decisoes.md` e
`projeto-aprimore/Demandas do Code/02-APRESENTACAO-PARA-ANTIGRAVITY.md`
para o contexto completo e as perguntas em aberto.

**Status: pacote paralelo, não conectado a nada ainda.** Nenhuma rota
está registrada na `Sidebar`, nenhuma migration foi aplicada ao
Supabase, nada aqui roda de verdade até essas perguntas serem
respondidas. Só a lógica pura (que não depende da resposta) já foi
portada.

## O que já está pronto e testado (fielmente portado)

- `lib/zip.ts` — leitura/escrita de `.pptx` sem bibliotecas externas.
- `lib/imagem.ts` — normalização de rotação EXIF + corte/compressão real
  da foto pro tamanho exato da forma do slide (evita o problema do
  relatório de 161MB do app de referência).
- `lib/pptx.ts` — motor de geração do PowerPoint, as sete correções
  descobertas contra arquivos reais de banco (ver
  `docs/02-REGRAS-DE-NEGOCIO.md` no app de referência).
- `calc.ts` — regra de estrutura (infraestrutura vs. reforma),
  descrição de slide.
- `types.ts` — tipos de domínio, sem dependência de Supabase ainda.

**Achado nesta integração:** `sharp` (usado por `lib/imagem.ts`) não é
dependência direta deste `package.json`, mas já vem instalado como
dependência transitiva do próprio `next@16.2.7` (usado pela otimização
de imagem do Next.js) — versão 0.34.5, confirmado com
`npm ls sharp`. Bom sinal: já roda nesse ambiente, inclusive em
produção via Next/Vercel. Ainda assim, quando isto for conectado de
verdade, adicionar como dependência direta no `package.json` — depender
de transitiva quebra se o Next parar de precisar dela.

## O que falta — depende de decisão (ver Demandas do Code/02-...)

- `schema-proposta.sql` — rascunho de tabelas, fora de
  `supabase/migrations/` de propósito, até confirmar a modelagem
  (reaproveitar `projetos` ou não, convenção de nome).
- Camada de API (`services/` ou `app/api/.../route.ts`) que conecta
  `lib/pptx.ts` ao Supabase Storage — ainda não escrita, porque depende
  do bucket/schema acima existir.
- Componentes de tela (cadastro de estrutura, captura de foto,
  montagem do relatório) — ainda não escritos.
- Registro na `Sidebar.tsx` — só depois de decidido onde entra no menu
  (Engenharia ou Operacional).

## Diferença de cor de marca encontrada

Este projeto usa `--brand-blue: #002f6c` e `--brand-ocre: #c69214`
(Pantone 280C / 1245C, em `src/app/globals.css`). O app de referência
usava `#084E92` / `#D5A120` (amostrados por pixel da logo). Ao portar
qualquer componente visual, usar os valores Pantone daqui — são mais
autoritativos que a amostragem por pixel.
