import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Verifica se as chaves reais foram fornecidas e não são placeholders
const isConfigured = 
  !!(supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('sua-url-do-supabase') && 
  !supabaseAnonKey.includes('sua-chave-anon-publica'));

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

export const isSupabaseConfigured = isConfigured;
