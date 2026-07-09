'use client';

import { Fragment, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Pagination } from '@/components/pagination';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { useDateFormatter } from '@/lib/i18n';
import { Trash2, ChevronDown, Pencil } from 'lucide-react';
import { Currency, CurrencyInput } from '@/components/currency';
import { Select } from '@/components/select';
import type { AdminUser, Session, Character, Dungeon, Item } from '@/types';
import { ITEMS_PER_PAGE } from './shared';

export function UsersTab() {
  const t = useTranslations('admin');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const formatDate = useDateFormatter();

  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get('/admin/users'),
  });

  const list = users ?? [];
  const pageCount = Math.max(1, Math.ceil(list.length / ITEMS_PER_PAGE));
  const paged = list.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted mb-2">
            {t('usersTotal')}
          </p>
          <p className="text-2xl font-bold text-gold tabular-nums">
            {list.length}
          </p>
        </div>
        <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted mb-2">
            {t('usersTotalSessions')}
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {list.reduce((s, u) => s + u.sessionCount, 0)}
          </p>
        </div>
      </div>

      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        {isLoading ? (
          <p className="text-xs text-muted">Loading...</p>
        ) : list.length === 0 ? (
          <p className="text-xs text-muted">{t('usersNone')}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t('colUser')}
                    </th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t('colRole')}
                    </th>
                    <th className="pb-3 pr-3 text-right text-xs font-medium text-muted">
                      {t('colSessions')}
                    </th>
                    <th className="pb-3 pr-3 text-right text-xs font-medium text-muted">
                      {t('colTotalGold')}
                    </th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t('colJoined')}
                    </th>
                    <th className="pb-3 text-right text-xs font-medium text-muted"></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((u) => {
                    const expanded = expandedId === u.id;
                    return (
                      <Fragment key={u.id}>
                        <tr className="border-b border-[rgba(255,255,255,0.05)] align-top">
                          <td className="py-3 pr-3">
                            <p className="text-sm font-medium text-foreground">
                              {u.username || t('userNoName')}
                            </p>
                            {u.email && (
                              <p
                                className="max-w-[220px] truncate text-xs text-muted"
                                title={u.email}
                              >
                                {u.email}
                              </p>
                            )}
                          </td>
                          <td className="py-3 pr-3">
                            <span
                              className={`inline-block rounded-sm px-2 py-0.5 text-[11px] font-medium ${
                                u.role === 'admin'
                                  ? 'bg-gold-soft text-gold'
                                  : 'bg-raised text-muted'
                              }`}
                            >
                              {u.role === 'admin' ? t('roleAdmin') : t('roleUser')}
                            </span>
                          </td>
                          <td className="py-3 pr-3 text-right text-sm text-foreground tabular-nums">
                            {u.sessionCount}
                          </td>
                          <td className="py-3 pr-3 text-right text-sm">
                            <Currency copper={u.totalGold} />
                          </td>
                          <td className="py-3 pr-3 text-xs text-muted">
                            {formatDate(u.createdAt, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() =>
                                setExpandedId(expanded ? null : u.id)
                              }
                              className="inline-flex items-center gap-1 rounded-base border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground"
                            >
                              {t('viewSessions')}
                              <ChevronDown
                                className={`h-3.5 w-3.5 transition-transform ${
                                  expanded ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr>
                            <td colSpan={6} className="pb-4">
                              <AdminUserSessions userId={u.id} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

function AdminUserSessions({ userId }: { userId: string }) {
  const t = useTranslations('admin');
  const ts = useTranslations('sessions');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const formatDate = useDateFormatter();
  const [editing, setEditing] = useState<Session | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Session | null>(null);

  const { data: sessions, isLoading } = useQuery<Session[]>({
    queryKey: ['admin', 'user-sessions', userId],
    queryFn: () => api.get(`/admin/users/${userId}/sessions`),
  });
  const { data: characters } = useQuery<Character[]>({
    queryKey: ['admin', 'user-characters', userId],
    queryFn: () => api.get(`/admin/users/${userId}/characters`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'user-sessions', userId],
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setPendingDelete(null);
      toast({ title: t('sessionDeleted'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('sessionDeleteError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const list = sessions ?? [];

  return (
    <div className="rounded-base bg-raised p-4">
      {isLoading ? (
        <p className="text-xs text-muted">Loading...</p>
      ) : list.length === 0 ? (
        <p className="text-xs text-muted">{t('userNoSessions')}</p>
      ) : (
        <div className="space-y-2">
          {list.map((s) =>
            editing?.id === s.id ? (
              <AdminSessionEditForm
                key={s.id}
                session={s}
                characters={characters}
                onClose={() => setEditing(null)}
              />
            ) : (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-base bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {s.dungeons?.name ?? '—'} · {s.characters?.name}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(s.created_at, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {s.duration_minutes
                      ? ` · ${ts('minutesShort', { count: s.duration_minutes })}`
                      : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Currency copper={Number(s.gold_earned)} />
                  <button
                    onClick={() => setEditing(s)}
                    className="rounded-base p-1.5 text-muted transition-colors hover:text-gold"
                    title={tc('edit')}
                    aria-label={tc('edit')}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPendingDelete(s)}
                    className="rounded-base p-1.5 text-muted transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--fg-danger)]"
                    title={tc('delete')}
                    aria-label={tc('delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('deleteSessionTitle')}
        description={t('deleteSessionDesc')}
        confirmLabel={tc('delete')}
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </div>
  );
}

function AdminSessionEditForm({
  session,
  characters,
  onClose,
}: {
  session: Session;
  characters?: Character[];
  onClose: () => void;
}) {
  const t = useTranslations('sessions');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [characterId, setCharacterId] = useState(session.character_id);
  const [dungeonId, setDungeonId] = useState(session.dungeon_id ?? '');
  const [gold, setGold] = useState(Number(session.gold_earned));
  const [goldDrop, setGoldDrop] = useState(Number(session.gold_dropped ?? 0));
  const [duration, setDuration] = useState(session.duration_minutes ?? 0);

  // Drop edits are staged locally and committed atomically on Save alongside
  // the session fields: qty/price drafts, drops flagged for deletion, and one
  // optional new drop.
  const [dropDrafts, setDropDrafts] = useState<
    Record<string, { quantity: number; priceEach: number }>
  >(() => {
    const drafts: Record<string, { quantity: number; priceEach: number }> = {};
    for (const d of session.session_drops ?? []) {
      drafts[d.id] = { quantity: d.quantity, priceEach: d.price_each };
    }
    return drafts;
  });
  const [deletedDropIds, setDeletedDropIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [newItemId, setNewItemId] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [newPrice, setNewPrice] = useState(0);

  const { data: dungeons } = useQuery<Dungeon[]>({
    queryKey: ['game-data', 'dungeons'],
    queryFn: () => api.get('/game-data/dungeons'),
  });
  const { data: items } = useQuery<Item[]>({
    queryKey: ['game-data', 'items'],
    queryFn: () => api.get('/game-data/items'),
  });

  const setDraftField = (
    dropId: string,
    field: 'quantity' | 'priceEach',
    value: number,
  ) =>
    setDropDrafts((prev) => ({
      ...prev,
      [dropId]: { ...prev[dropId], [field]: value },
    }));

  // Picking an item prefills its catalog price so it rarely has to be typed.
  const selectNewItem = (itemId: string) => {
    setNewItemId(itemId);
    const item = items?.find((i) => i.id === itemId);
    if (item) setNewPrice(item.default_price ?? 0);
  };

  const updateMutation = useMutation({
    mutationFn: async (body: {
      characterId: string;
      dungeonId?: string;
      goldEarned: number;
      goldDropped: number;
      durationMinutes?: number;
    }) => {
      const ops: Promise<unknown>[] = [
        api.patch(`/admin/sessions/${session.id}`, body),
      ];
      for (const d of session.session_drops ?? []) {
        if (deletedDropIds.has(d.id)) {
          ops.push(api.delete(`/admin/sessions/drops/${d.id}`));
          continue;
        }
        const draft = dropDrafts[d.id];
        if (
          draft &&
          (draft.quantity !== d.quantity || draft.priceEach !== d.price_each)
        ) {
          ops.push(
            api.patch(`/admin/sessions/drops/${d.id}`, {
              quantity: draft.quantity,
              priceEach: draft.priceEach,
            }),
          );
        }
      }
      if (newItemId && newQty >= 1) {
        ops.push(
          api.post('/admin/sessions/drops', {
            sessionId: session.id,
            itemId: newItemId,
            quantity: newQty,
            priceEach: newPrice,
          }),
        );
      }
      await Promise.all(ops);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'user-sessions', session.user_id],
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast({ title: t('toastUpdated'), variant: 'success' });
      onClose();
    },
    onError: (e) =>
      toast({
        title: t('toastUpdateError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  return (
    <div className="rounded-base bg-surface p-5 outline outline-1 outline-[rgba(224,165,60,0.35)]">
      <h4 className="mb-4 text-sm font-medium text-foreground">
        {t('editSession')}
      </h4>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!characterId) return;
          updateMutation.mutate({
            characterId,
            dungeonId: dungeonId || undefined,
            goldEarned: gold,
            goldDropped: goldDrop,
            durationMinutes: duration || undefined,
          });
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">
              {t('character')}
            </label>
            <Select
              value={characterId}
              onChange={setCharacterId}
              placeholder={t('character')}
              options={(characters ?? []).map((c) => ({
                value: c.id,
                label: c.name,
              }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">
              {t('dungeon')}
            </label>
            <Select
              value={dungeonId}
              onChange={setDungeonId}
              options={[
                { value: '', label: tc('none') },
                ...(dungeons ?? []).map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">
              {t('totalValue')}
            </label>
            <CurrencyInput value={gold} onChange={setGold} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">
              {t('goldDrop')}
            </label>
            <CurrencyInput value={goldDrop} onChange={setGoldDrop} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">
              {t('durationMin')}
            </label>
            <input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)]"
            />
          </div>
        </div>

        {/* Item drops — staged locally, committed with the session on Save. */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">{t('drops')}</label>
          <div className="flex flex-col gap-1.5">
            {(session.session_drops ?? [])
              .filter((drop) => !deletedDropIds.has(drop.id))
              .map((drop) => {
                const draft = dropDrafts[drop.id] ?? {
                  quantity: drop.quantity,
                  priceEach: drop.price_each,
                };
                return (
                  <div
                    key={drop.id}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-sm bg-raised px-2 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                      {drop.items?.name ?? t('unknownItem')}
                    </span>
                    <span className="text-[10px] text-muted">x</span>
                    <input
                      type="number"
                      min={1}
                      value={draft.quantity}
                      onChange={(e) =>
                        setDraftField(drop.id, 'quantity', Number(e.target.value))
                      }
                      className="w-12 rounded-xs border border-border bg-surface px-1 py-1 text-xs text-foreground outline-none focus:border-[var(--focus)]"
                      aria-label="Quantity"
                    />
                    <CurrencyInput
                      value={draft.priceEach}
                      onChange={(c) => setDraftField(drop.id, 'priceEach', c)}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDeletedDropIds((prev) =>
                          new Set(prev).add(drop.id),
                        )
                      }
                      className="text-muted hover:text-[var(--fg-danger)]"
                      aria-label={tc('delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}

            {/* Add a new drop (committed on Save). */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-sm bg-raised px-2 py-1.5 outline outline-1 outline-[rgba(224,165,60,0.25)]">
              <div className="w-40">
                <Select
                  value={newItemId}
                  onChange={selectNewItem}
                  placeholder={t('selectItem')}
                  options={(items ?? []).map((it) => ({
                    value: it.id,
                    label: it.name,
                    icon: it.icon_url,
                  }))}
                />
              </div>
              <span className="text-[10px] text-muted">x</span>
              <input
                type="number"
                min={1}
                value={newQty}
                onChange={(e) => setNewQty(Number(e.target.value))}
                className="w-12 rounded-xs border border-border bg-surface px-1 py-1 text-xs text-foreground outline-none focus:border-[var(--focus)]"
                aria-label="Quantity"
              />
              <CurrencyInput value={newPrice} onChange={setNewPrice} />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded-base bg-[var(--blue)] px-4 py-2 text-sm font-medium text-[#1b1407] shadow-button transition-colors duration-150 hover:opacity-90 disabled:opacity-50"
          >
            {updateMutation.isPending ? tc('saving') : tc('save')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-base border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-raised"
          >
            {tc('cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
