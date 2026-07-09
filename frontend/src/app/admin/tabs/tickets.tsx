'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { useDateFormatter } from '@/lib/i18n';
import { Trash2, ChevronLeft, Send } from 'lucide-react';
import { Select } from '@/components/select';
import { TicketStatusBadge } from '@/components/ticket-status';
import { TicketThread } from '@/components/ticket-thread';
import type { Ticket, TicketStatus } from '@/types';

const TICKET_STATUSES: TicketStatus[] = [
  'open',
  'in_progress',
  'resolved',
  'closed',
];

export function TicketsTab() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const [statusFilter, setStatusFilter] = useState<'' | TicketStatus>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: tickets, isLoading } = useQuery<Ticket[]>({
    queryKey: ['admin', 'tickets', statusFilter],
    queryFn: () =>
      api.get(`/admin/tickets${statusFilter ? `?status=${statusFilter}` : ''}`),
  });

  if (selectedId) {
    return (
      <AdminTicketDetail id={selectedId} onBack={() => setSelectedId(null)} />
    );
  }

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex flex-wrap gap-1 rounded-base bg-raised p-1 w-fit">
        {(['', ...TICKET_STATUSES] as const).map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-surface text-foreground outline outline-1 outline-[rgba(255,255,255,0.08)]'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {s === '' ? t('ticketsFilterAll') : <TicketStatusLabel status={s} />}
          </button>
        ))}
      </div>

      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        {isLoading ? (
          <p className="text-xs text-muted">{tc('loading')}</p>
        ) : !tickets || tickets.length === 0 ? (
          <p className="text-xs text-muted">{t('ticketsNone')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 pr-3 text-xs font-medium text-muted">{t('ticketColSubject')}</th>
                  <th className="pb-3 pr-3 text-xs font-medium text-muted">{t('ticketColUser')}</th>
                  <th className="pb-3 pr-3 text-xs font-medium text-muted">{t('ticketColStatus')}</th>
                  <th className="pb-3 text-xs font-medium text-muted">{t('ticketColUpdated')}</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    onOpen={() => setSelectedId(ticket.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function TicketStatusLabel({ status }: { status: TicketStatus }) {
  const tt = useTranslations('tickets');
  const KEY: Record<TicketStatus, string> = {
    open: 'statusOpen',
    in_progress: 'statusInProgress',
    resolved: 'statusResolved',
    closed: 'statusClosed',
  };
  return <>{tt(KEY[status])}</>;
}

function TicketRow({ ticket, onOpen }: { ticket: Ticket; onOpen: () => void }) {
  const formatDate = useDateFormatter();
  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer border-b border-[rgba(255,255,255,0.05)] last:border-0 hover:bg-raised"
    >
      <td className="py-3 pr-3">
        <span className="text-sm font-medium text-foreground">{ticket.subject}</span>
      </td>
      <td className="py-3 pr-3 text-xs text-muted">
        {ticket.profiles?.username ?? '—'}
      </td>
      <td className="py-3 pr-3">
        <TicketStatusBadge status={ticket.status} />
      </td>
      <td className="py-3 text-xs text-muted">
        {formatDate(ticket.updated_at, { day: 'numeric', month: 'short', year: 'numeric' })}
      </td>
    </tr>
  );
}

function AdminTicketDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useTranslations('admin');
  const tt = useTranslations('tickets');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reply, setReply] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: ticket, isLoading } = useQuery<Ticket>({
    queryKey: ['admin', 'ticket', id],
    queryFn: () => api.get(`/admin/tickets/${id}`),
    refetchInterval: 15000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'ticket', id] });
    // Prefix match also refreshes the ['admin','tickets','unread'] badge.
    queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] });
  };

  // Opening a ticket marks it read on the server — refresh the admin badge.
  useEffect(() => {
    if (ticket?.id) {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] });
    }
  }, [ticket?.id, ticket?.updated_at, queryClient]);

  const replyMutation = useMutation({
    mutationFn: () => api.post(`/admin/tickets/${id}/messages`, { body: reply.trim() }),
    onSuccess: () => {
      invalidate();
      setReply('');
      toast({ title: t('toastTicketReplied'), variant: 'success' });
    },
    onError: (e) =>
      toast({ title: t('toastTicketReplyError'), description: (e as Error).message, variant: 'error' }),
  });

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) =>
      api.patch(`/admin/tickets/${id}/status`, { status }),
    onSuccess: () => {
      invalidate();
      toast({ title: t('toastTicketStatus'), variant: 'success' });
    },
    onError: (e) =>
      toast({ title: t('toastTicketStatusError'), description: (e as Error).message, variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/admin/tickets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] });
      setConfirmDelete(false);
      toast({ title: t('toastTicketDeleted'), variant: 'success' });
      onBack();
    },
    onError: (e) =>
      toast({ title: t('toastTicketDeleteError'), description: (e as Error).message, variant: 'error' }),
  });

  const STATUS_KEY: Record<TicketStatus, string> = {
    open: 'statusOpen',
    in_progress: 'statusInProgress',
    resolved: 'statusResolved',
    closed: 'statusClosed',
  };

  const canSend = reply.trim().length >= 1 && !replyMutation.isPending;

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t('ticketBack')}
      </button>

      {isLoading || !ticket ? (
        <p className="text-xs text-muted">{tc('loading')}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-medium text-foreground">{ticket.subject}</h3>
              <TicketStatusBadge status={ticket.status} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{t('ticketSetStatus')}</span>
              <div className="w-40">
                <Select
                  value={ticket.status}
                  onChange={(v) => statusMutation.mutate(v as TicketStatus)}
                  options={TICKET_STATUSES.map((s) => ({ value: s, label: tt(STATUS_KEY[s]) }))}
                />
              </div>
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-base p-2 text-muted transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--fg-danger)]"
                aria-label={t('ticketDelete')}
                title={t('ticketDelete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title={t('ticketDeleteTitle')}
            description={t('ticketDeleteDesc', { subject: ticket.subject })}
            confirmLabel={tc('delete')}
            danger
            loading={deleteMutation.isPending}
            onConfirm={() => deleteMutation.mutate()}
          />
          {ticket.profiles?.username && (
            <p className="text-xs text-muted">{t('ticketColUser')}: {ticket.profiles.username}</p>
          )}

          <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
            <TicketThread messages={ticket.ticket_messages ?? []} />
          </div>

          <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-5">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={5000}
              rows={3}
              placeholder={t('ticketReplyPlaceholder')}
              className="w-full resize-none rounded-base border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-[var(--focus)] mb-3"
            />
            <button
              onClick={() => replyMutation.mutate()}
              disabled={!canSend}
              className="flex items-center gap-1.5 rounded-base bg-[var(--blue)] px-5 py-2.5 text-sm font-medium text-[#1b1407] shadow-button transition-colors hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {replyMutation.isPending ? t('ticketSending') : t('ticketSend')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
