'use client';

import { useState } from 'react';
import { formatarBRL, parseBRL } from '@/shared/lib/money';

interface MoneyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

/**
 * Input de valor monetário com máscara BRL automática.
 *
 * Enquanto o usuário digita: aceita apenas dígitos e vírgula (sem pontos).
 * Ex: "850000,50"
 *
 * Ao sair do campo (blur): formata com separadores de milhar.
 * Ex: "850.000,50"
 *
 * O valor numérico correto é sempre passado para onChange.
 */
export default function MoneyInput({
  value,
  onChange,
  placeholder = '0,00',
  className = '',
  required = false,
  disabled = false,
  id,
}: MoneyInputProps) {
  const [focused, setFocused] = useState(false);
  const [rawInput, setRawInput] = useState('');

  const handleFocus = () => {
    // Ao focar: remove pontos de milhar para edição livre
    setRawInput(value > 0 ? formatarBRL(value).replace(/\./g, '') : '');
    setFocused(true);
  };

  const handleBlur = () => {
    setFocused(false);
    onChange(parseBRL(rawInput));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;

    // Permite apenas dígitos e vírgula
    val = val.replace(/[^\d,]/g, '');

    // Garante no máximo uma vírgula
    const partes = val.split(',');
    if (partes.length > 2) {
      val = partes[0] + ',' + partes.slice(1).join('');
    }

    // Limita a 2 casas decimais
    if (partes[1]?.length > 2) {
      val = partes[0] + ',' + partes[1].slice(0, 2);
    }

    setRawInput(val);
    onChange(parseBRL(val));
  };

  const displayValue = focused ? rawInput : (value > 0 ? formatarBRL(value) : '');

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={displayValue}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={className}
    />
  );
}
