-- ==============================================================================
-- MIGRATION: 00023_fix_gotrue_user_tokens_and_email.sql
-- 1. Corrige auth.users.email (NÃO é gerada em auth.users; só é gerada em auth.identities)
-- 2. Preenche os tokens como strings vazias ('') em vez de NULL, pois o GoTrue
--    do Supabase (Go) quebra com:
--    "converting NULL to string is unsupported" ao fazer Scan em confirmation_token,
--    recovery_token, email_change, etc.
-- ==============================================================================

-- Corrige registros já criados que ficaram com email NULL ou tokens NULL
UPDATE auth.users
SET email = coalesce(email, raw_user_meta_data->>'email'),
    confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change = coalesce(email_change, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    phone_change = coalesce(phone_change, ''),
    phone_change_token = coalesce(phone_change_token, ''),
    reauthentication_token = coalesce(reauthentication_token, '')
WHERE confirmation_token IS NULL OR email IS NULL;

-- Atualiza aceitar_convite com o INSERT definitivo
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

  -- INSERT em auth.users: email EXPLÍCITO + tokens vazios (não NULL)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new,
    email_change, email_change_token_current, phone_change,
    phone_change_token, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_user_id, 'authenticated', 'authenticated', v_convite.email, v_encrypted_pw,
    now(),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'sub', v_new_user_id::text, 'email', v_convite.email,
      'full_name', trim(p_nome), 'role', v_convite.role,
      'email_verified', true, 'phone_verified', false
    ),
    now(), now(), false, false
  );

  -- INSERT em auth.identities: email omitido (gerada em identities)
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

-- Atualiza admin_criar_usuario com a mesma consistência
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
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new,
    email_change, email_change_token_current, phone_change,
    phone_change_token, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_user_id, 'authenticated', 'authenticated', v_clean_email, v_encrypted_pw,
    now(),
    '', '', '', '', '', '', '', '',
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
