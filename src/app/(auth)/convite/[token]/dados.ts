import { supabase } from '@/shared/lib/supabaseClient';

export interface ConviteInfo {
  valido: boolean;
  motivo?: string;
  email?: string;
  nome?: string;
  telefone?: string | null;
  role?: string;
}

/** Usado tanto no Server Component (generateMetadata/page) quanto na imagem de preview (opengraph-image.tsx). */
export async function buscarConvite(token: string): Promise<ConviteInfo | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('obter_convite_por_token', { p_token: token });
  if (error) return null;
  return data as ConviteInfo;
}
