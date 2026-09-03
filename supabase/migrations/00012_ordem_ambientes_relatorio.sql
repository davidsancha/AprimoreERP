-- ==============================================================================
-- MIGRATION: 00012_ordem_ambientes_relatorio.sql
-- Ordem de exibição dos ambientes — por relatório, não global. Pedido do
-- David em 03/09/2026: a ordem em que os ambientes aparecem no PowerPoint
-- pode ser diferente de relatório para relatório, mesmo usando os mesmos
-- ambientes do catálogo global (engenharia_ambientes_catalogo).
-- ==============================================================================

ALTER TABLE public.engenharia_estrutura_fotografica
  ADD COLUMN IF NOT EXISTS ambientes_ordem text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.engenharia_estrutura_fotografica.ambientes_ordem IS
  'Nomes de ambientes na ordem escolhida para ESTE relatório (usado como critério primário de "organizar automaticamente" os slides). Vazio = ordem alfabética (padrão atual).';
