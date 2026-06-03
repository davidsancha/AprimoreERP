'use client';

import React from 'react';

interface ValorPremiumProps {
  valor: number;
  className?: string;
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  colorClass?: string;
}

export default function ValorPremium({ 
  valor, 
  className = '', 
  size = 'base',
  colorClass = ''
}: ValorPremiumProps) {
  // Trata valores nulos ou indefinidos
  const numeroValido = typeof valor === 'number' ? valor : 0;
  
  // Formata o número com 2 casas decimais e separador de milhar
  const formatado = numeroValido.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const partes = formatado.split(',');
  const inteiro = partes[0];
  const centavos = partes[1];

  const sizeClasses = {
    'xs': 'text-xs',
    'sm': 'text-sm',
    'base': 'text-base',
    'lg': 'text-lg font-bold',
    'xl': 'text-xl font-extrabold',
    '2xl': 'text-2xl font-black',
    '3xl': 'text-3xl font-black',
    '4xl': 'text-4xl font-black'
  };

  return (
    <span className={`inline-flex items-baseline font-bold ${sizeClasses[size]} ${colorClass} ${className} tracking-tight`}>
      <span className="text-[0.8em] font-semibold opacity-80 mr-0.5">R$</span>
      <span>{inteiro}</span>
      <span className="text-[0.7em] font-black opacity-75 ml-0.5">,{centavos}</span>
    </span>
  );
}
