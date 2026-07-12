'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Pagination } from '@/components/pagination';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { useDateFormatter } from '@/lib/i18n';
import { Trash2, Check, X, Eye, EyeOff, Pencil } from 'lucide-react';
import type { Donation } from '@/types';
import { ITEMS_PER_PAGE } from './shared';

const bahtFromSatang = (s: number) => `฿${(s / 100).toLocaleString('en-US')}`;

const STATUS_STYLE: Record<Donation['status'], string> = {
  successful: 'bg-[var(--success-soft,rgba(74,222,128,0.12))] text-[var(--fg-success)]',
  pending: 'bg-gold-soft text-gold',
  failed: 'bg-[var(--danger-soft)] text-[var(--fg-danger)]',
  expired: 'bg-raised text-muted',
};

const CHANNEL_LABEL: Record<Donation['channel'], string> = {
  promptpay: 'PromptPay',
  truemoney: 'TrueMoney',
  rabbit_linepay: 'Rabbit LINE Pay',
  shopeepay: 'ShopeePay',
  grabpay: 'GrabPay',
  mobile_banking_scb: 'SCB',
  mobile_banking_kbank: 'KBank',
  mobile_banking_bay: 'Krungsri',
  mobile_banking_bbl: 'Bangkok Bank',
  mobile_banking_ktb: 'Krung Thai',
  card: 'Card',
};

