'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import FormProjeto from '@/modules/operacional/components/FormProjeto';
import { Loader2 } from 'lucide-react';

function EditarProjetoContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  if (!id) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-desc">
        <span className="text-sm font-semibold tracking-wider text-red-500 uppercase">
          Identificador da obra não fornecido.
        </span>
      </div>
    );
  }

  return <FormProjeto projetoId={id} />;
}

export default function EditarProjetoPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-40 gap-3 text-desc">
        <Loader2 className="animate-spin text-brand-ocre" size={40} />
        <span className="text-sm font-semibold tracking-wider uppercase">CARREGANDO FORMULÁRIO DE EDIÇÃO...</span>
      </div>
    }>
      <EditarProjetoContent />
    </Suspense>
  );
}
