-- ==============================================================================
-- MIGRATION: 00025_notificacoes_cowork.sql
-- Notificação in-app: quando alguém compartilha um relatório fotográfico
-- (Cowork) com um usuário, ele passa a ver um sininho no cabeçalho — hoje só
-- descobria entrando na tela e olhando "Compartilhados comigo".
--
-- Também recria `adicionar_colaborador_relatorio` com as referências a
-- `relatorio_id` totalmente qualificadas (inclusive no ON CONFLICT), pra
-- eliminar de vez o erro "column reference relatorio_id is ambiguous"
-- reportado em produção (ver _mensagens-agentes) — o texto de
-- 00015_cowork_colaboradores_rpc.sql já parecia correto, mas o Postgres
-- pode tratar o nome de uma coluna do RETURNS TABLE como variável dentro do
-- corpo da função; qualificar tudo remove a ambiguidade de vez.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text,
  link text,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_user_lida
  ON public.notificacoes (user_id, lida, created_at DESC);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura das proprias notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "Atualizacao das proprias notificacoes" ON public.notificacoes;

-- Sem policy de INSERT: só é criada via SECURITY DEFINER (abaixo), nunca
-- direto pelo client — ninguém deveria conseguir "notificar a si mesmo".
CREATE POLICY "Leitura das proprias notificacoes"
  ON public.notificacoes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Atualizacao das proprias notificacoes"
  ON public.notificacoes FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.marcar_notificacao_lida(p_id uuid)
RETURNS void AS $$
  UPDATE public.notificacoes SET lida = true WHERE id = p_id AND user_id = auth.uid();
$$ LANGUAGE sql SECURITY INVOKER;

CREATE OR REPLACE FUNCTION public.marcar_todas_notificacoes_lidas()
RETURNS void AS $$
  UPDATE public.notificacoes SET lida = true WHERE user_id = auth.uid() AND lida = false;
$$ LANGUAGE sql SECURITY INVOKER;

GRANT EXECUTE ON FUNCTION public.marcar_notificacao_lida(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_todas_notificacoes_lidas() TO authenticated;

-- Recria adicionar_colaborador_relatorio: mesma lógica de
-- 00015_cowork_colaboradores_rpc.sql, agora com toda referência a
-- relatorio_id qualificada por alias de tabela (nunca bare), e emitindo uma
-- notificação pro colaborador convidado ao final.
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

  INSERT INTO public.engenharia_relatorio_colaboradores AS erc (relatorio_id, user_id, papel)
  VALUES (p_relatorio_id, v_user_id, p_papel)
  ON CONFLICT (relatorio_id, user_id) DO UPDATE SET papel = excluded.papel
  RETURNING erc.id INTO v_colaborador_id;

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
