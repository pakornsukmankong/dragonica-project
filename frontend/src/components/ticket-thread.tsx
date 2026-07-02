'use client';

import { useTranslations } from 'next-intl';
import { useDateFormatter } from '@/lib/i18n';
import type { TicketMessage } from '@/types';

/**
 * Renders a ticket's conversation as chat bubbles. Admin/support messages sit
 * on the left, user messages on the right (mirrored regardless of who is
 * viewing, driven purely by `is_admin`).
 */
export function TicketThread({ messages }: { messages: TicketMessage[] }) {
  const t = useTranslations('tickets');
  const formatDate = useDateFormatter();

  return (
    <div className="flex flex-col gap-4">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`flex flex-col gap-1 ${m.is_admin ? 'items-start' : 'items-end'}`}
        >
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <span className={m.is_admin ? 'text-gold' : 'text-foreground'}>
              {m.is_admin ? t('supportTeam') : t('you')}
            </span>
            <span>
              {formatDate(m.created_at, {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <div
            className={`max-w-[85%] rounded-base px-4 py-2.5 text-sm ${
              m.is_admin
                ? 'bg-raised text-foreground outline outline-1 outline-[rgba(224,165,60,0.25)]'
                : 'bg-surface text-foreground outline outline-1 outline-[rgba(255,255,255,0.08)]'
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
            {m.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.image_url}
                alt=""
                className="mt-2 max-h-64 rounded-sm outline outline-1 outline-[rgba(255,255,255,0.08)]"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
