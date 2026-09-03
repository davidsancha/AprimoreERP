-- ==============================================================================
-- MIGRATION: 00013_fotos_progresso_opcionais.sql
-- Pedido do David em 03/09/2026: permitir criar um slide (serviço + ambiente
-- já definidos) antes de ter as fotos — as fotos ficam pendentes, marcadas
-- com um indicador visual, e SÓ bloqueiam a montagem do PowerPoint (nunca a
-- criação do slide em si). Serviço e ambiente continuam obrigatórios.
-- ==============================================================================

ALTER TABLE public.engenharia_progresso_relatorio
  ALTER COLUMN foto_antes_path DROP NOT NULL,
  ALTER COLUMN foto_depois_path DROP NOT NULL;

COMMENT ON COLUMN public.engenharia_progresso_relatorio.foto_antes_path IS
  'Caminho da imagem "antes/durante" no Supabase Storage — NULL enquanto a foto não foi enviada (pendência, ver foto_antes_path/foto_depois_path no client). Bloqueia a montagem do PowerPoint, não a criação do slide.';
COMMENT ON COLUMN public.engenharia_progresso_relatorio.foto_depois_path IS
  'Caminho da imagem "depois" no Supabase Storage — NULL enquanto a foto não foi enviada (pendência). Bloqueia a montagem do PowerPoint, não a criação do slide.';
