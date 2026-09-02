-- ==============================================================================
-- MIGRATION: 00010_projetos_campos_engenharia.sql
-- Campos de obra que servem à empresa toda (não só ao relatório fotográfico) —
-- movidos para o cadastro da OS por pedido do David em 02/09/2026: os campos
-- adicionados em 00009 (agencia, upe, sap, gestor, fiscalizacao_empresa,
-- fiscal, construtora, responsavel) foram criados no lugar errado — deviam
-- nascer no cadastro do projeto (`projetos`), não isolados no módulo de
-- engenharia, já que "Agência", "Cód UPE"/"Cód SAP", gestor/fiscal/construtora
-- são informação da obra, útil para outros departamentos também.
--
-- As colunas equivalentes em engenharia_estrutura_fotografica (00009)
-- continuam existindo e agora servem só para o caso de relatório AVULSO
-- (obra sem projeto_id, sem uma linha de `projetos` para ler) — ver
-- src/modules/engenharia/relatorio-fotografico/README.md.
-- ==============================================================================

ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS agencia text,
  ADD COLUMN IF NOT EXISTS upe text,
  ADD COLUMN IF NOT EXISTS sap text,
  ADD COLUMN IF NOT EXISTS gestor text,
  ADD COLUMN IF NOT EXISTS fiscalizacao_empresa text,
  ADD COLUMN IF NOT EXISTS fiscal text,
  ADD COLUMN IF NOT EXISTS construtora text,
  ADD COLUMN IF NOT EXISTS responsavel text;

COMMENT ON COLUMN public.projetos.agencia IS
  'Nome/código da agência bancária, quando o projeto for uma obra em agência (ex.: relatório fotográfico).';
