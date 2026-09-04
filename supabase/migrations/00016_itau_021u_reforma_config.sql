-- ==============================================================================
-- MIGRATION: 00016_itau_021u_reforma_config.sql
-- Vincula o modelo "Itaú Reforma — Padrão" (já existia na migration 00011,
-- criado sem config_id/template) ao config "itau-021u-reforma" (ver
-- src/modules/engenharia/relatorio-fotografico/lib/pptx.ts) — modelo real
-- "021 U - RELATÓRIO FOTOGRÁFICO ANTES x DEPOIS" entregue pelo David em
-- 04/09/2026. storage_template_path assume que o Antigravity sobe o arquivo
-- em relatorios-fotograficos/_templates/itau-021u-reforma.pptx (mesma
-- convenção usada pro itau-personnalite) — ver
-- _templates-pendentes/itau-021u-reforma.pptx na raiz do repo e
-- _mensagens-agentes/PARA-ANTIGRAVITY.md.
-- ==============================================================================

UPDATE public.engenharia_modelos_relatorio
SET config_id = 'itau-021u-reforma',
    storage_template_path = '_templates/itau-021u-reforma.pptx'
WHERE banco = 'Itaú' AND tipo_projeto = 'reforma';
