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
    credenciais (nem quando o David oferece a senha diretamente — é
    uma regra fixa, sem exceção); aguardando o David logar na aba
    aberta.
- **Fluxo em etapas reorganizado (03/09/2026, Claude Code, feedback do
  David depois de ver o resultado)** — comparado com
  `EGF\ITAÚ\relatorio-fotografico.html` (protótipo original,
  autoritativo pra esse fluxo):
  - **"Criar slides" é o gatilho**, ao lado de "Salvar dados", em vez
    de tudo aparecer junto depois de "Iniciar relatório". "Salvar
    dados" só aparece quando os dados do projeto estão editáveis
    (avulso ou `habilitarEdicaoObra`) — não faz sentido mostrá-lo em
    modo leitura.
  - Clicar em **"Criar slides"** recolhe a seção 3 (Dados do
    relatório) num resumo compacto (com "Editar" pra reabrir) e só
    então revela as etapas seguintes — mais espaço pra tela de slides.
  - Numeração retomada: **4 = Ambientes**, **5 = Serviços**,
    **6 = Criar slide** (reforma). Infraestrutura continua com
    **4 = Equipamentos e pontos** (não tem ambientes/serviços).
  - **Ambientes**: chips em ordem alfabética (antes vinham na ordem
    de criação).
  - **Serviços**: virou um grid único com TODOS os serviços do
    catálogo global sempre visíveis — cinza/opaco = conhecido mas não
    habilitado nesta obra, colorido = habilitado. Um toque alterna
    (substituiu o fluxo anterior de select + botão "habilitar aqui").
    Também em ordem alfabética.
  - **Criar slide** deixou de ser um link por serviço (o que ficava
    "pobre", nas palavras do David) e virou uma etapa única: select de
    serviço (só os habilitados) + select de ambiente + toggle
    Antes/Durante + par de fotos + "Gerar slide" — mesmo desenho do
    grupo "Gerar slides" do protótipo original.
  - `npx tsc --noEmit` e `eslint` limpos (mesmos avisos pré-existentes
    de `set-state-in-effect`, não novos).
- **Geração real do PowerPoint conectada (03/09/2026, Claude Code) —
  o módulo deixa de ser um protótipo.** Novidades desta rodada:
  - **`src/app/api/relatorio-fotografico/gerar/route.ts`** (novo,
    `runtime = 'nodejs'`) — só roda no servidor porque `sharp`
    (recorte/compressão real da foto) é binário nativo, não existe em
    browser. O client já manda os dados prontos (campos, lista de
    slides com os caminhos do Storage) no corpo da requisição — a rota
    só baixa template + fotos (bucket é público, não precisa de sessão)
    e chama `montarRelatorio`. `sharp` virou dependência direta do
    `package.json` (antes só transitiva via `next`).
  - Botão **"Montar PowerPoint"** no topo da coluna de slides —
    desabilitado enquanto houver pendência nos dados do relatório ou
    nenhum slide criado. Dispara a rota, recebe o `.pptx` pronto e
    acsiona o download no navegador.
  - **Bug corrigido**: selecionar um projeto que já tinha relatório
    pulava direto pra etapa de slides, escondendo os dados do projeto
    — o David queria poder revisar/editar antes de decidir seguir.
    Agora "Dados do relatório" só recolhe quando o usuário clica em
    "Criar slides" (nunca automaticamente).
  - **Etapa 2 (Tipo de projeto)**: cards menores (menos destaque) e
    recolhem pra um resumo compacto ("Alterar") assim que um tipo é
    escolhido — antes ficavam grandes o tempo todo.
  - **Etapa 6 (Criar slide)**: miniatura de verdade do arquivo local
    escolhido (não mais câmera+texto) — `SlotFoto` ganhou suporte a
    preview de `File` antes do upload (`URL.createObjectURL`, com
    `revoke` no cleanup). Nome do arquivo aparece embaixo da miniatura,
    não mais do lado. Novo botão **"Inserir fotos"** replica o fluxo
    do app original: um clique só, primeira escolha vai pro
    Antes/Durante, segunda escolha vai pro Depois automaticamente (via
    um único `<input type="file">` reaberto programaticamente entre as
    duas escolhas). Ao salvar um slide, serviço e ambiente são
    mantidos pro próximo (só fotos e etapa voltam ao padrão) — igual
    ao comentário original (`/* herda serviço e ambiente */`).
  - **Lista de slides de reforma** logo abaixo da etapa 6 (antes só
    existia na coluna direita) — reordenar (▲▼), pré-visualizar
    clicando, **editar** ambiente/etapa inline, excluir.
  - **`ModalPreviaSlide` corrigido**: o número do slide mostrado agora
    soma a base do modelo (`SLIDE_MODELO_BASE = 3` — os 2 primeiros
    slides do `.pptx` são sempre a capa/dados do projeto, os slides de
    foto começam no 3; hoje é o único valor real que existe no
    sistema). As legendas de cada foto viraram "Foto 01 - ANTES" /
    "Foto 02 - DEPOIS" (numeração que nunca reinicia, incrementa 2 por
    slide — igual à regra real do `lib/pptx.ts`), fotos maiores.
  - `npx tsc --noEmit` e `eslint` limpos.
  - **Ainda não testado de ponta a ponta** — só o David consegue (é
    quem está logado); depende de um relatório real com pelo menos 1
    slide e dados completos pra testar o "Montar PowerPoint".
