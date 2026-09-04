-- ==============================================================================
-- MIGRATION: 00015_cowork_colaboradores_rpc.sql
-- RPCs para o recurso "Compartilhar" (Cowork) do Relatório Fotográfico:
-- o cliente não tem acesso direto a auth.users (nem deveria), então a busca
-- de usuário por e-mail e a gestão de colaboradores passam por funções
-- SECURITY DEFINER que fazem essa ponte com segurança.
-- ==============================================================================

-- Adiciona (ou atualiza o papel de) um colaborador pelo e-mail dele.
-- Só quem já pode editar o relatório (dono, staff interno, ou colaborador
-- admin) pode chamar isso — reforçado tanto pela policy de INSERT/UPDATE em
-- engenharia_relatorio_colaboradores quanto aqui, por clareza.
CREATE OR REPLACE FUNCTION public.adicionar_colaborador_relatorio(
  p_relatorio_id uuid,
  p_email text,
  p_papel text DEFAULT 'editor'
)
RETURNS TABLE (
  id uuid,
  relatorio_id uuid,
  user_id uuid,
  papel text,
  nome text,
  email text
) AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.pode_editar_relatorio(p_relatorio_id) THEN
    RAISE EXCEPTION 'Sem permissão para compartilhar este relatório.';
  END IF;

  IF p_papel NOT IN ('leitor', 'editor', 'admin') THEN
    RAISE EXCEPTION 'Papel inválido: %', p_papel;
  END IF;

  SELECT u.id INTO v_user_id FROM auth.users u WHERE lower(u.email) = lower(trim(p_email));

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário cadastrado com o e-mail %', p_email;
  END IF;

  IF v_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você já tem acesso ao próprio relatório.';
  END IF;

  INSERT INTO public.engenharia_relatorio_colaboradores (relatorio_id, user_id, papel)
  VALUES (p_relatorio_id, v_user_id, p_papel)
  ON CONFLICT (relatorio_id, user_id) DO UPDATE SET papel = excluded.papel;

  RETURN QUERY
  SELECT c.id, c.relatorio_id, c.user_id, c.papel, pr.nome, u.email::text
  FROM public.engenharia_relatorio_colaboradores c
  JOIN public.profiles pr ON pr.id = c.user_id
  JOIN auth.users u ON u.id = c.user_id
  WHERE c.relatorio_id = p_relatorio_id AND c.user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Lista os colaboradores de um relatório já com nome/e-mail resolvidos
-- (a tabela crua só tem user_id — sem isso o front teria que adivinhar).
CREATE OR REPLACE FUNCTION public.listar_colaboradores_relatorio(p_relatorio_id uuid)
RETURNS TABLE (
  id uuid,
  relatorio_id uuid,
  user_id uuid,
  papel text,
  nome text,
  email text
) AS $$
BEGIN
  IF NOT public.pode_acessar_relatorio(p_relatorio_id) THEN
    RAISE EXCEPTION 'Sem permissão para ver os colaboradores deste relatório.';
  END IF;

  RETURN QUERY
  SELECT c.id, c.relatorio_id, c.user_id, c.papel, pr.nome, u.email::text
  FROM public.engenharia_relatorio_colaboradores c
  JOIN public.profiles pr ON pr.id = c.user_id
  JOIN auth.users u ON u.id = c.user_id
  WHERE c.relatorio_id = p_relatorio_id
  ORDER BY c.created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Remove um colaborador — a policy "Gestao de colaboradores por donos e
-- staff" já cobre isso via DELETE direto na tabela, mas expomos como RPC
-- também para manter uma única superfície de chamada no cliente.
CREATE OR REPLACE FUNCTION public.remover_colaborador_relatorio(p_colaborador_id uuid)
RETURNS void AS $$
DECLARE
  v_relatorio_id uuid;
BEGIN
  SELECT relatorio_id INTO v_relatorio_id
  FROM public.engenharia_relatorio_colaboradores WHERE id = p_colaborador_id;

  IF v_relatorio_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.pode_editar_relatorio(v_relatorio_id) THEN
    RAISE EXCEPTION 'Sem permissão para remover colaboradores deste relatório.';
  END IF;

  DELETE FROM public.engenharia_relatorio_colaboradores WHERE id = p_colaborador_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.adicionar_colaborador_relatorio(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_colaboradores_relatorio(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remover_colaborador_relatorio(uuid) TO authenticated;
