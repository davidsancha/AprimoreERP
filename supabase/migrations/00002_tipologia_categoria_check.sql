-- 00002_tipologia_categoria_check.sql
-- Adiciona o campo tipologia e atualiza as constraints de categoria de custos

-- 1. Adicionar coluna tipologia na tabela projetos
ALTER TABLE public.projetos 
ADD COLUMN IF NOT EXISTS tipologia VARCHAR(100) NOT NULL DEFAULT 'Residencial';

-- 2. Atualizar constraints de categoria na tabela orcamentos_custos
ALTER TABLE public.orcamentos_custos DROP CONSTRAINT IF EXISTS orcamentos_custos_categoria_check;
ALTER TABLE public.orcamentos_custos 
ADD CONSTRAINT orcamentos_custos_categoria_check 
CHECK (categoria IN ('insumos', 'mao_de_obra', 'empreiteiros', 'ferramentas', 'locacoes', 'logistica', 'administrativo', 'alimentacao', 'outros'));

-- 3. Atualizar constraints de categoria na tabela custos_realizados
ALTER TABLE public.custos_realizados DROP CONSTRAINT IF EXISTS custos_realizados_categoria_check;
ALTER TABLE public.custos_realizados 
ADD CONSTRAINT custos_realizados_categoria_check 
CHECK (categoria IN ('insumos', 'mao_de_obra', 'empreiteiros', 'ferramentas', 'locacoes', 'logistica', 'administrativo', 'alimentacao', 'outros'));
