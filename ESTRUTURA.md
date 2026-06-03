# Aprimore ERP — Estrutura de Módulos & Árvore do Projeto
### v1.1 · Adaptado ao estado atual do código · 2026-06-02

> **Como ler este documento:**
> - ✅ = já existe  ·  🔄 = existe mas precisa ser movido/renomeado  ·  🔲 = ainda não existe
> - Seção 10 mapeia exatamente o que mover e o que criar, sem ambiguidade.

---

## 1. Princípios de organização

1. **3 camadas, sentido único de dependência:**
   `app/` (rotas) → `features/` (módulos de negócio) → `core/` (base compartilhada).
   Uma camada só importa da camada **abaixo**. Nunca o contrário.
2. **Módulo não importa módulo direto.** Se `financeiro` precisa de algo de `obras`, importa **só** de `obras/index.ts` (a API pública).
3. **O banco é a fonte de verdade; os tipos vêm dele.** `src/types/database.ts` é gerado (`supabase gen types`). Ninguém edita à mão.
4. **Regras de negócio ficam em `calc.ts` (puro e testável)**, não dentro de componentes.
5. **Valores monetários: `NUMERIC(15,2)` no banco atual.** A migração para `bigint` (centavos) fica para a Fase 3 — quando houver cálculos tributários e rateios que exijam precisão inteira. Até lá, toda formatação de dinheiro passa por `core/money/format.ts`.
6. **Integração entre módulos por contrato:** ex., "medição aprovada" gera "conta a receber" — isso é uma função pública no `index.ts` do módulo-dono, nunca import direto do miolo.

---

## 2. Árvore raiz do projeto

```
aprimore-erp/
├─ ESTRUTURA.md             ← este documento ✅
├─ AGENTS.md                ← regras do agente ✅
├─ CLAUDE.md                ← carrega AGENTS.md ✅
├─ .env.local               ← segredos (fora do Git) ✅
├─ supabase/
│  └─ migrations/           ← histórico SQL versionado ✅ (2 migrações)
├─ public/
│  └─ brand/                ← logo-light, logo-dark 🔲
└─ src/
   ├─ app/                  ← CAMADA 1 · rotas (Next App Router) 🔄
   ├─ features/             ← CAMADA 2 · módulos de negócio (hoje: modules/) 🔄
   ├─ core/                 ← CAMADA 3 · base compartilhada (hoje: shared/) 🔄
   └─ types/
      └─ database.ts        ← GERADO do Supabase (read-only) 🔲
```

---

## 3. Anatomia padrão de um módulo

Todo módulo em `src/features/<modulo>/` segue este formato:

```
features/<modulo>/
├─ api/
│  ├─ queries.ts      # leituras no Supabase
│  ├─ mutations.ts    # escritas (Server Actions) validadas por Zod
│  └─ keys.ts         # chaves de cache (TanStack Query — Fase 2)
├─ components/        # UI específica do módulo
├─ hooks/             # hooks de dados/estado
├─ schema.ts          # Zod: validação de formulários e payloads (Fase 2)
├─ types.ts           # tipos do domínio
├─ calc.ts            # regras puras e testáveis, sem I/O [se houver]
├─ constants.ts       # enums, rótulos, categorias fixas
└─ index.ts           # API PÚBLICA (único ponto de import externo)
```

> **Hoje:** `modules/operacional/services/apiProjetos.ts` mistura queries + mutations + lógica num único arquivo. O alvo é separar em `api/queries.ts` + `api/mutations.ts`.

---

## 4. Camada de rotas (`src/app/`)

### Estado atual → alvo

| Rota atual | Rota alvo | Status |
|---|---|---|
| `/` | `/(app)/dashboard/page.tsx` | 🔄 mover lógica p/ `features/dashboard/` |
| `/projetos` | `/(app)/obras/page.tsx` | 🔄 renomear rota |
| `/projetos/novo` | `/(app)/obras/nova/page.tsx` | 🔄 |
| `/projetos/editar` | `/(app)/obras/[obraId]/page.tsx` | 🔄 |
| `/custos` | `/(app)/obras/[obraId]/custos/page.tsx` | 🔄 |
| `/recebimentos` | `/(app)/financeiro/contas-a-receber/page.tsx` | 🔄 |
| `/relatorios` | `/(app)/relatorios/page.tsx` | 🔄 |

