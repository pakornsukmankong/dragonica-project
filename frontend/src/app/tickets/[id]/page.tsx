'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ChevronLeft, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { ImageUpload } from '@/components/image-upload';
import { TicketStatusBadge } from '@/components/ticket-status';
import { TicketThread } from '@/components/ticket-thread';
import type { Ticket } from '@/types';

export default function TicketDetailPage() {
  const t = useTranslations('tickets');
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [reply, setReply] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const { data: ticket, isLoading, isError } = useQuery<Ticket>({
    queryKey: ['ticket', id],
    queryFn: () => api.get(`/tickets/${id}`),
    // Poll so admin replies show up without a manual refresh.
    refetchInterval: 15000,
  });

  // Viewing marks the thread read on the server — refresh the nav badge.
  useEffect(() => {
    if (ticket?.id) {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'unread'] });
    }
  }, [ticket?.id, ticket?.updated_at, queryClient]);

  const replyMutation = useMutation({
    mutationFn: () =>
      api.post(`/tickets/${id}/messages`, {
        body: reply.trim(),
        imageUrl: imageUrl || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setReply('');
      setImageUrl('');
      toast({ title: t('toastReplied'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('toastReplyError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const canSend = reply.trim().length >= 1 && !replyMutation.isPending;

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
          <Link
            href="/tickets"
            className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('back')}
          </Link>

          {isLoading ? (
            <p className="text-sm text-muted">{t('loading')}</p>
          ) : isError || !ticket ? (
            <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-10 text-center">
              <p className="text-sm text-muted">{t('notFound')}</p>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-start justify-between gap-3">
                <h1 className="text-lg laptop:text-xl font-medium text-foreground">
                  {ticket.subject}
                </h1>
                <TicketStatusBadge status={ticket.status} />
              </div>

              <div className="mb-6 bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
                <TicketThread messages={ticket.ticket_messages ?? []} />
              </div>

              {/* Reply box — hidden once the ticket is closed */}
              {ticket.status === 'closed' ? (
                <div className="rounded-base border border-border bg-raised px-4 py-3 text-center text-xs text-muted">
                  {t('closedNotice')}
                </div>
              ) : (
              <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-5">
                <label className="block text-xs font-medium text-muted mb-2">
                  {t('reply')}
                </label>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  maxLength={5000}
                  rows={3}
                  placeholder={t('replyPlaceholder')}
                  className="w-full resize-none rounded-base border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-[var(--focus)] mb-3"
                />
                <div className="flex items-center justify-between gap-3">
                  <ImageUpload currentUrl={imageUrl || null} onUploaded={setImageUrl} />
                  <button
                    onClick={() => replyMutation.mutate()}
                    disabled={!canSend}
                    className="flex shrink-0 items-center gap-1.5 rounded-base bg-[var(--blue)] px-5 py-2.5 text-sm font-medium text-[#1b1407] shadow-button transition-colors hover:opacity-90 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {replyMutation.isPending ? t('sending') : t('send')}
                  </button>
                </div>
              </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
