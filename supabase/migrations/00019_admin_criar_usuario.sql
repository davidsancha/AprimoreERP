-- ==============================================================================
-- MIGRATION: 00019_admin_criar_usuario.sql
-- Permite que administradores criem novos usuários (incluindo Parceiros EGF)
-- diretamente no Supabase Auth sem disparar e-mails de confirmação e sem deslogar
-- a sessão atual do administrador no navegador.
-- ==============================================================================

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
  -- 1. Verifica autenticação do solicitante
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('god', 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem cadastrar novos usuários';
  END IF;

  -- 2. Sanitização e validação
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

  -- 3. Verifica duplicidade em auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email) THEN
    RAISE EXCEPTION 'Este e-mail já está cadastrado no sistema';
  END IF;

  -- 4. Determina role e cargo
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

  -- 5. Criptografa a senha com bcrypt (fator 10 padrão GoTrue)
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf', 10));
  v_new_user_id := gen_random_uuid();

  -- 6. Insere em auth.users (já confirmado: sem disparar e-mail, sem rate limit)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_user_id,
    'authenticated',
    'authenticated',
    v_clean_email,
    v_encrypted_pw,
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'sub', v_new_user_id::text,
      'email', v_clean_email,
      'full_name', p_nome,
      'role', p_role,
      'email_verified', true,
      'phone_verified', false
    ),
    now(),
    now(),
    false,
    false
  );

  -- 7. Insere em auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    email
  ) VALUES (
    gen_random_uuid(),
    v_new_user_id,
    v_new_user_id::text,
    jsonb_build_object(
      'sub', v_new_user_id::text,
      'email', v_clean_email,
      'full_name', p_nome,
      'role', p_role,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now(),
    v_clean_email
  );

  -- 8. Garante atualização no perfil criado pela trigger handle_new_user
  UPDATE public.profiles
  SET nome = p_nome,
      role = v_assigned_role,
      cargo = v_cargo
  WHERE id = v_new_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_new_user_id,
    'email', v_clean_email,
    'role', v_assigned_role,
    'cargo', v_cargo
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_criar_usuario(text, text, text, text) TO authenticated;