### Árvore alvo completa

```
src/app/
├─ (auth)/
│  ├─ login/page.tsx                              🔲
│  └─ recuperar-senha/page.tsx                    🔲
└─ (app)/                        # layout autenticado: sidebar + topbar
   ├─ layout.tsx                                  🔄 (hoje: app/layout.tsx)
   ├─ dashboard/page.tsx                          🔄 (hoje: app/page.tsx)
   ├─ obras/
   │  ├─ page.tsx                                 🔄 (hoje: /projetos)
   │  ├─ nova/page.tsx                            🔄 (hoje: /projetos/novo)
   │  └─ [obraId]/
   │     ├─ page.tsx             # Visão geral    🔄 (hoje: /projetos/editar)
   │     ├─ orcamento/page.tsx                    🔲
   │     ├─ medicoes/page.tsx                     🔲
   │     ├─ diario/page.tsx                       🔲
   │     ├─ custos/page.tsx                       🔄 (hoje: /custos)
   │     └─ suprimentos/page.tsx                  🔲
   ├─ financeiro/
   │  ├─ contas-a-receber/page.tsx                🔄 (hoje: /recebimentos)
   │  ├─ contas-a-pagar/page.tsx                  🔲
   │  └─ fluxo-de-caixa/page.tsx                  🔲
   ├─ relatorios/page.tsx                         🔄 (hoje: /relatorios)
   └─ configuracoes/
      ├─ empresa/page.tsx                         🔲
      └─ usuarios/page.tsx                        🔲
```

As `page.tsx` são finas: montam o módulo correspondente em `features/`.

---

## 5. Núcleo compartilhado (`src/core/`)

```
src/core/
├─ design-system/
│  ├─ tokens.css              # variáveis light/dark (hoje em globals.css) 🔄
│  ├─ ui/                     # Button, Toast, ConfirmButton…
│  │  ├─ Toast.tsx            🔄 (hoje: shared/components/Toast.tsx)
│  │  └─ ConfirmButton.tsx    🔄 (hoje: shared/components/ConfirmButton.tsx)
│  ├─ layout/
│  │  ├─ Sidebar.tsx          🔄 (hoje: shared/components/Sidebar.tsx)
│  │  └─ ThemeToggle.tsx      🔄 (hoje: shared/components/ThemeToggle.tsx)
│  └─ ThemeProvider.tsx       🔄 (hoje: shared/contexts/ThemeContext.tsx)
├─ supabase/
│  ├─ client.ts               🔄 (hoje: shared/lib/supabaseClient.ts — parte browser)
│  └─ server.ts               🔲 (cliente SSR via @supabase/ssr)
├─ auth/
│  ├─ session.ts              🔲
│  └─ rbac.ts                 🔲
└─ money/
   └─ format.ts               🔄 (hoje: shared/components/ValorPremium.tsx — extrair lógica)
```

> **MockDatabase:** o fallback para LocalStorage em `supabaseClient.ts` é útil agora. Permanece até a Fase 1 (autenticação real). Depois é removido.

---

## 6. Mapa de módulos

| # | Módulo (`features/`) | Rota base | Estado | Fase |
|---|---|---|---|---|
| 0 | `auth` | `/login` | 🔲 | 0 |
| 1 | `dashboard` | `/dashboard` | 🔄 lógica espalhada em `app/page.tsx` | 0 |
| 2 | `obras` | `/obras` | 🔄 hoje `modules/operacional/` + `/projetos` | 1 |
| 3 | `orcamento` | `/obras/[id]/orcamento` | 🔄 misturado em `modules/operacional/` | 2 |
| 4 | `medicao` | `/obras/[id]/medicoes` | 🔲 | 2 |
| 5 | `financeiro` | `/financeiro` | 🔄 hoje `modules/financeiro/` (muito incipiente) | 1 |
| 6 | `suprimentos` | `/suprimentos` | 🔲 | 3 |
| 7 | `estoque` | `/estoque` | 🔲 | 3 |
| 8 | `contratos` | `/contratos` | 🔲 | 4 |
| 9 | `relatorios` | `/relatorios` | 🔄 hoje `app/relatorios/page.tsx` monolítico | 1 |
| 10 | `configuracoes` | `/configuracoes` | 🔲 | 0 |

---

## 7. Árvore detalhada dos módulos existentes

