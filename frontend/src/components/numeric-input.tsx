'use client';

import { type InputHTMLAttributes } from 'react';

interface NumericInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  value: number | '';
  onValueChange: (value: number) => void;
}

export function NumericInput({ value, onValueChange, ...props }: NumericInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    onValueChange(raw ? Number(raw) : 0);
  };

  const displayValue = value === 0 || value === '' ? '' : value.toLocaleString();

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
    />
  );
}