- **Correções depois do primeiro teste real (03/09/2026, Claude Code)**
  — o David testou e reportou: "Montar PowerPoint" executava mas não
  baixava nada, e o fluxo de inserir fotos ainda não batia com o
  original. Achados e corrigidos:
  - **Bug real, confirmado no log do servidor** (`POST
    /api/relatorio-fotografico/gerar 500`): nomes de serviço com espaço
    (ex.: "TROCA DE ATMS") viram segmento de pasta no Storage
    (`TROCA DE ATMS/ANTES/arquivo.jpg`) — a rota montava a URL de
    download por concatenação de string, sem `encodeURIComponent` por
    segmento, e o `fetch` falhava. Corrigido em
    `src/app/api/relatorio-fotografico/gerar/route.ts`. Também
    adicionado `console.error` no catch pra aparecer no terminal do
    servidor da próxima vez.
  - Revoke do blob URL do download adiado (`setTimeout` de 4s) —
    revogar na hora podia invalidar o link antes do navegador
    realmente iniciar o download.
  - **"Inserir fotos"**: reabertura do seletor de arquivo agora usa
    `setTimeout(...,0)` antes do `.click()` programático — reabrir
    síncrono dentro do próprio handler de `change` falhava
    silenciosamente em alguns casos. Quando as duas fotos (antes e
    depois) já estão escolhidas, o mesmo botão vira **"Excluir fotos"**
    (limpa as duas de uma vez). Ficou ao lado de "Primeira foto vem
    de", acima das miniaturas — não mais do lado delas.
  - **`SlotFoto`**: clicar numa miniatura vazia abre o seletor de
    arquivo direto (como antes); clicar numa que já tem foto agora
    **amplia** com as opções "Trocar" / "Excluir" / "Fechar" — antes
    qualquer toque reabria o seletor sem aviso, arriscando trocar a
    foto sem querer.
  - Painel lateral de slides (coluna direita): descrição e ações
    ficam **abaixo** das duas miniaturas, não mais do lado — miniaturas
    maiores (metade da largura do card cada, antes eram só 40px).
  - `npx tsc --noEmit` e `eslint` limpos.