### 2 · `obras` (hoje: `modules/operacional/`)

```
features/obras/
├─ api/
│  ├─ queries.ts       # fetchObras, fetchObraById               🔄 de apiProjetos.ts
│  └─ mutations.ts     # salvarObra, deletarObra                 🔄 de apiProjetos.ts
├─ components/
│  ├─ ListaObras.tsx                                             🔄 de app/projetos/page.tsx
│  ├─ NovaObraForm.tsx                                           🔄 de FormProjeto.tsx
│  └─ ObraResumo.tsx                                             🔲
├─ hooks/
│  └─ useObras.ts                                                🔄 extrair de páginas
├─ types.ts            # Obra (hoje: Projeto), StatusObra        🔄 renomear interface
├─ calc.ts             # % consumo orçamento, score de saúde     🔄 extrair de page.tsx
├─ constants.ts        # CATEGORIAS_CUSTO_LABELS + status        🔄 de operacional/types.ts
└─ index.ts            # useObra(s), tipos Obra, calcSaude()     🔲
```

*Nota:* a tabela no banco continua chamada `projetos`. O rename para `obras` fica para a Fase 3 (junto com a migração de dinheiro para bigint), para não criar duas migrations de breaking change ao mesmo tempo.

### 3 · `orcamento` (extrair de `modules/operacional/`)

```
features/orcamento/
├─ api/
│  ├─ queries.ts       # fetchOrcamentosByObra                   🔄 de apiProjetos.ts
│  └─ mutations.ts     # salvarOrcamento                         🔄 de apiProjetos.ts
├─ components/
│  └─ PlanilhaOrcamentaria.tsx                                   🔲
├─ hooks/
│  └─ useOrcamento.ts                                            🔲
├─ types.ts            # OrcamentoCusto, CategoriaCusto          🔄 de operacional/types.ts
├─ constants.ts        # categorias (corrigir mismatch DB vs TS — veja seção 9) 🔄
└─ index.ts                                                      🔲
```

### 5 · `financeiro` (hoje: `modules/financeiro/`)

```
features/financeiro/
├─ api/
│  ├─ queries.ts       # fetchRecebimentos                       🔄 de apiFinanceiro.ts
│  └─ mutations.ts     # salvarRecebimento, marcarPago           🔄 de apiFinanceiro.ts
├─ components/
│  ├─ ContasAReceber.tsx                                         🔄 de app/recebimentos/page.tsx
│  └─ LancarCustoEfetivo.tsx                                     🔄 de app/custos/page.tsx
├─ hooks/
│  └─ useFinanceiro.ts                                           🔄 extrair de páginas
├─ types.ts            # Recebimento, PrevisaoCaixa              ✅ já existe
├─ calc.ts             # projeção 15d/30d, aging                 🔄 de apiFinanceiro.ts
└─ index.ts                                                      🔲
```

### 1 · `dashboard`

```
features/dashboard/
├─ api/
│  └─ queries.ts       # KPIs consolidados                       🔲
├─ components/
│  ├─ KpiCard.tsx                                                🔄 extrair de page.tsx
│  ├─ KpiRow.tsx                                                 🔄 extrair de page.tsx
│  ├─ SaudeFinanceiraObras.tsx                                   🔄 extrair de page.tsx
│  ├─ FaturamentoFuturoChart.tsx                                 🔄 extrair de page.tsx
│  └─ FilaRecebimentosAtraso.tsx                                 🔄 extrair de page.tsx
├─ hooks/
│  └─ useDashboard.ts                                            🔲
├─ calc.ts             # projeção de caixa por janela            🔄 extrair de page.tsx
└─ index.ts                                                      🔲
```

*Bug atual registrado:* projeção 15d e 30d retornam o mesmo valor porque o filtro de janela não é aplicado corretamente em `calc.ts`. Itens atrasados não entram na projeção futura.

### 9 · `relatorios`

```
features/relatorios/
├─ api/
│  └─ queries.ts       # leitura agregada de todos os módulos    🔄 extrair de page.tsx
├─ components/
│  ├─ DRE.tsx                                                    🔄 extrair de relatorios/page.tsx
│  └─ RelatorioObra.tsx                                          🔄 extrair de relatorios/page.tsx
├─ calc.ts             # DRE, consolidações                      🔄 extrair de page.tsx
└─ index.ts                                                      🔲
```

