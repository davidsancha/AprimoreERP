-- ==============================================================================
-- MIGRATION: 00008_relatorio_fotografico.sql
-- Módulo de Engenharia / PCM: Relatório Fotográfico de Obras
-- Suporte completo a Projetos Oficiais (AprimoreERP) e Obras Avulsas (Convidados)
-- ==============================================================================

-- 1. Tabela Principal: Estrutura / Cabeçalho do Relatório Fotográfico
CREATE TABLE IF NOT EXISTS public.engenharia_estrutura_fotografica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE CASCADE, -- Nullable para suportar obras avulsas de convidados
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,         -- Usuário criador / responsável
  is_avulso boolean NOT NULL DEFAULT false,                         -- Flag indicando se é obra avulsa (convidado/sandbox)
  obra_nome text,                                                   -- Nome descritivo da obra (usado principalmente quando avulso)
  tipo_projeto text NOT NULL CHECK (tipo_projeto IN ('infraestrutura', 'reforma')),
  banco text,                                                       -- ex: 'Itau', 'Bradesco', 'Santander', etc.
  modelo_relatorio text,
  equipamentos jsonb NOT NULL DEFAULT '[]'::jsonb,                  -- [{nome, pontos:[{numero, local}]}]
  servicos_habilitados text[] NOT NULL DEFAULT '{}',                -- Nomes de serviços habilitados neste relatório
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Garantir índice único para projeto corporativo oficial (apenas 1 estrutura por projeto oficial)
CREATE UNIQUE INDEX IF NOT EXISTS idx_estrutura_foto_projeto_unico 
  ON public.engenharia_estrutura_fotografica (projeto_id) 
  WHERE projeto_id IS NOT NULL;

-- Índice para buscas por usuário (útil para convidados listarem suas obras avulsas)
CREATE INDEX IF NOT EXISTS idx_estrutura_foto_user_id 
  ON public.engenharia_estrutura_fotografica (user_id);

-- 2. Memória / Catálogo Global de Serviços (Sugestões conhecidas)
CREATE TABLE IF NOT EXISTS public.engenharia_servicos_catalogo (
  nome text PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Memória / Catálogo Global de Ambientes (Sugestões conhecidas)
CREATE TABLE IF NOT EXISTS public.engenharia_ambientes_catalogo (
  nome text PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Slides / Fotos montadas no Relatório Fotográfico
CREATE TABLE IF NOT EXISTS public.engenharia_progresso_relatorio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id uuid NOT NULL REFERENCES public.engenharia_estrutura_fotografica(id) ON DELETE CASCADE,
  ordem integer NOT NULL,
  servico text,                                                     -- Usado em reformas
  ambiente text,                                                    -- Usado em reformas
  equipamento text,                                                 -- Usado em infraestrutura
  numero_ponto text,                                                -- Usado em infraestrutura
  local text,                                                       -- Usado em infraestrutura
  etapa1 text NOT NULL DEFAULT 'ANTES' CHECK (etapa1 IN ('ANTES', 'DURANTE')),
  foto_antes_path text NOT NULL,                                    -- Caminho da imagem no Supabase Storage
  foto_depois_path text NOT NULL,                                   -- Caminho da imagem no Supabase Storage
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índice de ordenação rápida dos slides do relatório
CREATE INDEX IF NOT EXISTS idx_progresso_relatorio_ordem 
  ON public.engenharia_progresso_relatorio (relatorio_id, ordem);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.engenharia_estrutura_fotografica ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engenharia_servicos_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engenharia_ambientes_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engenharia_progresso_relatorio ENABLE ROW LEVEL SECURITY;

-- Políticas para engenharia_estrutura_fotografica
CREATE POLICY "Leitura de estrutura fotografica para autenticados"
  ON public.engenharia_estrutura_fotografica FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insercao de estrutura fotografica para autenticados"
  ON public.engenharia_estrutura_fotografica FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Atualizacao de estrutura fotografica para autenticados"
  ON public.engenharia_estrutura_fotografica FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Delecao de estrutura fotografica para autenticados"
  ON public.engenharia_estrutura_fotografica FOR DELETE TO authenticated USING (true);

-- Políticas para engenharia_servicos_catalogo
CREATE POLICY "Leitura de servicos catalogo para autenticados"
  ON public.engenharia_servicos_catalogo FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escrita de servicos catalogo para autenticados"
  ON public.engenharia_servicos_catalogo FOR ALL TO authenticated USING (true);

-- Políticas para engenharia_ambientes_catalogo
CREATE POLICY "Leitura de ambientes catalogo para autenticados"
  ON public.engenharia_ambientes_catalogo FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escrita de ambientes catalogo para autenticados"
  ON public.engenharia_ambientes_catalogo FOR ALL TO authenticated USING (true);

-- Políticas para engenharia_progresso_relatorio
CREATE POLICY "Leitura de progresso relatorio para autenticados"
  ON public.engenharia_progresso_relatorio FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insercao de progresso relatorio para autenticados"
  ON public.engenharia_progresso_relatorio FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Atualizacao de progresso relatorio para autenticados"
  ON public.engenharia_progresso_relatorio FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Delecao de progresso relatorio para autenticados"
  ON public.engenharia_progresso_relatorio FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- BUCKET DE STORAGE SUPABASE: relatorios-fotograficos
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('relatorios-fotograficos', 'relatorios-fotograficos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para o bucket relatorios-fotograficos
CREATE POLICY "Permitir leitura publica de fotos do relatorio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'relatorios-fotograficos');

CREATE POLICY "Permitir upload de fotos do relatorio para autenticados"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'relatorios-fotograficos');

CREATE POLICY "Permitir update de fotos do relatorio para autenticados"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'relatorios-fotograficos');

CREATE POLICY "Permitir delete de fotos do relatorio para autenticados"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'relatorios-fotograficos');
