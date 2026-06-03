import FormParceiro from '@/modules/rh/components/FormParceiro';

export const metadata = {
  title: 'Novo Parceiro | Aprimore ERP',
  description: 'Cadastro de parceiros prestadores de serviço.',
};

export default function NovoParceiroPage() {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto animate-in fade-in duration-500">
      <FormParceiro />
    </div>
  );
}
