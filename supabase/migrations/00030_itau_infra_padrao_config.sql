-- ==============================================================================
-- MIGRATION: 00030_itau_infra_padrao_config.sql
-- "Itaú Infra — Padrão" foi semeado em 00011 com config_id NULL e nunca
-- recebeu config nem template -- o app bloqueia "Montar PowerPoint" com
-- "Este modelo ainda não tem um template configurado no Storage" antes
-- mesmo de tentar gerar (page.tsx::montarPowerPoint). O David preencheu um
-- relatório inteiro nesse modelo e ficou sem como gerar o arquivo.
--
-- Ligação provisória: reaproveita o config + template do 021 U do Itaú
-- (`itau-021u-reforma`, já existente em Storage/_templates). Precedente no
-- projeto: no Personnalité infra e reforma usam o MESMO arquivo físico --
-- a diferença está só na descrição de cada slide (equipamento+ponto vs.
-- serviço+ambiente), não no template (ver comentário em MODELOS_CFG,
-- lib/pptx.ts). Pressuposto a confirmar com o David: que o Itaú Infra usa
-- o mesmo layout do 021 U. Se existir um template próprio de infra, é só
-- subir o .pptx novo e trocar config_id/storage_template_path desta linha.
--
-- Só preenche se ainda estiver vazio (IS NULL) -- nunca sobrescreve uma
-- configuração real feita depois.
-- ==============================================================================

UPDATE public.engenharia_modelos_relatorio
SET config_id = 'itau-021u-reforma',
    storage_template_path = '_templates/itau-021u-reforma.pptx'
WHERE banco = 'Itaú'
  AND tipo_projeto = 'infraestrutura'
  AND config_id IS NULL
  AND storage_template_path IS NULL;
