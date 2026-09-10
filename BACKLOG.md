# Backlog técnico

Itens identificados mas conscientemente adiados — não implementar sem
alinhar com o David antes, já que envolvem escopo maior ou trade-offs que
vale decidir com calma.

## Compartilhamento (Cowork) para Projetos

Levar o modelo de papéis leitor/editor/admin já usado no relatório
fotográfico (`engenharia_relatorio_colaboradores`,
`is_internal_staff()`/`pode_editar_relatorio()` em
`supabase/migrations/00014_parceiro_egf_cowork_rls.sql`) para `projetos`,
permitindo compartilhar visibilidade financeira de uma obra com alguém de
fora do staff interno sem depender de acesso irrestrito.

**Por que adiado:** é uma tabela + RPC + RLS novas mexendo no mesmo
território sensível que a migration `00028_seguranca_financeira_projetos.sql`
acabou de travar — melhor deixar a RLS nova rodar em produção um tempo
antes de estender o modelo de acesso de novo.

**Quando revisitar:** se surgir um caso real de precisar compartilhar um
projeto com alguém fora do staff (ex.: um investidor, um cliente
acompanhando a obra).

## Soft-delete / arquivamento de projeto

Hoje excluir um projeto é `DELETE` físico com `ON DELETE CASCADE` em
custos, orçamento e recebimentos (mitigado parcialmente: a tela agora
mostra quantos custos/parcelas somem junto antes de confirmar — ver
`src/app/(app)/projetos/page.tsx::rotuloImpactoExclusao`). Um
soft-delete de verdade (coluna `arquivado_em` + filtro em todas as
queries) removeria o risco de perda de histórico contábil por engano, mas
exige tocar em todo lugar que lê `projetos` (custos, financeiro,
controladoria, recebimentos, relatório fotográfico) para não vazar
projeto "excluído" em nenhuma tela — escopo grande o suficiente pra
merecer sua própria sessão dedicada.

**Quando revisitar:** se acontecer uma exclusão por engano de verdade, ou
antes de qualquer auditoria contábil externa.
