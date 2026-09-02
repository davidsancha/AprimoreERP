-- PROPOSTA DE SCHEMA — ainda não aplicada, não faz parte de
-- supabase/migrations/ de propósito (numeração compartilhada com o que o
-- Antigravity já está gerando; evitar colisão até isto ser confirmado).
--
-- Ver README.md desta pasta e
-- projeto-aprimore/Demandas do Code/02-APRESENTACAO-PARA-ANTIGRAVITY.md
-- (no repositório APRIMORE_ERP local) para o contexto e as perguntas em
-- aberto. Quando confirmado, isto vira supabase/migrations/000XX_....sql
-- com o número certo na sequência real.

-- Reaproveita a tabela `projetos` já existente (00003_schema_completo.sql)
-- para "Agência/obra" — esta tabela só guarda o que é específico do
-- relatório fotográfico, ligado por projeto_id.
create table if not exists engenharia_estrutura_fotografica (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id) on delete cascade,
  tipo_projeto text not null check (tipo_projeto in ('infraestrutura', 'reforma')),
  banco text, -- ou vem de crm_clientes via vinculo_cliente_projeto? perguntar
  modelo_relatorio text,
  equipamentos jsonb not null default '[]', -- [{nome, pontos:[{numero, local}]}]
  servicos_habilitados text[] not null default '{}', -- nomes habilitados NESTE projeto
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (projeto_id)
);

-- Memória global de serviços — nomes conhecidos entre todos os projetos,
-- cada projeto novo começa com todos desmarcados (ver
-- engenharia_estrutura_fotografica.servicos_habilitados).
create table if not exists engenharia_servicos_catalogo (
  nome text primary key
);

-- Memória global de ambientes — mesma lógica, mas ambiente nunca vira
-- pasta/registro próprio, só compõe a descrição do slide.
create table if not exists engenharia_ambientes_catalogo (
  nome text primary key
);

-- Um slide já montado no relatório (equivalente ao antigo
-- progresso-relatorio.json). A ordem de exibição é a ordem de geração do
-- PowerPoint — reordenar aqui reordena o relatório final.
create table if not exists engenharia_progresso_relatorio (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id) on delete cascade,
  ordem integer not null,
  servico text, -- reforma
  ambiente text, -- reforma
  equipamento text, -- infraestrutura
  numero_ponto text, -- infraestrutura
  local text, -- infraestrutura
  etapa1 text not null default 'ANTES' check (etapa1 in ('ANTES', 'DURANTE')),
  foto_antes_path text not null, -- caminho no bucket do Storage
  foto_depois_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_progresso_relatorio_projeto
  on engenharia_progresso_relatorio (projeto_id, ordem);

-- RLS: seguindo o padrão temporário permissivo já usado nas outras
-- tabelas deste schema (ver 00004_novos_modulos.sql) até a Fase 1 de
-- autenticação do roadmap em ESTRUTURA.md.
alter table engenharia_estrutura_fotografica enable row level security;
alter table engenharia_servicos_catalogo enable row level security;
alter table engenharia_ambientes_catalogo enable row level security;
alter table engenharia_progresso_relatorio enable row level security;

-- Bucket de Storage proposto (criar via painel do Supabase ou API, não SQL puro):
--   nome: "relatorio-fotografico"
--   caminho sugerido: <projeto_id>/<servico-ou-equipamento>/<etapa>/<arquivo>
--   público: não (acesso via URL assinada, mesmo padrão de outros buckets do projeto, se houver)
