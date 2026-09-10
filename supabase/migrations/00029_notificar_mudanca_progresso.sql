-- ==============================================================================
-- MIGRATION: 00029_notificar_mudanca_progresso.sql
-- David pediu: quando alguém adiciona/edita uma foto (slide de progresso)
-- num relatório compartilhado (Cowork), o dono e todos os outros
-- colaboradores devem receber uma notificação — exceto quem fez a
-- alteração. `criarProgresso`/`atualizarProgresso` gravam direto na tabela
-- (não via RPC), então um trigger AFTER INSERT/UPDATE em
-- engenharia_progresso_relatorio é o jeito de cobrir qualquer caminho de
-- escrita (web, sincronização offline posterior) sem duplicar essa lógica
-- no client.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.notificar_mudanca_progresso_relatorio()
RETURNS trigger AS $$
DECLARE
  v_relatorio record;
  v_ator uuid := auth.uid();
  v_destinatario uuid;
BEGIN
  SELECT obra_nome, user_id INTO v_relatorio
  FROM public.engenharia_estrutura_fotografica
  WHERE id = NEW.relatorio_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- dono do relatório, se não foi ele quem mexeu
  IF v_relatorio.user_id IS NOT NULL AND v_relatorio.user_id IS DISTINCT FROM v_ator THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
    VALUES (
      v_relatorio.user_id,
      'relatorio_progresso_atualizado',
      'Relatório atualizado',
      COALESCE(v_relatorio.obra_nome, 'Um relatório') || ' foi atualizado por um colaborador',
      '/engenharia/relatorio-fotografico?relatorio=' || NEW.relatorio_id::text
    );
  END IF;

  -- demais colaboradores, exceto quem mexeu e exceto o próprio dono (evita
  -- notificação duplicada se o dono também constar como colaborador)
  FOR v_destinatario IN
    SELECT c.user_id
    FROM public.engenharia_relatorio_colaboradores c
    WHERE c.relatorio_id = NEW.relatorio_id
      AND c.user_id IS DISTINCT FROM v_ator
      AND c.user_id IS DISTINCT FROM v_relatorio.user_id
  LOOP
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
    VALUES (
      v_destinatario,
      'relatorio_progresso_atualizado',
      'Relatório atualizado',
      COALESCE(v_relatorio.obra_nome, 'Um relatório') || ' foi atualizado',
      '/engenharia/relatorio-fotografico?relatorio=' || NEW.relatorio_id::text
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notificar_progresso_insert ON public.engenharia_progresso_relatorio;
CREATE TRIGGER trg_notificar_progresso_insert
  AFTER INSERT ON public.engenharia_progresso_relatorio
  FOR EACH ROW EXECUTE FUNCTION public.notificar_mudanca_progresso_relatorio();

DROP TRIGGER IF EXISTS trg_notificar_progresso_update ON public.engenharia_progresso_relatorio;
CREATE TRIGGER trg_notificar_progresso_update
  AFTER UPDATE ON public.engenharia_progresso_relatorio
  FOR EACH ROW EXECUTE FUNCTION public.notificar_mudanca_progresso_relatorio();
