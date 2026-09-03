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

- Migration `00009_relatorio_fotografico_campos.sql` — aplicada pelo
  Antigravity. Adiciona os campos de cabeçalho do relatório à própria
  `engenharia_estrutura_fotografica`.
- **Correção de rumo, mesmo dia:** o David esclareceu que Agência/UPE/
  SAP/gestor/fiscalização/construtora/responsável deviam nascer no
  **cadastro da OS** (`projetos`), não isolados aqui — são dados de
  obra úteis pra empresa toda. Migration nova
  `00010_projetos_campos_engenharia.sql` (proposta, ainda não aplicada)
  adiciona essas colunas em `projetos`. As colunas de 00009 continuam
  existindo e passam a servir **só** o caso avulso (sem projeto_id).
  `src/modules/operacional/{types.ts,services/apiProjetos.ts,components/FormProjeto.tsx}`
  ganharam os campos correspondentes no cadastro da OS — só adições,
  nada removido. Detalhes em `_mensagens-agentes/PARA-ANTIGRAVITY.md`.
- **`services/apiRelatorioFotografico.ts`** — CRUD da estrutura,
  catálogo global de serviços/ambientes, habilitar/desabilitar serviço
  por relatório, e `atualizarCamposProjeto` (grava os campos de obra em
  `projetos` quando vinculado). Usa o client Supabase do navegador
  (`@/shared/lib/supabaseClient`), mesmo padrão de `apiProjetos.ts`.
- **`src/app/(app)/engenharia/relatorio-fotografico/page.tsx`** —
  primeira tela: avulso ou vínculo a projeto (autocomplete igual ao
  `FormProjeto.tsx`), tipo, dados de cabeçalho (fonte: `projetos`
  quando vinculado, local quando avulso), serviços/equipamentos.
  **Sem etapa de "criar pastas"** — decisão do David, Storage não
  precisa de pasta vazia pré-criada.
- Registrado na `Sidebar.tsx` pelo Antigravity (em dois lugares:
  Operacional (Projetos) e Engenharia (PCM)).
- **UX revisada (mesmo dia, pedido do David):** checkbox de avulso bem
  discreto (não mais em destaque), busca de projeto com autocomplete
  mais rico + modal "ver todos" com filtro por cliente final e status
  (`buscarProjetosComFiltros`, `listarClientesFinaisUsados`), cards de
  tipo de projeto maiores com ícone, **Banco e Modelo agora são select**
  (nunca texto livre) — `Modelo` é filtrado pelo `Banco` escolhido e
  pelo tipo de projeto. Datas de início/término: mostradas (só leitura)
  a partir de `projetos.data_efetiva_*` (com fallback pra `data_prevista_*`)
  quando vinculado a projeto; campo próprio editável quando avulso.
- **Nova migration `00011_bancos_modelos_relatorio.sql`** (proposta,
  ainda não aplicada) — cria `engenharia_bancos_catalogo` e
  `engenharia_modelos_relatorio` (banco + tipo_projeto + nome +
  `config_id`, a chave que `lib/pptx.ts`/`MODELOS_CFG` vai usar quando a
  geração real for conectada), já com seed dos 4 bancos e nomes de
  modelo do app de referência.
- **Rodada de correções de UX (02/09/2026, Claude Code, a pedido do
  David depois de testar).** O Antigravity tinha deixado o checkbox de
  avulso quase invisível ao tentar "melhorar" o excesso de destaque
  anterior — ajustado pra um meio-termo (pill discreto, mas legível).
  Bug real encontrado nas datas: o campo rotulado "(Efetivo)" caía
  silenciosamente pra data prevista quando a efetiva estava vazia,
  mostrando a prevista como se fosse a efetiva — corrigido pra mostrar
  só a efetiva de verdade (vazio + dica de "Previsto: ..." abaixo, sem
  se passar por ela). Adicionado aviso de pendências (campos vazios)
  que não bloqueia o preenchimento mas vai bloquear a montagem do
  PowerPoint quando essa etapa existir. O "só aparece o item 4" era
  real: nada desaparecia do código, mas a falta de qualquer transição
  visual fazia a seção 4 nascer fora da tela sem contexto — agora as
  seções 1-2 colapsam num resumo compacto ("Editar" pra reabrir) e a
  tela rola suavemente até a continuação ao clicar em "Iniciar
  relatório".
- **Upload de foto implementado (03/09/2026, Claude Code).** Diferente
  do app de referência (que só *listava* fotos já existentes numa pasta
  local escolhida pelo usuário — não existe endpoint de upload lá),
  aqui o upload é de verdade: `uploadFotoRelatorio` envia o arquivo cru
  pro bucket `relatorios-fotograficos` usando o mesmo padrão de caminho
  (`caminhoStorage` — `relatorioId/SEGMENTO.../arquivo`), sem
  normalizar/recortar no upload — isso continua acontecendo só na hora
  de montar o PowerPoint (`lib/imagem.ts`), igual ao original.
  - Infraestrutura: cada ponto vira 1 linha de
    `engenharia_progresso_relatorio` (par antes/depois). Enquanto só um
    dos dois lados foi enviado, fica em rascunho local (não grava linha
    no banco, já que `foto_antes_path`/`foto_depois_path` são
    `NOT NULL`); ao completar o par, cria a linha.
  - Reforma: o slide (antes/durante + depois, com etapa e ambiente
    opcional) é montado inteiro num mini-formulário antes de salvar —
    não dá pra ter registro parcial.
  - `services/apiRelatorioFotografico.ts` ganhou:
    `uploadFotoRelatorio`, `urlPublicaFoto`, `excluirFotoRelatorio`,
    `listarProgresso`, `criarProgresso`, `atualizarProgresso`,
    `excluirProgresso`, `reordenarProgresso` (ainda sem UI de
    arrastar — a função existe, falta o drag-and-drop).
  - `page.tsx` ganhou o componente `SlotFoto` (miniatura clicável que
    vira preview assim que há uma foto salva) usado tanto em
    equipamentos/pontos quanto nos slides de reforma.