- **Terceiro round de testes reais (03/09/2026, Claude Code)** — o
  David bateu no erro `Forma "object 11" não encontrada no slide
  modelo` ao tentar montar de verdade. Causa raiz confirmada (não
  hipótese): baixei o `.pptx` do Storage e inspecionei o XML — o
  config `itau-personnalite-reforma` em `lib/pptx.ts` tinha nomes de
  forma e marcadores de um arquivo histórico que nunca foi enviado.
  Corrigido: os dois configs (infra/reforma) agora usam os mesmos
  marcadores/formas do arquivo real (é fisicamente o mesmo `.pptx`,
  confirmado pelo David) — só a descrição de cada slide muda conforme
  o tipo. Handoff da migration `00012_ordem_ambientes_relatorio.sql`
  feito pro Antigravity (`_mensagens-agentes/PARA-ANTIGRAVITY.md`).
  - "Inserir fotos" trocado pra **dois `<input type="file">`
    dedicados** (não mais um só reaberto via `.click()` programático)
    — reabrir o mesmo input dentro do próprio handler de `change` é
    bloqueado sem aviso em vários navegadores; provavelmente a causa
    do "não está funcionando" reportado. Botão virou visual primário
    (fundo `brand-ocre`, ícone, mais alto), voltou pra ao lado das
    miniaturas (não mais alinhado à direita), vira "Excluir fotos"
    quando as duas já estão escolhidas. `capture="environment"`
    removido de todos os inputs de foto — no celular isso forçava a
    câmera direto e escondia a opção de galeria.
  - Lista "Slides gerados" (reforma) ganhou **arrastar-e-soltar**
    nativo (alça `⠿`) e checkbox **"Organizar automaticamente"**
    (Ambiente → Serviço → Antes/Durante) — liga e já reordena os
    existentes; ligado, cada slide novo já nasce na posição certa.
    Critério de ambiente é alfabético por enquanto — ordem
    customizada por relatório depende da migration `00012` (UI de
    reordenar ambientes em si ainda não construída).
  - **Layout mobile**: coluna lateral de slides escondida abaixo do
    breakpoint `lg` (só a lista aparece); miniaturas da lista
    escondidas abaixo do `sm` (só texto, clicável pra ampliar).
  - `npx tsc --noEmit` limpo.
