-- ==============================================================================
-- MIGRATION: 00022_convite_genero_e_fix_email.sql
-- 1. Campo de gênero no convite (pra personalizar "convidado"/"convidada"
--    em vez do genérico "convidado(a)").
-- 2. Corrige aceitar_convite/admin_criar_usuario: `auth.users.email` também
--    é uma coluna GERADA nesta versão do Supabase (mesmo problema já
--    corrigido pra confirmed_at na migration 00021) — descoberto testando
--    o cadastro de convite ao vivo ("cannot insert a non-DEFAULT value
--    into column email"). Removida do INSERT em auth.users e
--    auth.identities; o valor já está em raw_user_meta_data/identity_data
--    (chave 'email'), que é de onde a coluna gerada deve tirar o valor.
-- ==============================================================================

ALTER TABLE public.convites_usuario
  ADD COLUMN IF NOT EXISTS genero text CHECK (genero IN ('m', 'f') OR genero IS NULL);

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

  RETURN to_jsonb(v_convite);
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_convite_usuario(text, text, text, text, text) TO authenticated;

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
    'role', v_convite.role,
    'genero', v_convite.genero
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.obter_convite_por_token(text) TO anon, authenticated;

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

  -- `email` removida do INSERT (coluna gerada, ver comentário da migration) —
  -- o valor já está em raw_user_meta_data->>'email'.
  INSERT INTO auth.users (
    instance_id, id, aud, role, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_user_id, 'authenticated', 'authenticated', v_encrypted_pw,
    now(),
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

  RETURN jsonb_build_object('success', true, 'email', v_convite.email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.aceitar_convite(text, text, text, text) TO anon, authenticated;

-- admin_criar_usuario (00019) tem o mesmo problema de `email` gerada —
-- corrigindo por consistência, mesmo não estando mais em uso pela UI.
CREATE OR REPLACE FUNCTION public.admin_criar_usuario(
  p_email text,
  p_password text,
  p_nome text,
  p_role text DEFAULT 'convidado'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role public.user_role;
  v_new_user_id uuid;
  v_encrypted_pw text;
  v_clean_email text;
  v_assigned_role public.user_role;
  v_cargo text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('god', 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem cadastrar novos usuários';
  END IF;

  v_clean_email := lower(trim(p_email));
  IF v_clean_email = '' OR position('@' in v_clean_email) = 0 THEN
    RAISE EXCEPTION 'E-mail inválido';
  END IF;

  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'A senha deve ter pelo menos 6 caracteres';
  END IF;

  IF coalesce(trim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'O nome completo é obrigatório';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email) THEN
    RAISE EXCEPTION 'Este e-mail já está cadastrado no sistema';
  END IF;

  IF p_role = 'convidado' THEN
    v_assigned_role := 'convidado'::public.user_role;
    v_cargo := 'Parceiro EGF';
  ELSIF p_role = 'admin' THEN
    v_assigned_role := 'admin'::public.user_role;
    v_cargo := 'Administrador';
  ELSIF p_role = 'god' THEN
    v_assigned_role := 'god'::public.user_role;
    v_cargo := 'Diretoria';
  ELSIF p_role = 'engenheiro' THEN
    v_assigned_role := 'user'::public.user_role;
    v_cargo := 'Engenheiro';
  ELSIF p_role = 'financeiro' THEN
    v_assigned_role := 'user'::public.user_role;
    v_cargo := 'Financeiro';
  ELSE
    v_assigned_role := 'user'::public.user_role;
    v_cargo := 'Colaborador';
  END IF;

  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf', 10));
  v_new_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_user_id, 'authenticated', 'authenticated', v_encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'sub', v_new_user_id::text, 'email', v_clean_email,
      'full_name', p_nome, 'role', p_role,
      'email_verified', true, 'phone_verified', false
    ),
    now(), now(), false, false
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_new_user_id, v_new_user_id::text,
    jsonb_build_object(
      'sub', v_new_user_id::text, 'email', v_clean_email,
      'full_name', p_nome, 'role', p_role,
      'email_verified', true, 'phone_verified', false
    ),
    'email', now(), now(), now()
  );

  UPDATE public.profiles
  SET nome = p_nome, role = v_assigned_role, cargo = v_cargo
  WHERE id = v_new_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', v_new_user_id, 'email', v_clean_email, 'role', v_assigned_role, 'cargo', v_cargo);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_criar_usuario(text, text, text, text) TO authenticated;