export function DonationsTab() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<Donation | null>(null);
  // Row currently in edit mode, with its draft name/message.
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    message: string;
  } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<Donation | null>(null);
  const [pendingReject, setPendingReject] = useState<Donation | null>(null);
  const formatDate = useDateFormatter();
  const statusText = (s: Donation['status']) =>
    t(`status${s.charAt(0).toUpperCase()}${s.slice(1)}`);

  const { data: donations, isLoading } = useQuery<Donation[]>({
    queryKey: ['admin', 'donations'],
    queryFn: () => api.get('/donations/admin/all'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/donations/admin/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'donations'] });
      queryClient.invalidateQueries({ queryKey: ['donations', 'wall'] });
      setPendingDelete(null);
      toast({ title: t('toastDonationDeleted'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('toastDonationDeleteError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  // Edit a donation's display name / message (both shown on the public wall).
  const editMutation = useMutation({
    mutationFn: ({ id, name, message }: { id: string; name: string; message: string }) =>
      api.patch(`/donations/admin/${id}`, { displayName: name, message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'donations'] });
      queryClient.invalidateQueries({ queryKey: ['donations', 'wall'] });
      setEditing(null);
      toast({ title: t('toastDonationUpdated'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('toastDonationUpdateError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  // Show or hide a donation's amount on the public wall.
  const visibilityMutation = useMutation({
    mutationFn: ({ id, hideAmount }: { id: string; hideAmount: boolean }) =>
      api.patch(`/donations/admin/${id}/visibility`, { hideAmount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'donations'] });
      queryClient.invalidateQueries({ queryKey: ['donations', 'wall'] });
    },
    onError: (e) =>
      toast({
        title: t('toastVisibilityError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  // Settle a manual (gateway-free) donation after checking the bank transfer.
  const settleMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'confirm' | 'reject' }) =>
      api.post(`/donations/admin/${id}/${action}`, {}),
    onSuccess: (_data, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'donations'] });
      queryClient.invalidateQueries({ queryKey: ['donations', 'wall'] });
      setPendingConfirm(null);
      setPendingReject(null);
      toast({
        title:
          action === 'confirm'
            ? t('toastDonationConfirmed')
            : t('toastDonationRejected'),
        variant: 'success',
      });
    },
    onError: (e) =>
      toast({
        title: t('toastDonationSettleError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const list = donations ?? [];
  const totalRaised = list
    .filter((d) => d.status === 'successful')
    .reduce((sum, d) => sum + d.amount, 0);
  const successCount = list.filter((d) => d.status === 'successful').length;

  const pageCount = Math.max(1, Math.ceil(list.length / ITEMS_PER_PAGE));
  const paged = list.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted mb-2">{t('donationsTotalRaised')}</p>
          <p className="text-2xl font-bold text-gold tabular-nums">{bahtFromSatang(totalRaised)}</p>
        </div>
        <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted mb-2">{t('donationsSuccessful')}</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{successCount}</p>
        </div>
        <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted mb-2">{t('donationsTotalRecords')}</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{list.length}</p>
        </div>
      </div>

      {/* Ledger */}
      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        {isLoading ? (
          <p className="text-xs text-muted">Loading...</p>
        ) : list.length === 0 ? (
          <p className="text-xs text-muted">{t('donationsNoRecords')}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 pr-6 text-[11px] font-medium uppercase tracking-wider text-muted">{t('colDonor')}</th>
                    <th className="pb-3 pr-6 text-[11px] font-medium uppercase tracking-wider text-muted">{t('colMethod')}</th>
                    <th className="pb-3 pr-6 text-right text-[11px] font-medium uppercase tracking-wider text-muted">{t('colAmount')}</th>
                    <th className="pb-3 pr-6 text-[11px] font-medium uppercase tracking-wider text-muted">{t('colStatus')}</th>
                    <th className="pb-3 pr-6 text-[11px] font-medium uppercase tracking-wider text-muted">{t('colDate')}</th>
                    <th className="pb-3 text-right text-[11px] font-medium uppercase tracking-wider text-muted"></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-[rgba(255,255,255,0.05)] align-middle transition-colors last:border-0 hover:bg-[rgba(255,255,255,0.02)]"
                    >
                      <td className="py-4 pr-6">
                        {editing?.id === d.id ? (
                          <div className="flex flex-col gap-1.5">
                            <input
                              value={editing.name}
                              onChange={(e) =>
                                setEditing({ ...editing, name: e.target.value })
                              }
                              maxLength={60}
                              placeholder={t('colDonor')}
                              className="w-full max-w-[240px] rounded-base border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-[var(--focus)]"
                            />
                            <input
                              value={editing.message}
                              onChange={(e) =>
                                setEditing({ ...editing, message: e.target.value })
                              }
                              maxLength={200}
                              placeholder={t('editMessagePlaceholder')}
                              className="w-full max-w-[240px] rounded-base border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-[var(--focus)]"
                            />
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-foreground">{d.display_name}</p>
                            {d.message && (
                              <p className="max-w-[240px] truncate text-xs text-muted" title={d.message}>
                                {d.message}
                              </p>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-4 pr-6 text-xs text-muted whitespace-nowrap">{CHANNEL_LABEL[d.channel]}</td>
                      <td className="py-4 pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={`text-sm font-semibold tabular-nums ${
                              d.hide_amount ? 'text-muted line-through' : 'text-foreground'
                            }`}
                          >
                            {bahtFromSatang(d.amount)}
                          </span>
                          <button
                            onClick={() =>
                              visibilityMutation.mutate({
                                id: d.id,
                                hideAmount: !d.hide_amount,
                              })
                            }
                            disabled={visibilityMutation.isPending}
                            className="rounded-base p-1 text-muted transition-colors hover:text-foreground hover:bg-raised disabled:opacity-50"
                            aria-label={
                              d.hide_amount
                                ? t('amountHiddenTitle')
                                : t('amountShownTitle')
                            }
                            title={
                              d.hide_amount
                                ? t('amountHiddenTitle')
                                : t('amountShownTitle')
                            }
                          >
                            {d.hide_amount ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-4 pr-6">
                        <span
                          className={`inline-block rounded-sm px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[d.status]}`}
                        >
                          {statusText(d.status)}
                        </span>
                      </td>
                      <td className="py-4 pr-6 text-xs text-muted whitespace-nowrap">
                        {formatDate(d.created_at, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {editing?.id === d.id ? (
                            <>
                              <button
                                onClick={() => editMutation.mutate(editing)}
                                disabled={editMutation.isPending}
                                className="rounded-base p-1.5 text-muted transition-colors hover:text-[var(--fg-success)] hover:bg-[var(--success-soft,rgba(74,222,128,0.12))] disabled:opacity-50"
                                aria-label={`Save donation from ${d.display_name}`}
                                title={tc('save')}
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditing(null)}
                                disabled={editMutation.isPending}
                                className="rounded-base p-1.5 text-muted transition-colors hover:text-foreground hover:bg-raised disabled:opacity-50"
                                aria-label="Cancel edit"
                                title={tc('cancel')}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() =>
                                setEditing({
                                  id: d.id,
                                  name: d.display_name,
                                  message: d.message ?? '',
                                })
                              }
                              className="rounded-base p-1.5 text-muted transition-colors hover:text-foreground hover:bg-raised"
                              aria-label={`Edit donation from ${d.display_name}`}
                              title={t('editDonation')}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {d.status === 'pending' && d.provider === 'manual' && (
                            <>
                              <button
                                onClick={() => setPendingConfirm(d)}
                                className="rounded-base p-1.5 text-muted transition-colors hover:text-[var(--fg-success)] hover:bg-[var(--success-soft,rgba(74,222,128,0.12))]"
                                aria-label={`Confirm donation from ${d.display_name}`}
                                title={t('confirmDonation')}
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setPendingReject(d)}
                                className="rounded-base p-1.5 text-muted transition-colors hover:text-[var(--fg-danger)] hover:bg-[var(--danger-soft)]"
                                aria-label={`Reject donation from ${d.display_name}`}
                                title={t('rejectDonation')}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setPendingDelete(d)}
                            className="rounded-base p-1.5 text-muted transition-colors hover:text-[var(--fg-danger)] hover:bg-[var(--danger-soft)]"
                            aria-label={`Delete donation from ${d.display_name}`}
                            title="Delete donation"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('deleteDonationTitle')}
        description={
          pendingDelete
            ? t('deleteDonationDesc', {
                amount: bahtFromSatang(pendingDelete.amount),
                name: pendingDelete.display_name,
              })
            : undefined
        }
        confirmLabel={tc('delete')}
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />

      <ConfirmDialog
        open={!!pendingConfirm}
        onOpenChange={(open) => !open && setPendingConfirm(null)}
        title={t('confirmDonationTitle')}
        description={
          pendingConfirm
            ? t('confirmDonationDesc', {
                amount: bahtFromSatang(pendingConfirm.amount),
                name: pendingConfirm.display_name,
              })
            : undefined
        }
        confirmLabel={t('confirmDonation')}
        loading={settleMutation.isPending}
        onConfirm={() =>
          pendingConfirm &&
          settleMutation.mutate({ id: pendingConfirm.id, action: 'confirm' })
        }
      />

      <ConfirmDialog
        open={!!pendingReject}
        onOpenChange={(open) => !open && setPendingReject(null)}
        title={t('rejectDonationTitle')}
        description={
          pendingReject
            ? t('rejectDonationDesc', {
                amount: bahtFromSatang(pendingReject.amount),
                name: pendingReject.display_name,
              })
            : undefined
        }
        confirmLabel={t('rejectDonation')}
        danger
        loading={settleMutation.isPending}
        onConfirm={() =>
          pendingReject &&
          settleMutation.mutate({ id: pendingReject.id, action: 'reject' })
        }
      />
    </div>
  );
}
