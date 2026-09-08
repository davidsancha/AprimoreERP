-- ==============================================================================
-- MIGRATION: 00020_convites_usuario.sql
-- Cadastro só por convite: o God/admin cria um convite (e-mail, nome,
-- telefone, role) e gera um link (/convite/{token}); a pessoa convidada
-- completa o próprio cadastro (edita o nome se quiser, define a própria
-- senha) sem nunca precisar de cadastro público. Reaproveita a mesma
-- técnica de admin_criar_usuario (migration 00019) para criar o usuário
-- direto em auth.users, já confirmado — sem e-mail de confirmação, sem
-- rate limit.
-- ==============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telefone text;

CREATE TABLE IF NOT EXISTS public.convites_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  email text NOT NULL,
  nome text NOT NULL,
  telefone text,
  role text NOT NULL DEFAULT 'user',
  criado_por uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'revogado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_user_id uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_convites_usuario_token ON public.convites_usuario (token);
CREATE INDEX IF NOT EXISTS idx_convites_usuario_status ON public.convites_usuario (status);

ALTER TABLE public.convites_usuario ENABLE ROW LEVEL SECURITY;

-- Só god/admin enxergam/gerenciam a tabela de convites direto (tela de
-- gestão). O fluxo público (pessoa ainda sem conta) nunca lê essa tabela
-- direto — só pelas RPCs abaixo, que são SECURITY DEFINER.
DROP POLICY IF EXISTS "Gestao de convites por god e admin" ON public.convites_usuario;
CREATE POLICY "Gestao de convites por god e admin"
  ON public.convites_usuario FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('god', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('god', 'admin')));

-- ------------------------------------------------------------------------
-- criar_convite_usuario — só god/admin. Gera o convite; o link final
-- (`${origin}/convite/${token}`) é montado no client.
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_convite_usuario(
  p_email text,
  p_nome text,
  p_telefone text DEFAULT NULL,
  p_role text DEFAULT 'user'
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

  INSERT INTO public.convites_usuario (email, nome, telefone, role, criado_por)
  VALUES (v_clean_email, trim(p_nome), nullif(trim(p_telefone), ''), p_role, auth.uid())
  RETURNING * INTO v_convite;

  RETURN to_jsonb(v_convite);
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_convite_usuario(text, text, text, text) TO authenticated;

-- ------------------------------------------------------------------------
-- obter_convite_por_token — pública (a pessoa convidada ainda não tem
-- conta). Só devolve convites pendentes e não expirados.
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.obter_convite_por_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_convite public.convites_usuario;
BEGIN
  SELECT * INTO v_convite FROM public.convites_usuario WHERE token = p_token;

  IF v_convite IS NULL THEN
    RETURN jsonb_build_object('valido', false, 'motivo', 'nao_encontrado');
  ELSIF v_convite.status = 'aceito' THEN
    RETURN jsonb_build_object('valido', false, 'motivo', 'ja_aceito');
  ELSIF v_convite.status = 'revogado' THEN
    RETURN jsonb_build_object('valido', false, 'motivo', 'revogado');
  ELSIF v_convite.expires_at < now() THEN
    RETURN jsonb_build_object('valido', false, 'motivo', 'expirado');
  END IF;

  RETURN jsonb_build_object(
    'valido', true,
    'email', v_convite.email,
    'nome', v_convite.nome,
    'telefone', v_convite.telefone,
    'role', v_convite.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.obter_convite_por_token(text) TO anon, authenticated;

-- ------------------------------------------------------------------------
-- aceitar_convite — pública. Cria a conta de verdade (mesma técnica de
-- admin_criar_usuario: INSERT direto em auth.users/auth.identities, já
-- confirmado) e marca o convite como aceito.
-- ------------------------------------------------------------------------
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

  -- Senha forte também validada aqui (defesa em profundidade — RPC é anônima)
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
    email_confirmed_at, confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_user_id, 'authenticated', 'authenticated', v_convite.email, v_encrypted_pw,
    now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'sub', v_new_user_id::text, 'email', v_convite.email,
      'full_name', trim(p_nome), 'role', v_convite.role,
      'email_verified', true, 'phone_verified', false
    ),
    now(), now(), false, false
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at, email
  ) VALUES (
    gen_random_uuid(), v_new_user_id, v_new_user_id::text,
    jsonb_build_object(
      'sub', v_new_user_id::text, 'email', v_convite.email,
      'full_name', trim(p_nome), 'role', v_convite.role,
      'email_verified', true, 'phone_verified', false
    ),
    'email', now(), now(), now(), v_convite.email
  );

  -- A trigger handle_new_user já criou a linha em profiles; completa com
  -- os dados do convite (nome pode ter sido editado pela pessoa, telefone
  -- idem).
  UPDATE public.profiles
  SET nome = trim(p_nome),
      role = v_assigned_role,
      cargo = v_cargo,
      telefone = nullif(trim(p_telefone), '')
  WHERE id = v_new_user_id;

  UPDATE public.convites_usuario
  SET status = 'aceito', accepted_at = now(), accepted_user_id = v_new_user_id
  WHERE id = v_convite.id;

  RETURN jsonb_build_object('success', true, 'email', v_convite.email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.aceitar_convite(text, text, text, text) TO anon, authenticated;

-- ------------------------------------------------------------------------
-- revogar_convite — só god/admin.
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revogar_convite(p_convite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role public.user_role;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('god', 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem revogar convites';
  END IF;

  UPDATE public.convites_usuario SET status = 'revogado' WHERE id = p_convite_id AND status = 'pendente';
END;
$$;

GRANT EXECUTE ON FUNCTION public.revogar_convite(uuid) TO authenticated;
