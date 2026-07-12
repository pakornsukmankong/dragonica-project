'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Check, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { useDateFormatter } from '@/lib/i18n';
import { Pagination } from '@/components/pagination';
import { Currency, CurrencyInput } from '@/components/currency';
import { Select } from '@/components/select';
import { ItemThumb } from '@/components/item-icon';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { formatGoldShort, toParts } from '@/lib/currency';
import type { Session, Character, Dungeon, Item } from '@/types';

const PAGE_SIZE = 10;

export default function SessionsPage() {
  const t = useTranslations('sessions');
  const tc = useTranslations('common');
  const formatDate = useDateFormatter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Filters
  const [filterCharId, setFilterCharId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'gold'>('date');
  const [page, setPage] = useState(1);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);

  // Local-timezone YYYY-MM-DD (en-CA yields ISO format), used to block picking
  // future dates in the date filter.
  const maxDate = new Date().toLocaleDateString('en-CA');

  // Per-session drop edit mode: pressing Edit makes every drop in that session
  // editable at once (qty/price), with a row to add a new one; Save commits all.
  const [editingDropsSessionId, setEditingDropsSessionId] = useState<
    string | null
  >(null);
  // Draft qty/price per drop id, live while in edit mode.
  const [dropDrafts, setDropDrafts] = useState<
    Record<string, { quantity: number; priceEach: number }>
  >({});
  // Draft for a new drop added within edit mode (committed on Save).
  const [newItemId, setNewItemId] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [newPrice, setNewPrice] = useState(0);

  const { data: sessions, isLoading } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions'),
  });

  const { data: characters } = useQuery<Character[]>({
    queryKey: ['characters'],
    queryFn: () => api.get('/characters'),
  });

  // Item catalog for the "add drop" picker.
  const { data: items } = useQuery<Item[]>({
    queryKey: ['game-data', 'items'],
    queryFn: () => api.get('/game-data/items'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: t('toastDeleted'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('toastDeleteError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => api.delete<{ deleted: number }>('/sessions'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setConfirmDeleteAll(false);
      setPage(1);
      toast({
        title: t('toastDeletedAll', { count: res.deleted }),
        variant: 'success',
      });
    },
    onError: (e) =>
      toast({
        title: t('toastDeleteAllError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const deleteDropMutation = useMutation({
    mutationFn: (dropId: string) => api.delete(`/sessions/drops/${dropId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: t('toastDropRemoved'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('toastDropRemoveError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  // Enter edit mode for a session: seed drafts from its current drops.
  const startEditDrops = (session: Session) => {
    const drafts: Record<string, { quantity: number; priceEach: number }> = {};
    for (const d of session.session_drops ?? []) {
      drafts[d.id] = { quantity: d.quantity, priceEach: d.price_each };
    }
    setDropDrafts(drafts);
    setNewItemId('');
    setNewQty(1);
    setNewPrice(0);
    setEditingDropsSessionId(session.id);
  };

  const cancelEditDrops = () => {
    setEditingDropsSessionId(null);
    setDropDrafts({});
    setNewItemId('');
  };

  const setDraftField = (
    dropId: string,
    field: 'quantity' | 'priceEach',
    value: number,
  ) =>
    setDropDrafts((prev) => ({
      ...prev,
      [dropId]: { ...prev[dropId], [field]: value },
    }));

  // Picking an item prefills its catalog price so the user rarely has to type it.
  const selectNewItem = (itemId: string) => {
    setNewItemId(itemId);
    const item = items?.find((i) => i.id === itemId);
    if (item) setNewPrice(item.default_price ?? 0);
  };

  // Save all drop edits for a session at once: PATCH each changed drop and POST
  // the new-item row if one was filled in.
  const saveDropsMutation = useMutation({
    mutationFn: async (session: Session) => {
      const ops: Promise<unknown>[] = [];
      for (const d of session.session_drops ?? []) {
        const draft = dropDrafts[d.id];
        if (
          draft &&
          (draft.quantity !== d.quantity || draft.priceEach !== d.price_each)
        ) {
          ops.push(
            api.patch(`/sessions/drops/${d.id}`, {
              quantity: draft.quantity,
              priceEach: draft.priceEach,
            }),
          );
        }
      }
      if (newItemId && newQty >= 1) {
        ops.push(
          api.post('/sessions/drops', {
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
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      cancelEditDrops();
      toast({ title: t('toastDropsSaved'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('toastDropsSaveError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  // Filter & sort logic
  const filteredSessions = useMemo(() => {
    let result = sessions ?? [];

    if (filterCharId) {
      result = result.filter((s) => s.character_id === filterCharId);
    }

    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      result = result.filter(
        (s) => s.started_at && new Date(s.started_at) >= from,
      );
    }

    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter(
        (s) => s.started_at && new Date(s.started_at) <= to,
      );
    }

    result = [...result].sort((a, b) => {
      if (sortBy === 'gold') return Number(b.gold_earned) - Number(a.gold_earned);
      return (
        new Date(b.started_at ?? b.created_at).getTime() -
        new Date(a.started_at ?? a.created_at).getTime()
      );
    });

    return result;
  }, [sessions, filterCharId, filterDateFrom, filterDateTo, sortBy]);

  // Pagination derived from the filtered list.
  const pageCount = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const pagedSessions = filteredSessions.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  // Reset to page 1 whenever filters/sort change the result set
  // (state adjusted during render — avoids an extra effect render pass).
  const filterKey = `${filterCharId}|${filterDateFrom}|${filterDateTo}|${sortBy}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  // Export to a real .xlsx file (SheetJS lazy-loaded only on click).
  const handleExportExcel = async () => {
    if (!filteredSessions.length) return;

    const XLSX = await import('xlsx');
    const rows = filteredSessions.map((s) => {
      const v = toParts(Number(s.gold_earned));
      return {
        Character: s.characters?.name ?? '',
        Date: s.started_at
          ? new Date(s.started_at).toISOString().split('T')[0]
          : '',
        'Duration (min)': s.duration_minutes ?? '',
        Gold: v.gold,
        Silver: v.silver,
        Copper: v.copper,
        'Gold Drop (copper)': Number(s.gold_dropped ?? 0),
        Dungeon: s.dungeons?.name ?? '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sessions');
    XLSX.writeFile(wb, `sessions_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-root flex items-center justify-center">
        <p className="text-sm text-muted">{t('loading')}</p>
      </div>
    );
  }

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
        <div className="relative z-10 mx-auto max-w-container px-4 sm:px-7">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl laptop:text-2xl font-medium text-foreground">
                {t('title')}
              </h1>
              <p className="text-sm text-muted mt-2">
                {t('subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                disabled={filteredSessions.length === 0}
                className="rounded-base px-4 py-2.5 text-sm font-medium text-foreground border border-border hover:bg-raised transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('exportExcel')}
              </button>
              {(sessions?.length ?? 0) > 0 && (
                <button
                  onClick={() => setConfirmDeleteAll(true)}
                  className="rounded-base px-4 py-2.5 text-sm font-medium text-[var(--fg-danger)] border border-[var(--border-danger)] hover:bg-[var(--danger-soft)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2"
                >
                  {t('deleteAll')}
                </button>
              )}
            </div>
          </div>

          {/* Delete-all confirmation */}
          <ConfirmDialog
            open={confirmDeleteAll}
            onOpenChange={setConfirmDeleteAll}
            title={t('deleteAllTitle')}
            description={t('deleteAllDesc', { count: sessions?.length ?? 0 })}
            confirmLabel={t('deleteAllConfirm')}
            danger
            loading={deleteAllMutation.isPending}
            onConfirm={() => deleteAllMutation.mutate()}
          />

          {/* Filters */}
          <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 laptop:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">{t('character')}</label>
                <Select
                  value={filterCharId}
                  onChange={setFilterCharId}
                  options={[
                    { value: '', label: t('allCharacters') },
                    ...(characters ?? []).map((c) => ({
                      value: c.id,
                      label: c.name,
                    })),
                  ]}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">{t('from')}</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  max={filterDateTo || maxDate}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">{t('to')}</label>
                <input
                  type="date"
                  value={filterDateTo}
                  min={filterDateFrom || undefined}
                  max={maxDate}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">{t('sortBy')}</label>
                <Select
                  value={sortBy}
                  onChange={(v) => setSortBy(v as 'date' | 'gold')}
                  options={[
                    { value: 'date', label: t('sortDate') },
                    { value: 'gold', label: t('sortGold') },
                  ]}
                />
              </div>
            </div>
            {(filterCharId || filterDateFrom || filterDateTo) && (
              <button
                onClick={() => {
                  setFilterCharId('');
                  setFilterDateFrom('');
                  setFilterDateTo('');
                }}
                className="mt-3 text-xs text-[var(--blue)] hover:underline"
              >
                {t('clearFilters')}
              </button>
            )}
          </div>

          {/* Results count */}
          <p className="text-xs text-muted mb-4">
            {t('showing', { count: filteredSessions.length })}
          </p>

          {editingSession && (
            <SessionEditForm
              key={editingSession.id}
              session={editingSession}
              characters={characters}
              onClose={() => setEditingSession(null)}
            />
          )}

          {filteredSessions.length === 0 ? (
            <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-10 text-center">
              <p className="text-sm text-muted">
                {t('empty')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {pagedSessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6 transition-all duration-200 hover:outline-[rgba(224,165,60,0.35)] hover:shadow-gold"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">
                        {session.characters?.name ?? t('unknownCharacter')}
                      </h3>
                      <p className="text-xs text-muted mt-1">
                        {session.dungeons && (
                          <span className="font-medium text-foreground/70">
                            {session.dungeons.name}
                            {' · '}
                          </span>
                        )}
                        {session.started_at
                          ? formatDate(session.started_at, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : t('noDate')}
                        {session.duration_minutes && (
                          <span> · {t('minutesShort', { count: session.duration_minutes })}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setEditingSession(session)}
                        className="rounded-base px-3 py-1.5 text-xs font-medium text-muted border border-border hover:text-gold hover:border-gold transition-colors duration-150 focus:outline-none"
                      >
                        {tc('edit')}
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(session.id)}
                        disabled={deleteMutation.isPending}
                        className="rounded-base px-3 py-1.5 text-xs font-medium text-[var(--fg-danger)] border border-[var(--border-danger)] hover:bg-[var(--danger-soft)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2 disabled:opacity-50"
                      >
                        {tc('delete')}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                    <div className="min-w-0">
                      <p className="text-xs text-muted">{t('value')}</p>
                      <Currency
                        copper={Number(session.gold_earned)}
                        className="!flex flex-wrap text-base"
                      />
                    </div>
                    {Number(session.gold_dropped) > 0 && (
                      <div>
                        <p className="text-xs text-muted">{t('goldDrop')}</p>
                        <div className="text-sm">
                          <Currency copper={Number(session.gold_dropped)} className="text-sm" />
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted">{t('duration')}</p>
                      <p className="text-sm font-medium text-foreground">
                        {session.duration_minutes
                          ? t('minutesShort', { count: session.duration_minutes })
                          : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Session note */}
                  {session.note && (
                    <div className="mt-4">
                      <p className="text-xs text-muted mb-1">{t('note')}</p>
                      <p className="rounded-sm bg-raised px-3 py-2 text-xs text-foreground/85 whitespace-pre-wrap">
                        {session.note}
                      </p>
                    </div>
                  )}

                  {/* Item Drops */}
                  <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.05)]">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs text-muted">{t('drops')}</p>
                      {editingDropsSessionId === session.id ? (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => saveDropsMutation.mutate(session)}
                            disabled={saveDropsMutation.isPending}
                            className="flex items-center gap-1 text-xs font-medium text-gold hover:opacity-80 disabled:opacity-40"
                          >
                            <Check className="h-3.5 w-3.5" />
                            {tc('save')}
                          </button>
                          <button
                            onClick={cancelEditDrops}
                            className="text-xs text-muted hover:text-foreground"
                          >
                            {tc('cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditDrops(session)}
                          className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-gold"
                        >
                          <Pencil className="h-3 w-3" />
                          {tc('edit')}
                        </button>
                      )}
                    </div>

                    {editingDropsSessionId === session.id ? (
                      // Edit mode: every drop editable at once + a row to add one.
                      <div className="flex flex-col gap-1.5">
                        {session.session_drops?.map((drop) => {
                          const draft = dropDrafts[drop.id] ?? {
                            quantity: drop.quantity,
                            priceEach: drop.price_each,
                          };
                          return (
                            <div
                              key={drop.id}
                              className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-sm bg-raised px-2 py-1.5"
                            >
                              <ItemThumb item={drop.items} />
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
                                onClick={() => deleteDropMutation.mutate(drop.id)}
                                disabled={deleteDropMutation.isPending}
                                className="text-muted hover:text-[var(--fg-danger)] disabled:opacity-50"
                                aria-label="Remove drop"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}

                        {/* Add a new drop (committed on Save) */}
                        <div className="flex flex-wrap items-center gap-1.5 rounded-sm bg-raised px-2 py-1.5 outline outline-1 outline-[rgba(224,165,60,0.25)]">
                          <div className="w-40">
                            <Select
                              value={newItemId}
                              onChange={selectNewItem}
                              placeholder={t('selectItem')}
                              options={(items ?? []).map((it) => ({
                                value: it.id,
                                label: it.name,
                                icon: <ItemThumb item={it} />,
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
                    ) : session.session_drops && session.session_drops.length > 0 ? (
                      // Read-only chips.
                      <div className="flex flex-wrap gap-2">
                        {session.session_drops.map((drop) => (
                          <div
                            key={drop.id}
                            className="flex items-center gap-1.5 bg-raised rounded-sm px-2 py-1"
                          >
                            <ItemThumb item={drop.items} />

                            <span className="text-xs text-foreground">
                              {drop.items?.name ?? t('unknownItem')}
                            </span>
                            <span className="text-xs text-muted">x{drop.quantity}</span>
                            {drop.price_each > 0 && (
                              <span className="text-xs text-muted">
                                ({formatGoldShort(drop.quantity * drop.price_each)})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted">{t('noDrops')}</p>
                    )}
                  </div>
                </div>
              ))}
              <Pagination page={page} pageCount={pageCount} onChange={setPage} />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function SessionEditForm({
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
  const [note, setNote] = useState(session.note ?? '');

  const { data: dungeons } = useQuery<Dungeon[]>({
    queryKey: ['game-data', 'dungeons'],
    queryFn: () => api.get('/game-data/dungeons'),
  });

  const updateMutation = useMutation({
    mutationFn: (body: {
      characterId: string;
      dungeonId?: string;
      goldEarned: number;
      goldDropped: number;
      durationMinutes?: number;
      note?: string;
    }) => api.patch(`/sessions/${session.id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
    <div className="bg-surface rounded-base outline outline-1 outline-[rgba(224,165,60,0.35)] p-6 mb-6">
      <h3 className="text-sm font-medium text-foreground mb-4">{t('editSession')}</h3>
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
            // Always sent (even '') so clearing the note actually clears it —
            // undefined would mean "leave unchanged" on the backend.
            note: note.trim(),
          });
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">{t('character')}</label>
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
            <label className="text-xs font-medium text-muted">{t('dungeon')}</label>
            <Select
              value={dungeonId}
              onChange={setDungeonId}
              options={[
                { value: '', label: tc('none') },
                ...(dungeons ?? []).map((d) => ({
                  value: d.id,
                  label: d.name,
                })),
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">{t('totalValue')}</label>
            <CurrencyInput value={gold} onChange={setGold} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">{t('goldDrop')}</label>
            <CurrencyInput value={goldDrop} onChange={setGoldDrop} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">{t('durationMin')}</label>
            <input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)]"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="edit-session-note" className="text-xs font-medium text-muted">{t('note')}</label>
            <textarea
              id="edit-session-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={1}
              className="w-full resize-y rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)]"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded-base px-4 py-2 text-sm font-medium text-[#1b1407] bg-[var(--blue)] shadow-button transition-colors duration-150 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2 disabled:opacity-50"
          >
            {updateMutation.isPending ? tc('saving') : tc('save')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-base px-4 py-2 text-sm font-medium text-foreground border border-border hover:bg-raised transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2"
          >
            {tc('cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