- **Reformulação da tela pós-criação (03/09/2026, Claude Code, a pedido do
  David)** — ele testou o upload de fotos e achou a experiência pobre
  comparada ao app de referência local. Portado mais fielmente de
  `web/src/pages/Relatorio.tsx` daquele app:
  - **Ambientes**: catálogo global com grid de chips (criar/remover),
    igual ao original — qualquer ambiente criado já fica disponível
    pra qualquer relatório futuro. Usa `lerAmbientesGlobais`/
    `adicionarAmbienteGlobal`/`removerAmbienteGlobal` (já existiam no
    serviço, só faltava a UI).
  - **Serviços**: trocado o grid de checkboxes por um fluxo em duas
    etapas como o original — select "conhecido, ainda não habilitado"
    + botão "habilitar aqui", e input "+ novo serviço" + botão "criar
    e habilitar" (cria no catálogo global E habilita neste relatório
    numa ação só). Habilitados aparecem como chips removíveis.
  - **Coluna de slides à direita**: diferente do original (que listava
    tudo empilhado numa coluna só, sem preview de foto de verdade) —
    aqui é uma coluna fixa (`lg:sticky`) com miniaturas reais (usa
    `urlPublicaFoto`, não só nome de arquivo como no app de
    referência), empilhadas na ordem final do PowerPoint. Clicar abre
    `ModalPreviaSlide` — lightbox com as duas fotos lado a lado em
    tamanho grande + legenda (mesma regra do PowerPoint,
    `descricaoDe`/`descricaoReforma` de `calc.ts`).
  - **Reordenar**: setas ▲/▼ por slide (usa `reordenarProgresso`, já
    existia no serviço). **Simplificação consciente**: o app de
    referência tinha arrastar-e-soltar nativo (HTML5 drag-and-drop);
    aqui ficou só as setas — mesmo resultado final, mais simples e
    sem os bugs comuns de drag-and-drop em mobile/touch. Se o David
    quiser o arrastar de verdade depois, é uma adição isolada.
  - `npx tsc --noEmit` e `eslint` limpos (só os avisos
    `set-state-in-effect` pré-existentes no arquivo, não introduzidos
    por esta mudança).
  - **Ainda não verificado visualmente** — o login da aplicação pede
    e-mail/senha e por política o Claude Code não pode digitar
    credenciais; aguardando o David logar na aba aberta.
- Ainda faltam: geração do `.pptx` de verdade (conectar `lib/pptx.ts`
  ao Storage, usando o `config_id` do modelo escolhido — este é o
  próximo passo natural, já que agora existem fotos pra consumir),
  reordenação de slide por arrastar (a função `reordenarProgresso` já
  existe no serviço, falta UI), prévia de slide antes de montar.
- **Template real do Itaú Personnalité localizado (03/09/2026)** — o
  David tinha o `.pptx` modelo numa pasta local
  (`EGF\ITAÚ\PERSON REL FOTOGRÁFICO - MODELO.PPTX`). Staged em
  `_templates-pendentes/itau-personnalite.pptx` na raiz do repo, com
  instrução pro Antigravity subir pro Storage e atualizar
  `storage_template_path` — ver `_mensagens-agentes/PARA-ANTIGRAVITY.md`.
  **Confirmado com o David**: é o mesmo arquivo físico pros dois
  configs (`itau-personnalite` e `itau-personnalite-reforma`) — as
  regras de montagem (marcadores buscados) é que diferem, não o
  arquivo. Um upload só, `storage_template_path` igual nas duas linhas;
  se o cliente mudar o padrão, troca-se um arquivo só.
  **Combinado com o David**: Claude Code nunca faz upload direto pro
  Supabase/GitHub — só deixa o artefato pronto localmente e escreve a
  instrução; quem sobe é o Antigravity.
- **Limitação conhecida, não resolvida ainda:** trocar o tipo de
  projeto (infraestrutura ↔ reforma) depois de já ter equipamentos ou
  serviços habilitados não apaga os dados do tipo anterior — eles ficam
  órfãos (guardados, mas escondidos da tela). Vale travar a troca de
  tipo depois de criado, ou avisar o usuário antes — ainda não
  implementado.
- `npx tsc --noEmit` limpo com essas mudanças.

## Diferença de cor de marca encontrada

Este projeto usa `--brand-blue: #002f6c` e `--brand-ocre: #c69214`
(Pantone 280C / 1245C, em `src/app/globals.css`). O app de referência
usava `#084E92` / `#D5A120` (amostrados por pixel da logo). Ao portar
qualquer componente visual, usar os valores Pantone daqui — são mais
autoritativos que a amostragem por pixel.
