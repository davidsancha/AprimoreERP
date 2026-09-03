# Templates pendentes de upload — pasta de staging

Arquivos aqui são artefatos binários (modelos `.pptx`) que precisam
subir pro bucket `relatorios-fotograficos` do Supabase Storage, mas o
Claude Code não faz esse upload diretamente — quem sobe pro Supabase
(e sincroniza com o GitHub) é o Antigravity. Ver instruções exatas em
`_mensagens-agentes/PARA-ANTIGRAVITY.md` (ou no histórico de commits,
já que a mensagem é apagada depois de lida).

Depois que um arquivo daqui for confirmado no Storage e o
`storage_template_path` correspondente atualizado em
`engenharia_modelos_relatorio`, pode ser removido desta pasta.
