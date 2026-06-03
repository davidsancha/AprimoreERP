import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Verifica se as chaves reais foram fornecidas e não são placeholders
const isConfigured = 
  !!(supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('sua-url-do-supabase') && 
  !supabaseAnonKey.includes('sua-chave-anon-publica'));

// Retorna a instância se configurada, ou null (mas mascarado como SupabaseClient para o build)
export const supabase = (isConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null) as unknown as SupabaseClient;

export const isSupabaseConfigured = isConfigured;
