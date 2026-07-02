'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { LifeBuoy, Plus, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { useDateFormatter } from '@/lib/i18n';
import { ImageUpload } from '@/components/image-upload';
import { TicketStatusBadge } from '@/components/ticket-status';
import type { Ticket } from '@/types';

export default function TicketsPage() {
  const t = useTranslations('tickets');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const formatDate = useDateFormatter();

  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const { data: tickets, isLoading } = useQuery<Ticket[]>({
    queryKey: ['tickets'],
    queryFn: () => api.get('/tickets'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<Ticket>('/tickets', {
        subject: subject.trim(),
        body: body.trim(),
        imageUrl: imageUrl || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setCreating(false);
      setSubject('');
      setBody('');
      setImageUrl('');
      toast({ title: t('toastCreated'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('toastCreateError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const canSubmit =
    subject.trim().length >= 3 && body.trim().length >= 1 && !createMutation.isPending;

  return (
    <main className="min-h-screen bg-root">
      <section className="relative overflow-hidden py-[60px] laptop:py-[90px]">
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: 'url(/texture.png)',
            backgroundRepeat: 'repeat',
            opacity: 0.05,
            mixBlendMode: 'multiply',
          }}
        />
        <div className="relative z-10 mx-auto max-w-[760px] px-4 sm:px-7">
          {/* Header */}
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-base bg-gold-soft text-gold shadow-gold">
                <LifeBuoy className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-xl laptop:text-2xl font-medium text-foreground">
                  {t('title')}
                </h1>
                <p className="text-sm text-muted mt-1">{t('subtitle')}</p>
              </div>
            </div>
            {!creating && (
              <button
                onClick={() => setCreating(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-base bg-[var(--blue)] px-4 py-2.5 text-sm font-medium text-[#1b1407] shadow-button transition-colors hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                {t('newTicket')}
              </button>
            )}
          </div>

          {/* New ticket form */}
          {creating && (
            <div className="mb-8 bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4">
                {t('createTitle')}
              </h2>
              <label className="block text-xs font-medium text-muted mb-2">
                {t('subject')}
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={150}
                placeholder={t('subjectPlaceholder')}
                className="w-full rounded-base border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-[var(--focus)] mb-4"
              />
              <label className="block text-xs font-medium text-muted mb-2">
                {t('message')}
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={5000}
                rows={5}
                placeholder={t('messagePlaceholder')}
                className="w-full resize-none rounded-base border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-[var(--focus)] mb-4"
              />
              <label className="block text-xs font-medium text-muted mb-2">
                {t('attachImage')}
              </label>
              <div className="mb-6">
                <ImageUpload currentUrl={imageUrl || null} onUploaded={setImageUrl} />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={!canSubmit}
                  className="rounded-base bg-[var(--blue)] px-5 py-2.5 text-sm font-medium text-[#1b1407] shadow-button transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {createMutation.isPending ? t('submitting') : t('submit')}
                </button>
                <button
                  onClick={() => setCreating(false)}
                  className="rounded-base border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-raised"
                >
                  {t('back')}
                </button>
              </div>
            </div>
          )}

          {/* Ticket list */}
          {isLoading ? (
            <p className="text-sm text-muted">{t('loading')}</p>
          ) : !tickets || tickets.length === 0 ? (
            <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-10 text-center">
              <p className="text-sm text-muted">{t('empty')}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="group flex items-center justify-between gap-3 rounded-base bg-surface outline outline-1 outline-[rgba(255,255,255,0.08)] p-4 transition-all hover:outline-[rgba(224,165,60,0.35)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {ticket.subject}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {formatDate(ticket.updated_at, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <TicketStatusBadge status={ticket.status} />
                      <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
