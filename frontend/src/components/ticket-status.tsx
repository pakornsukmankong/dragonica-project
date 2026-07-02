'use client';

import { useTranslations } from 'next-intl';
import type { TicketStatus } from '@/types';

const STYLE: Record<TicketStatus, string> = {
  open: 'bg-gold-soft text-gold',
  in_progress: 'bg-[rgba(93,140,215,0.16)] text-[#8fb4f0]',
  resolved: 'bg-[rgba(74,222,128,0.14)] text-[var(--fg-success)]',
  closed: 'bg-raised text-muted',
};

const LABEL_KEY: Record<TicketStatus, string> = {
  open: 'statusOpen',
  in_progress: 'statusInProgress',
  resolved: 'statusResolved',
  closed: 'statusClosed',
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const t = useTranslations('tickets');
  return (
    <span
      className={`inline-block shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STYLE[status]}`}
    >
      {t(LABEL_KEY[status])}
    </span>
  );
}
