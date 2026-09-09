-- ==============================================================================
-- MIGRATION: 00024_bloqueio_log_e_tutorial.sql
-- 1. Bloquear/desbloquear/excluir usuários (God/admin).
-- 2. Log de atividades (auditoria simples).
-- 3. Flag de tutorial visto (Parceiro EGF).
-- ==============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bloqueado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tutorial_visto boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.log_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  ator_id uuid,
  ator_nome text,
  acao text NOT NULL,
  alvo_tipo text,
  alvo_id text,
  alvo_nome text,
  detalhes jsonb
);

CREATE INDEX IF NOT EXISTS idx_log_atividades_criado_em ON public.log_atividades (criado_em DESC);

ALTER TABLE public.log_atividades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura de log por god e admin" ON public.log_atividades;
CREATE POLICY "Leitura de log por god e admin"
  ON public.log_atividades FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('god', 'admin')));

-- Helper interno — só chamado de dentro de outras funções SECURITY DEFINER,
-- nunca exposto direto pro client.
CREATE OR REPLACE FUNCTION public.registrar_log(
  p_acao text,
  p_alvo_tipo text,
  p_alvo_id text,
  p_alvo_nome text,
  p_detalhes jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ator_nome text;
BEGIN
  SELECT nome INTO v_ator_nome FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.log_atividades (ator_id, ator_nome, acao, alvo_tipo, alvo_id, alvo_nome, detalhes)
  VALUES (auth.uid(), v_ator_nome, p_acao, p_alvo_tipo, p_alvo_id, p_alvo_nome, p_detalhes);
END;
$$;

-- ------------------------------------------------------------------------
-- Recria criar_convite_usuario/aceitar_convite/revogar_convite (00022)
-- só pra acrescentar o registro de log — corpo igual, fora isso.
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_convite_usuario(
  p_email text,
  p_nome text,
  p_telefone text DEFAULT NULL,
  p_role text DEFAULT 'user',
  p_genero text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role public.user_role;
  v_clean_email text;
  v_convite public.convites_usuario;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('god', 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem criar convites';
  END IF;

  v_clean_email := lower(trim(p_email));
  IF v_clean_email = '' OR position('@' in v_clean_email) = 0 THEN
    RAISE EXCEPTION 'E-mail inválido';
  END IF;

  IF coalesce(trim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'O nome é obrigatório';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email) THEN
    RAISE EXCEPTION 'Este e-mail já tem conta no sistema';
  END IF;

  IF EXISTS (SELECT 1 FROM public.convites_usuario WHERE lower(email) = v_clean_email AND status = 'pendente') THEN
    RAISE EXCEPTION 'Já existe um convite pendente para este e-mail';
  END IF;

  IF p_genero IS NOT NULL AND p_genero NOT IN ('m', 'f') THEN
    p_genero := NULL;
  END IF;

  INSERT INTO public.convites_usuario (email, nome, telefone, role, genero, criado_por)
  VALUES (v_clean_email, trim(p_nome), nullif(trim(p_telefone), ''), p_role, p_genero, auth.uid())
  RETURNING * INTO v_convite;

  PERFORM public.registrar_log('convite_criado', 'convite', v_convite.id::text, v_convite.nome, jsonb_build_object('email', v_convite.email, 'role', v_convite.role));

  RETURN to_jsonb(v_convite);
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_convite_usuario(text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.aceitar_convite(
  p_token text,
  p_nome text,
  p_telefone text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_convite public.convites_usuario;
  v_new_user_id uuid;
  v_encrypted_pw text;
  v_assigned_role public.user_role;
  v_cargo text;
BEGIN
  SELECT * INTO v_convite FROM public.convites_usuario WHERE token = p_token;

  IF v_convite IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado';
  ELSIF v_convite.status = 'aceito' THEN
    RAISE EXCEPTION 'Este convite já foi usado';
  ELSIF v_convite.status = 'revogado' THEN
    RAISE EXCEPTION 'Este convite foi revogado';
  ELSIF v_convite.expires_at < now() THEN
    RAISE EXCEPTION 'Este convite expirou';
  END IF;

  IF coalesce(trim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'O nome é obrigatório';
  END IF;

  IF length(p_password) < 8
     OR p_password !~ '[A-Z]'
     OR p_password !~ '[a-z]'
     OR p_password !~ '[0-9]'
     OR p_password !~ '[^A-Za-z0-9]' THEN
    RAISE EXCEPTION 'A senha precisa ter 8+ caracteres, maiúscula, minúscula, número e caractere especial';
  END IF;

  IF v_convite.role = 'convidado' THEN
    v_assigned_role := 'convidado'::public.user_role;
    v_cargo := 'Parceiro EGF';
  ELSIF v_convite.role = 'admin' THEN
    v_assigned_role := 'admin'::public.user_role;
    v_cargo := 'Administrador';
  ELSIF v_convite.role = 'god' THEN
    v_assigned_role := 'god'::public.user_role;
    v_cargo := 'Diretoria';
  ELSIF v_convite.role = 'engenheiro' THEN
    v_assigned_role := 'user'::public.user_role;
    v_cargo := 'Engenheiro';
  ELSIF v_convite.role = 'financeiro' THEN
    v_assigned_role := 'user'::public.user_role;
    v_cargo := 'Financeiro';
  ELSE
    v_assigned_role := 'user'::public.user_role;
    v_cargo := 'Colaborador';
  END IF;

  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf', 10));
  v_new_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_sso_user, is_anonymous,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_user_id, 'authenticated', 'authenticated', v_convite.email, v_encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'sub', v_new_user_id::text, 'email', v_convite.email,
      'full_name', trim(p_nome), 'role', v_convite.role,
      'email_verified', true, 'phone_verified', false
    ),
    now(), now(), false, false,
    '', '', '', '', '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_new_user_id, v_new_user_id::text,
    jsonb_build_object(
      'sub', v_new_user_id::text, 'email', v_convite.email,
      'full_name', trim(p_nome), 'role', v_convite.role,
      'email_verified', true, 'phone_verified', false
    ),
    'email', now(), now(), now()
  );

  UPDATE public.profiles
  SET nome = trim(p_nome),
      role = v_assigned_role,
      cargo = v_cargo,
      telefone = nullif(trim(p_telefone), '')
  WHERE id = v_new_user_id;

  UPDATE public.convites_usuario
  SET status = 'aceito', accepted_at = now(), accepted_user_id = v_new_user_id
  WHERE id = v_convite.id;

  PERFORM public.registrar_log('convite_aceito', 'usuario', v_new_user_id::text, trim(p_nome), jsonb_build_object('email', v_convite.email, 'role', v_convite.role));

  RETURN jsonb_build_object('success', true, 'email', v_convite.email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.aceitar_convite(text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.revogar_convite(p_convite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role public.user_role;
  v_convite public.convites_usuario;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('god', 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem revogar convites';
  END IF;

  UPDATE public.convites_usuario SET status = 'revogado' WHERE id = p_convite_id AND status = 'pendente'
  RETURNING * INTO v_convite;

  IF v_convite.id IS NOT NULL THEN
    PERFORM public.registrar_log('convite_revogado', 'convite', v_convite.id::text, v_convite.nome, jsonb_build_object('email', v_convite.email));
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revogar_convite(uuid) TO authenticated;

-- ------------------------------------------------------------------------
-- Bloquear / desbloquear / excluir usuário
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bloquear_usuario(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role public.user_role;
  v_alvo_role public.user_role;
  v_alvo_nome text;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('god', 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode bloquear a própria conta';
  END IF;

  SELECT role, nome INTO v_alvo_role, v_alvo_nome FROM public.profiles WHERE id = p_user_id;
  IF v_alvo_role = 'god' THEN
    RAISE EXCEPTION 'Não é possível bloquear uma conta God';
  END IF;

  UPDATE auth.users SET banned_until = '2999-12-31 00:00:00+00'::timestamptz WHERE id = p_user_id;
  UPDATE public.profiles SET bloqueado = true WHERE id = p_user_id;

  PERFORM public.registrar_log('usuario_bloqueado', 'usuario', p_user_id::text, v_alvo_nome, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.bloquear_usuario(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.desbloquear_usuario(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role public.user_role;
  v_alvo_nome text;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('god', 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT nome INTO v_alvo_nome FROM public.profiles WHERE id = p_user_id;

  UPDATE auth.users SET banned_until = NULL WHERE id = p_user_id;
  UPDATE public.profiles SET bloqueado = false WHERE id = p_user_id;

  PERFORM public.registrar_log('usuario_desbloqueado', 'usuario', p_user_id::text, v_alvo_nome, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.desbloquear_usuario(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.excluir_usuario(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role public.user_role;
  v_alvo_role public.user_role;
  v_alvo_nome text;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('god', 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir a própria conta';
  END IF;

  SELECT role, nome INTO v_alvo_role, v_alvo_nome FROM public.profiles WHERE id = p_user_id;
  IF v_alvo_role = 'god' THEN
    RAISE EXCEPTION 'Não é possível excluir uma conta God';
  END IF;

  BEGIN
    -- Limpa vínculos conhecidos que referenciam auth.users(id) sem ON DELETE
    -- CASCADE, pra não travar o DELETE final com violação de FK.
    UPDATE public.convites_usuario SET accepted_user_id = NULL WHERE accepted_user_id = p_user_id;
    DELETE FROM public.engenharia_relatorio_colaboradores WHERE user_id = p_user_id;
    -- Relatórios próprios (avulsos) — já cascateia progresso/colaboradores desses relatórios (migration 00014)
    DELETE FROM public.engenharia_estrutura_fotografica WHERE user_id = p_user_id;

    DELETE FROM auth.users WHERE id = p_user_id;

    PERFORM public.registrar_log('usuario_excluido', 'usuario', p_user_id::text, v_alvo_nome, '{}'::jsonb);
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'Não foi possível excluir: essa conta ainda tem vínculos em outra área do sistema. Bloqueie o acesso em vez de excluir.';
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.excluir_usuario(uuid) TO authenticated;

-- ------------------------------------------------------------------------
-- Tutorial visto (Parceiro EGF)
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marcar_tutorial_visto(p_visto boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  UPDATE public.profiles SET tutorial_visto = p_visto WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_tutorial_visto(boolean) TO authenticated;
