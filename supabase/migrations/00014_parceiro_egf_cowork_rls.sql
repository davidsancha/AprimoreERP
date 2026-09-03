-- ==============================================================================
-- MIGRATION: 00014_parceiro_egf_cowork_rls.sql
-- Suporte a Parceiros EGF (convidados) e Coworking em Relatórios Fotográficos:
-- 1. Trigger handle_new_user honrando role 'convidado' via metadata no cadastro.
-- 2. Tabela engenharia_relatorio_colaboradores para compartilhamento (Cowork).
-- 3. Funções helper de permissão (is_internal_staff, pode_acessar_relatorio, pode_editar_relatorio).
-- 4. RLS refinada para engenharia_estrutura_fotografica e engenharia_progresso_relatorio.
-- ==============================================================================

-- 1. Atualizar trigger handle_new_user para honrar role 'convidado'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  users_count integer;
  assigned_role public.user_role;
  meta_role text;
BEGIN
  SELECT count(*) INTO users_count FROM public.profiles;
  meta_role := new.raw_user_meta_data->>'role';

  IF users_count = 0 THEN
    assigned_role := 'god'::public.user_role;
  ELSIF meta_role = 'convidado' THEN
    assigned_role := 'convidado'::public.user_role;
  ELSE
    assigned_role := 'user'::public.user_role;
  END IF;

  INSERT INTO public.profiles (id, nome, role, cargo)
  VALUES (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 
    assigned_role,
    CASE WHEN assigned_role = 'convidado' THEN 'Parceiro EGF' ELSE 'Colaborador' END
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Tabela de Colaboradores de Relatório (Cowork)
CREATE TABLE IF NOT EXISTS public.engenharia_relatorio_colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id uuid NOT NULL REFERENCES public.engenharia_estrutura_fotografica(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel text NOT NULL DEFAULT 'editor' CHECK (papel IN ('leitor', 'editor', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(relatorio_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_relatorio_colaboradores_user 
  ON public.engenharia_relatorio_colaboradores (user_id);

CREATE INDEX IF NOT EXISTS idx_relatorio_colaboradores_relatorio 
  ON public.engenharia_relatorio_colaboradores (relatorio_id);

ALTER TABLE public.engenharia_relatorio_colaboradores ENABLE ROW LEVEL SECURITY;

-- 3. Funções Helpers de Permissão (SECURITY DEFINER para evitar recursão em profiles/RLS)
CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('god', 'admin', 'user')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.pode_acessar_relatorio(p_relatorio_id uuid)
RETURNS boolean AS $$
BEGIN
  IF public.is_internal_staff() THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.engenharia_estrutura_fotografica e
    WHERE e.id = p_relatorio_id
      AND (
        e.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.engenharia_relatorio_colaboradores c
          WHERE c.relatorio_id = e.id AND c.user_id = auth.uid()
        )
      )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.pode_editar_relatorio(p_relatorio_id uuid)
RETURNS boolean AS $$
BEGIN
  IF public.is_internal_staff() THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.engenharia_estrutura_fotografica e
    WHERE e.id = p_relatorio_id
      AND (
        e.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.engenharia_relatorio_colaboradores c
          WHERE c.relatorio_id = e.id AND c.user_id = auth.uid() AND c.papel IN ('editor', 'admin')
        )
      )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4. Policies para engenharia_relatorio_colaboradores
DROP POLICY IF EXISTS "Acesso colaboradores para autenticados" ON public.engenharia_relatorio_colaboradores;
DROP POLICY IF EXISTS "Leitura de colaboradores para autenticados" ON public.engenharia_relatorio_colaboradores;
DROP POLICY IF EXISTS "Insercao/gestao de colaboradores por donos e staff" ON public.engenharia_relatorio_colaboradores;

CREATE POLICY "Leitura de colaboradores para autenticados"
  ON public.engenharia_relatorio_colaboradores FOR SELECT TO authenticated
  USING (
    public.is_internal_staff() OR 
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.engenharia_estrutura_fotografica e 
      WHERE e.id = relatorio_id AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Gestao de colaboradores por donos e staff"
  ON public.engenharia_relatorio_colaboradores FOR ALL TO authenticated
  USING (
    public.is_internal_staff() OR 
    EXISTS (
      SELECT 1 FROM public.engenharia_estrutura_fotografica e 
      WHERE e.id = relatorio_id AND e.user_id = auth.uid()
    )
  );

-- 5. Atualizar RLS de engenharia_estrutura_fotografica
DROP POLICY IF EXISTS "Leitura de estrutura fotografica para autenticados" ON public.engenharia_estrutura_fotografica;
DROP POLICY IF EXISTS "Insercao de estrutura fotografica para autenticados" ON public.engenharia_estrutura_fotografica;
DROP POLICY IF EXISTS "Atualizacao de estrutura fotografica para autenticados" ON public.engenharia_estrutura_fotografica;
DROP POLICY IF EXISTS "Delecao de estrutura fotografica para autenticados" ON public.engenharia_estrutura_fotografica;

CREATE POLICY "Leitura de estrutura fotografica"
  ON public.engenharia_estrutura_fotografica FOR SELECT TO authenticated
  USING (public.pode_acessar_relatorio(id));

CREATE POLICY "Insercao de estrutura fotografica"
  ON public.engenharia_estrutura_fotografica FOR INSERT TO authenticated
  WITH CHECK (
    public.is_internal_staff() OR 
    (user_id = auth.uid() AND is_avulso = true)
  );

CREATE POLICY "Atualizacao de estrutura fotografica"
  ON public.engenharia_estrutura_fotografica FOR UPDATE TO authenticated
  USING (public.pode_editar_relatorio(id));

CREATE POLICY "Delecao de estrutura fotografica"
  ON public.engenharia_estrutura_fotografica FOR DELETE TO authenticated
  USING (
    public.is_internal_staff() OR 
    user_id = auth.uid()
  );

-- 6. Atualizar RLS de engenharia_progresso_relatorio
DROP POLICY IF EXISTS "Leitura de progresso relatorio para autenticados" ON public.engenharia_progresso_relatorio;
DROP POLICY IF EXISTS "Insercao de progresso relatorio para autenticados" ON public.engenharia_progresso_relatorio;
DROP POLICY IF EXISTS "Atualizacao de progresso relatorio para autenticados" ON public.engenharia_progresso_relatorio;
DROP POLICY IF EXISTS "Delecao de progresso relatorio para autenticados" ON public.engenharia_progresso_relatorio;

CREATE POLICY "Leitura de progresso relatorio"
  ON public.engenharia_progresso_relatorio FOR SELECT TO authenticated
  USING (public.pode_acessar_relatorio(relatorio_id));

CREATE POLICY "Insercao de progresso relatorio"
  ON public.engenharia_progresso_relatorio FOR INSERT TO authenticated
  WITH CHECK (public.pode_editar_relatorio(relatorio_id));

CREATE POLICY "Atualizacao de progresso relatorio"
  ON public.engenharia_progresso_relatorio FOR UPDATE TO authenticated
  USING (public.pode_editar_relatorio(relatorio_id));

CREATE POLICY "Delecao de progresso relatorio"
  ON public.engenharia_progresso_relatorio FOR DELETE TO authenticated
  USING (public.pode_editar_relatorio(relatorio_id));
