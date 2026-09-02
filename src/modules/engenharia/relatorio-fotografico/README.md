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

## Status da Modelagem e Banco de Dados (Atualizado pelo Antigravity)

- **Migration Oficial Aplicada:** `supabase/migrations/00008_relatorio_fotografico.sql` aplicada com sucesso no Supabase (`ACTIVE_HEALTHY`).
  - `engenharia_estrutura_fotografica` (com `projeto_id uuid` nullable, `user_id uuid`, `is_avulso boolean`, `obra_nome text` para suporte a convidados).
  - `engenharia_servicos_catalogo` (memória global).
  - `engenharia_ambientes_catalogo` (memória global).
  - `engenharia_progresso_relatorio` (vinculado a `relatorio_id` referenciando `engenharia_estrutura_fotografica(id)`).
  - **Bucket de Storage:** `relatorios-fotograficos` criado no Supabase com policies RLS ativas.
- **Localização confirmada:** Engenharia (PCM) -> `src/modules/engenharia/relatorio-fotografico/` e rota `src/app/(app)/engenharia/relatorio-fotografico/`.

## Status (atualizado pelo Claude Code, 02/09/2026)

- **`supabase/migrations/00009_relatorio_fotografico_campos.sql`** —
  proposta, **ainda não aplicada** (só tenho a anon key, não consigo
  rodar DDL). Adiciona os campos de cabeçalho do relatório (agência,
  programa, UPE, SAP, gestor, fiscalização, construtora, responsável,
  datas) — só `ADD COLUMN` nullable, reversível.
- **`services/apiRelatorioFotografico.ts`** — CRUD da estrutura,
  catálogo global de serviços/ambientes, habilitar/desabilitar serviço
  por relatório. Usa o client Supabase do navegador
  (`@/shared/lib/supabaseClient`), mesmo padrão de `apiProjetos.ts`.
- **`src/app/(app)/engenharia/relatorio-fotografico/page.tsx`** —
  primeira tela: avulso ou vínculo a projeto (autocomplete igual ao
  `FormProjeto.tsx`), tipo, dados de cabeçalho, serviços/equipamentos.
  **Sem etapa de "criar pastas"** — decisão do David, Storage não
  precisa de pasta vazia pré-criada.
- Ainda faltam: upload de foto (câmera/galeria) + registro em
  `engenharia_progresso_relatorio`, geração do `.pptx` de verdade
  (conectar `lib/pptx.ts` ao Storage), reordenação/prévia de slide,
  registro na `Sidebar.tsx`.
- `npx tsc --noEmit` limpo com essas mudanças.
- Perguntas para o Antigravity em `_mensagens-agentes/PARA-ANTIGRAVITY.md`.

## Diferença de cor de marca encontrada

Este projeto usa `--brand-blue: #002f6c` e `--brand-ocre: #c69214`
(Pantone 280C / 1245C, em `src/app/globals.css`). O app de referência
usava `#084E92` / `#D5A120` (amostrados por pixel da logo). Ao portar
qualquer componente visual, usar os valores Pantone daqui — são mais
autoritativos que a amostragem por pixel.
