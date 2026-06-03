import GestaoPagamentosParceiros from '@/modules/rh/components/GestaoPagamentosParceiros';

export const metadata = {
  title: 'Lançamento de Diárias | Aprimore ERP',
  description: 'Lançamento de diárias e empreitadas de parceiros.',
};

export default function PagamentosParceirosPage() {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto animate-in fade-in duration-500">
      <GestaoPagamentosParceiros />
    </div>
  );
}
