-- ==============================================================================
-- MIGRATION: 00027_fix_ambiguidade_colaborador.sql
-- Causa raiz de verdade do "column reference relatorio_id is ambiguous" em
-- adicionar_colaborador_relatorio, reproduzido de novo em produção mesmo
-- depois da migration 00025 qualificar toda referência com alias de tabela
-- (`erc.relatorio_id`, `au.email` etc.):
--
--   INSERT INTO public.engenharia_relatorio_colaboradores AS erc (relatorio_id, user_id, papel)
--   VALUES (p_relatorio_id, v_user_id, p_papel)
--   ON CONFLICT (relatorio_id, user_id) DO UPDATE SET papel = excluded.papel
--
-- O alvo do ON CONFLICT (`ON CONFLICT (relatorio_id, user_id)`) não aceita
-- apelido de tabela — é só uma lista de nomes de coluna. Como a função
-- também RETURNS TABLE (..., relatorio_id uuid, ...), esse nome vira uma
-- variável PL/pgSQL acessível em qualquer lugar do corpo da função, e o
-- Postgres não consegue decidir entre "coluna da tabela" e "variável de
-- saída" só ali no alvo do ON CONFLICT — que, ao contrário do SELECT, não
-- tem como qualificar com `erc.` pra desempatar. Qualificar o resto do
-- corpo (o que a 00025 já fez) não resolve essa cláusula específica.
--
-- Fix de verdade: troca o UPSERT via ON CONFLICT por um
-- SELECT-then-INSERT-or-UPDATE manual em PL/pgSQL — nunca referencia
-- "relatorio_id" desqualificado em nenhum lugar, então a ambiguidade não
-- tem como acontecer, seja lá qual for o mecanismo exato por trás dela.
-- ==============================================================================

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
  v_colaborador_id uuid;
  v_existente_id uuid;
  v_obra_nome text;
BEGIN
  IF NOT public.pode_editar_relatorio(p_relatorio_id) THEN
    RAISE EXCEPTION 'Sem permissão para compartilhar este relatório.';
  END IF;

  IF p_papel NOT IN ('leitor', 'editor', 'admin') THEN
    RAISE EXCEPTION 'Papel inválido: %', p_papel;
  END IF;

  SELECT au.id INTO v_user_id FROM auth.users au WHERE lower(au.email) = lower(trim(p_email));

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário cadastrado com o e-mail %', p_email;
  END IF;

  IF v_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você já tem acesso ao próprio relatório.';
  END IF;

  -- Upsert manual — nunca usa ON CONFLICT, então "relatorio_id" nunca
  -- aparece desqualificado em posição nenhuma (ver comentário acima).
  SELECT erc.id INTO v_existente_id
  FROM public.engenharia_relatorio_colaboradores erc
  WHERE erc.relatorio_id = p_relatorio_id AND erc.user_id = v_user_id;

  IF v_existente_id IS NOT NULL THEN
    UPDATE public.engenharia_relatorio_colaboradores
    SET papel = p_papel
    WHERE id = v_existente_id;
    v_colaborador_id := v_existente_id;
  ELSE
    INSERT INTO public.engenharia_relatorio_colaboradores (relatorio_id, user_id, papel)
    VALUES (p_relatorio_id, v_user_id, p_papel)
    RETURNING id INTO v_colaborador_id;
  END IF;

  SELECT COALESCE(e.obra_nome, 'um relatório') INTO v_obra_nome
  FROM public.engenharia_estrutura_fotografica e
  WHERE e.id = p_relatorio_id;

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
  VALUES (
    v_user_id,
    'compartilhamento_relatorio',
    'Um relatório foi compartilhado com você',
    v_obra_nome,
    '/engenharia/relatorio-fotografico?relatorio=' || p_relatorio_id::text
  );

  RETURN QUERY
  SELECT erc.id, erc.relatorio_id, erc.user_id, erc.papel, pr.nome::text, au.email::text
  FROM public.engenharia_relatorio_colaboradores erc
  JOIN public.profiles pr ON pr.id = erc.user_id
  JOIN auth.users au ON au.id = erc.user_id
  WHERE erc.id = v_colaborador_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.adicionar_colaborador_relatorio(uuid, text, text) TO authenticated;
