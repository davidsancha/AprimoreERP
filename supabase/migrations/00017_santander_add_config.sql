-- ==============================================================================
-- MIGRATION: 00017_santander_add_config.sql
-- Modelo "Santander — Antes x Durante x Depois" (config_id "santander-add",
-- ver src/modules/engenharia/relatorio-fotografico/lib/pptx.ts): novas
-- colunas em engenharia_estrutura_fotografica (cabeçalho do relatório) e
-- engenharia_progresso_relatorio (3ª foto + comentário por slide), banco
-- "Santander" no catálogo e o modelo em si em engenharia_modelos_relatorio.
-- ==============================================================================

ALTER TABLE public.engenharia_estrutura_fotografica
  ADD COLUMN IF NOT EXISTS uniorg text,
  ADD COLUMN IF NOT EXISTS mantenedor text,
  ADD COLUMN IF NOT EXISTS chamado text,
  ADD COLUMN IF NOT EXISTS relatorio_titulo text,
  ADD COLUMN IF NOT EXISTS data_relatorio text,
  ADD COLUMN IF NOT EXISTS descricao_problema text,
  ADD COLUMN IF NOT EXISTS causa_origem text,
  ADD COLUMN IF NOT EXISTS danos text,
  ADD COLUMN IF NOT EXISTS paliativo_retirada_risco text,
  ADD COLUMN IF NOT EXISTS escopo_proposta text,
  ADD COLUMN IF NOT EXISTS cronograma text;

ALTER TABLE public.engenharia_progresso_relatorio
  ADD COLUMN IF NOT EXISTS foto_durante_path text,
  ADD COLUMN IF NOT EXISTS comentario text;

INSERT INTO public.engenharia_bancos_catalogo (nome) VALUES ('Santander')
  ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.engenharia_modelos_relatorio (banco, tipo_projeto, nome, config_id, storage_template_path)
VALUES (
  'Santander',
  'reforma',
  'Santander — Antes x Durante x Depois',
  'santander-add',
  '_templates/santander-add.pptx'
)
ON CONFLICT DO NOTHING;
