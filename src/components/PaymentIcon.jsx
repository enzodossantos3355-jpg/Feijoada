import React from 'react';
import { CreditCard, QrCode, Banknote, Wallet } from 'lucide-react';

export const PAYMENT_META = {
  Pix: { label: 'Pix', icon: QrCode, color: 'bg-teal-50 text-teal-700 border-teal-200' },
  'Cartão Crédito': { label: 'Crédito', icon: CreditCard, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  'Cartão Débito': { label: 'Débito', icon: CreditCard, color: 'bg-sky-50 text-sky-700 border-sky-200' },
  Dinheiro: { label: 'Dinheiro', icon: Banknote, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Outro: { label: 'Outro', icon: Wallet, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  Pendente: { label: 'Pendente', icon: Wallet, color: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export function PaymentBadge({ method = 'Pix' }) {
  const meta = PAYMENT_META[method] || PAYMENT_META.Pix;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {meta.label}
    </span>
  );
}

export default function PaymentIcon({ method = 'Pix', className = 'w-4 h-4' }) {
  const meta = PAYMENT_META[method] || PAYMENT_META.Pix;
  const Icon = meta.icon;
  return <Icon className={className} />;
}
