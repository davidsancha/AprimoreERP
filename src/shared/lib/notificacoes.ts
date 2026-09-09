import { supabase } from '@/shared/lib/supabaseClient';

export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
}

export async function listarNotificacoes(): Promise<Notificacao[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('notificacoes')
    .select('id, tipo, titulo, mensagem, link, lida, created_at')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data || [];
}

export async function contarNaoLidas(): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('notificacoes')
    .select('id', { count: 'exact', head: true })
    .eq('lida', false);
  if (error) throw error;
  return count || 0;
}

export async function marcarNotificacaoLida(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('marcar_notificacao_lida', { p_id: id });
  if (error) throw error;
}

export async function marcarTodasNotificacoesLidas(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('marcar_todas_notificacoes_lidas');
  if (error) throw error;
}
