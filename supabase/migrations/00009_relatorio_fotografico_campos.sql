-- ==============================================================================
-- MIGRATION: 00009_relatorio_fotografico_campos.sql
-- Campos de cabeçalho do Relatório Fotográfico (slides 1 e 2 do PowerPoint)
-- Pedido do David em 02/09/2026 — ver _mensagens-agentes e
-- src/modules/engenharia/relatorio-fotografico/README.md
--
-- Só ADICIONA colunas nullable a uma tabela já existente — reversível com
-- um DROP COLUMN de cada uma, sem risco pra dado já gravado em 00008.
-- ==============================================================================

ALTER TABLE public.engenharia_estrutura_fotografica
  ADD COLUMN IF NOT EXISTS agencia text,               -- nome/código da agência do banco (slide 1)
  ADD COLUMN IF NOT EXISTS programa text,               -- pré-preenchido a partir de projetos.tipologia quando houver projeto_id
  ADD COLUMN IF NOT EXISTS upe text,                    -- Cód UPE
  ADD COLUMN IF NOT EXISTS sap text,                    -- Cód SAP
  ADD COLUMN IF NOT EXISTS gestor text,                 -- Gestor de obras (banco)
  ADD COLUMN IF NOT EXISTS fiscalizacao_empresa text,   -- Empresa de fiscalização
  ADD COLUMN IF NOT EXISTS fiscal text,                 -- Nome do fiscal
  ADD COLUMN IF NOT EXISTS construtora text,            -- Empresa construtora (ex.: EGF CONSTRUTORA)
  ADD COLUMN IF NOT EXISTS responsavel text,            -- Responsável pela construtora
  ADD COLUMN IF NOT EXISTS data_inicio_obra date,       -- só usado quando avulso ou sem data no projeto vinculado
  ADD COLUMN IF NOT EXISTS data_termino_obra date;

COMMENT ON COLUMN public.engenharia_estrutura_fotografica.programa IS
  'Pré-preenchido a partir de projetos.tipologia quando projeto_id existe; editável e obrigatório quando is_avulso.';
COMMENT ON COLUMN public.engenharia_estrutura_fotografica.data_inicio_obra IS
  'Usado como fallback/override — quando há projeto_id, o relatório prefere projetos.data_prevista_inicio.';
COMMENT ON COLUMN public.engenharia_estrutura_fotografica.data_termino_obra IS
  'Usado como fallback/override — quando há projeto_id, o relatório prefere projetos.data_prevista_termino.';