*Regra:* só lê; nunca escreve regra de negócio de outro módulo.

---

## 8. Regras de dependência

```
   dashboard ◄── obras ◄── orcamento ◄── medicao ──► financeiro
       ▲           ▲                                    ▲
       │           └── suprimentos                      │
       │                                               rh
    alertas ◄──── (lê de todos, escreve notificações)
       └── configuracoes / core (base)
   relatorios ←── (lê de todos, nunca escreve)
```

Regras práticas:
1. **Setas = sentido permitido de import** (sempre via `index.ts` do alvo).
2. **Nunca import circular.** Vínculo entre dois módulos que "precisam um do outro" vira função pública no `index.ts` do módulo-dono.
3. **`relatorios` só lê.** Nunca escreve em tabela de outro módulo.
4. **Toda integração nova** entra como função no `index.ts` do módulo + migration. Nunca uma tela mexendo na tabela de outro domínio.

---

## 9. Problemas conhecidos no estado atual (corrigir antes de crescer)

| # | Problema | Localização | Impacto |
|---|---|---|---|
| 1 | Bug projeção 15d = 30d | `app/page.tsx` (calc inline) | Dashboard errado |
| 2 | Mismatch categorias: DB tem 7 (`administrativo` por último), TS tem 9 (`alimentacao`, `outros`) | `00001_initial_schema.sql` vs `operacional/types.ts` | Erro silencioso ao salvar |
| 3 | RLS aberto (`USING (true)`) | Todas as migrations | Sem segurança real |
| 4 | Sem autenticação | Todo o app | Qualquer um acessa |
| 5 | Lógica de negócio dentro de `page.tsx` (1100 linhas) | `app/page.tsx` | Impossível testar ou reusar |
| 6 | `FormProjeto.tsx` mistura obras + orçamento + recebimentos | `modules/operacional/components/` | Difícil de manter |

---

## 10. Plano de migração (o que mover, na ordem certa)

### Fase 0 — Arrumar a casa (sem features novas)
1. Corrigir o mismatch de categorias: `migration 00003` adiciona `alimentacao` e `outros` ao `CHECK` do banco
2. Extrair `calc.ts` de `app/page.tsx` → `features/dashboard/calc.ts` e corrigir o bug de projeção
3. Criar `src/core/money/format.ts` com a lógica de `ValorPremium.tsx`
4. Mover `shared/components/` → `core/design-system/` e `shared/lib/supabaseClient.ts` → `core/supabase/client.ts`
5. Renomear `src/modules/` → `src/features/`

### Fase 1 — Auth + módulos base
6. Adicionar Supabase Auth + `core/auth/` + RLS real
7. Extrair `features/obras/` de `modules/operacional/` (manter rota `/projetos` até Fase 3)
8. Extrair `features/orcamento/` do mesmo fonte
9. Extrair `features/financeiro/` de `modules/financeiro/`
10. Extrair `features/dashboard/` de `app/page.tsx`

### Fase 2 — Crescimento orientado pelo mapa
- Criar `features/medicao/`, `features/suprimentos/`, `features/relatorios/` seguindo a anatomia padrão
- Introduzir Zod (schema.ts) e TanStack Query (api/keys.ts) módulo a módulo

### Fase 3 — Consolidação (breaking changes)
- Renomear tabela `projetos` → `obras` (migration com rename + FK update)
- Migrar dinheiro de `NUMERIC(15,2)` → `bigint` (centavos) — só quando houver cálculos tributários que exijam

---

## 11. Prompt-modelo para criar um módulo

> "Contexto: Aprimore ERP, conforme `ESTRUTURA.md`. Crie o módulo `features/<modulo>` seguindo a anatomia padrão (api/, components/, hooks/, types.ts, calc.ts, constants.ts, index.ts). Importe apenas de `core/` e dos `index.ts` dos módulos permitidos na seção 8. Gere a migration SQL correspondente em `supabase/migrations/` com RLS habilitado para usuários autenticados e valores monetários em `NUMERIC(15,2)`. Exponha no `index.ts` apenas hooks e funções de integração. Ao final, liste o comando para regerar `src/types/database.ts`. Não altere outros módulos."

---

*Aprimore ERP · ESTRUTURA.md v1.1 · estado em 2026-06-02*