- **Quarto round de testes reais (03/09/2026, Claude Code)** — dois
  pedidos do David:
  - **Câmera/galeria no celular**: `accept="image/*"` sem `capture`
    dependia do seletor nativo do Android, que às vezes mostra só o
    Google Fotos e esconde a câmera. Trocado por escolha explícita —
    `ModalEscolhaOrigemFoto` (novo componente) com dois botões ("Tirar
    foto agora" / "Escolher da galeria"), cada um com seu próprio
    `<input>` (um com `capture="environment"`, um sem). Efeito
    colateral bom: como é um modal nosso, não um seletor nativo
    encadeado, reabrir pra escolher a segunda foto (antes→depois) não
    esbarra mais na restrição de navegador que gerava o bug do
    "Inserir fotos" não funcionar.
  - **Slide com pendência de foto**: agora dá pra criar um slide só
    com serviço+ambiente (os dois viraram obrigatórios — antes
    ambiente era opcional) e completar as fotos depois. Bolinha âmbar
    = falta alguma foto, verde = completo, em ambas as listas (coluna
    lateral e "Slides gerados"). "Montar PowerPoint" bloqueia com
    qualquer pendência — de dados OU de foto — validado no client E
    de novo na rota (`slides.some(s => !s.fotoAntesPath ||
    !s.fotoDepoisPath)`, defesa em profundidade). **Precisa da
    migration `00013_fotos_progresso_opcionais.sql`** (nova, handoff
    feito) — sem ela, criar slide sem foto falha com erro de
    `NOT NULL` no banco.
  - Botão "Montar PowerPoint" movido pra fora da coluna lateral
    (que só aparece em desktop) — agora é `order-first` no grid,
    visível em qualquer tamanho de tela.
  - `npx tsc --noEmit` e `eslint` limpos.
- **Quinto round (03/09/2026, Claude Code)** — feedback do David depois
  de usar em campo, no celular:
  - **`ModalPreviaSlide` ganhou edição inline**: agora abre pra
    qualquer slide, completo ou pendente — o lado sem foto mostra a
    arte de "Adicionar foto" (câmera), clicar chama o
    `ModalEscolhaOrigemFoto` e sobe direto pra aquele slide via
    `atualizarProgresso`, sem fechar e caçar o slide na lista de novo.
  - **`SeletorPersonalizado`** (novo componente) — bottom sheet com
    busca, com a cara do projeto, substituindo os `<select>` de
    Serviço/Ambiente na etapa 6. Pedido do David: o seletor nativo do
    celular "não tem a cara do projeto".
  - **Sidebar principal do ERP** (`shared/components/Sidebar.tsx`,
    fora deste módulo) ganhou colapso manual em telas `md+` — ícone
    `‹` no topo pra esconder, tira de 3px com `›` clicável em
    qualquer ponto pra reabrir. Motivo: no celular em paisagem a
    largura já cruza o breakpoint `md` e a sidebar (antes sempre
    visível ali) passava a ocupar espaço fixo sem opção de esconder.
    Preferência salva em `localStorage`. Comportamento do celular em
    retrato (hambúrguer/off-canvas) não muda.
  - **Câmera → galeria**: não existe API web pra forçar "salvar a
    foto capturada na galeria" em silêncio — nenhum navegador expõe
    isso. Best-effort implementado: ao tirar foto pela câmera (não
    pela galeria), dispara `navigator.share` com o arquivo, sem
    esperar resposta — se o aparelho suportar, o usuário vê "Salvar
    em Fotos/Arquivos" entre as opções do compartilhamento nativo do
    sistema, sem travar o fluxo de upload. Sem suporte, não faz nada
    (degrada bem).
  - `npx tsc --noEmit` limpo (`eslint` só com os avisos pré-existentes
    de `Sidebar.tsx`, não introduzidos agora).
- **Sexto round (03/09/2026, Claude Code)** — o slide "sumido" do
  round anterior era engano do David (a lista tem `max-h-[75vh]` com
  scroll, o slide novo nascia fora da área visível). Pedido dele: uma
  seta indicando que tem mais coisa pra rolar. Implementado — a
  coluna de slides detecta `scrollHeight` vs. `clientHeight` (no
  mount, a cada slide criado/removido, e a cada scroll) e mostra uma
  seta ↓ (com leve animação) colada no fim visível da lista; some
  quando chega ao final. Clicar nela rola 200px.
  - **"Salvar na galeria" — limite real explicado**: não existe API
    web pra escolher em qual pasta uma foto compartilhada é salva —
    isso é decidido pelo app que o usuário escolhe no menu de
    compartilhamento do sistema (Google Fotos, Arquivos, etc.), não
    pela página. O `navigator.share` do round anterior já é o máximo
    que dá pra oferecer sem depender de um app nativo/PWA instalado;
    documentado aqui pra não tentar de novo achando que tem solução
    melhor por engano.
- **Sétimo round (03/09/2026, Claude Code)**:
  - **Ordem de ambientes por relatório, implementada** — migration
    `00012` já estava aplicada; faltava só a UI. Etapa 4 (Ambientes)
    ganhou uma lista com ▲▼ pra definir a ordem deste relatório
    especificamente (persiste em `estrutura.ambientes_ordem`).
    `compararOrdemAutomatica` (usado pelo checkbox "Organizar
    automaticamente") passou a usar essa ordem como critério primário
    de Ambiente — quem não foi ordenado ainda cai no fim, alfabético.
  - **`ModalEscolhaOrigemFoto` reforçado**: no PC (detecção via
    `matchMedia('(pointer: coarse)')`, sem sniff de user agent), pula
    a escolha câmera/galeria e abre o explorador de arquivos direto —
    câmera não faz sentido nesse contexto. No celular, depois de tirar
    foto pela câmera, o convite pra "salvar no aparelho" virou um
    passo próprio com botão dedicado (`navigator.share` chamado de um
    clique de verdade) — a versão anterior chamava isso dentro do
    `onChange` do input, que às vezes não conta como gesto do usuário
    e o convite simplesmente não aparecia.
  - **"Montar PowerPoint"** movido pra dentro do fluxo normal —
    depois da etapa 6/Equipamentos, antes da lista de slides — não é
    mais um botão solto no topo da coluna.
  - **`ModalPreviaSlide`**: fotos com altura em `vh` (`h-[42vh]
    max-h-[420px]`) em vez de `aspect-[4/3]` fixo — em paisagem, onde
    a largura é grande mas a altura é curta, o aspect-ratio fixo
    fazia a foto (e o modal) ficarem mais altos que a tela.
  - **Coluna de slides**: seta ↓ animada aparece quando a lista tem
    mais conteúdo que a área visível (`scrollHeight` vs.
    `clientHeight`, recalculado a cada slide criado/removido e a cada
    scroll); some ao chegar no fim.
  - **Sidebar principal do ERP**: agora sincroniza com a orientação
    de verdade (`matchMedia('(orientation: landscape)')`, só no
    evento `change`, não em todo `resize`) — entra em paisagem
    estreita, recolhe sozinha; sai, reabre. Alças de recolher/expandir
    viraram círculos de 32px na borda direita, sempre visíveis (antes
    era um ícone de 14px só no hover, praticamente invisível — feedback
    direto do David).
- Ainda faltam: drag-and-drop também nos pontos de infraestrutura
  (hoje só tem ▲▼), drag-and-drop na ordem de ambientes (hoje só ▲▼),
  prévia de slide antes de montar.

## Parceiro EGF + Cowork — em andamento, 03/09/2026

David pediu: cadastro de "Parceiro EGF" (opção no cadastro de usuário,
o parceiro se registra com e-mail/usuário/senha, "esqueci minha
senha" por e-mail, ambiente próprio com seus relatórios salvos) +
"Cowork" (compartilhar um relatório pra edição por mais de uma
pessoa), com acesso restrito (confirmado: "não queremos isso pra
convidados" — nada de acesso total como um cadastro comum tem hoje).

Antigravity mapeou auth/RLS atual e propôs a arquitetura (tabela
`engenharia_relatorio_colaboradores`, RLS por dono/colaborador/role,
trigger `handle_new_user` honrando `raw_user_meta_data->>'role'`).
David aprovou. Dividido assim:

- **Antigravity aplica** (RLS é sensível, ele tem acesso pra testar
  contra o banco real — pedido feito, aguardando): a tabela de
  colaboradores, a RLS restritiva em
  `engenharia_estrutura_fotografica`/`engenharia_progresso_relatorio`
  pra `role = 'convidado'`, e o ajuste da trigger.
- **Claude Code já implementou** (não depende do banco, só do
  `user_id` que já existe na tabela desde sempre):
  - `(auth)/login/page.tsx` — checkbox "Sou Parceiro EGF" na aba
    "Primeiro Acesso" (manda `role: 'convidado'` no metadata do
    `signUp`); link "Esqueci minha senha" com modal próprio
    (`resetPasswordForEmail`).
  - `(auth)/redefinir-senha/page.tsx` (nova) — aguarda o evento
    `PASSWORD_RECOVERY`, deixa definir senha nova (`updateUser`).
  - `AuthProvider.tsx` — `/redefinir-senha` isenta do redirect
    automático de rota protegida (senão o usuário ia pra "/" antes de
    trocar a senha).
  - `services/apiRelatorioFotografico.ts` — `listarRelatoriosDoUsuario`
    (filtra por `user_id`, funciona mesmo com a RLS de hoje ainda
    permissiva, já que só pedimos as linhas do próprio usuário).
  - `page.tsx` — Parceiro EGF (`profile.role === 'convidado'`) nunca
    vê a busca de projeto corporativo (força avulso, esconde o
    checkbox de alternar); seção nova **"Meus relatórios"** no topo,
    lista os relatórios avulsos que ele mesmo criou, clicar retoma
    de onde parou.
  - `(app)/layout.tsx` — cabeçalho mostra "Ambiente do Parceiro EGF"
    pra esse papel, independente da rota.
  - **Ainda falta** (depende da tabela de colaboradores existir):
    botão "Compartilhar" (Cowork) num relatório, e "Meus relatórios"
    passar a incluir os compartilhados com o usuário, não só os
    próprios. Sidebar restrita ao Parceiro EGF já é suficiente hoje
    (o item de Engenharia já lista `'convidado'` nos `roles`
    permitidos — os outros módulos já não aparecem pra ele, por
    padrão, já que nenhum item de menu lista essa role).
  - **Achado à parte, fora de escopo aqui**: `Sidebar.tsx` referencia
    roles que não existem no enum atual (`'engenheiro'`,
    `'financeiro'`, `'comercial'`, `'rh'`, `'juridico'`,
    `'diretoria'` — o enum real é só `god/admin/user/convidado`,
    confirmado pelo Antigravity). Na prática, hoje um usuário comum
    (`role = 'user'`) não vê quase nenhum módulo no menu, só
    `god`/`admin` veem tudo. Não mexi nisso — é um problema
    pré-existente, sistêmico, e a "role certa" pra cada módulo não é
    uma decisão minha pra tomar sozinho.
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
