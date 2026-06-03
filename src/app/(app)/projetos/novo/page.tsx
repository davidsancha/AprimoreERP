import FormProjeto from '@/modules/operacional/components/FormProjeto';

export const metadata = {
  title: 'Nova Obra - Aprimore ERP',
  description: 'Cadastrar nova obra e definir o orçamento e cronograma financeiro.',
};

export default function NovoProjetoPage() {
  return (
    <div className="w-full">
      <FormProjeto />
    </div>
  );
}
