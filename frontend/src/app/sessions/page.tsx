'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { X, Pencil, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { Pagination } from '@/components/pagination';
import { Currency, CurrencyInput } from '@/components/currency';
import { Select } from '@/components/select';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { formatGoldShort, toParts } from '@/lib/currency';
import type { Session, Character, Dungeon } from '@/types';

const PAGE_SIZE = 10;

export default function SessionsPage() {
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

  // Inline drop editing
  const [editingDropId, setEditingDropId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [editPrice, setEditPrice] = useState(0);

  const { data: sessions, isLoading } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions'),
  });

  const { data: characters } = useQuery<Character[]>({
    queryKey: ['characters'],
    queryFn: () => api.get('/characters'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Session deleted', variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: 'Could not delete session',
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
        title: `Deleted ${res.deleted} session${res.deleted === 1 ? '' : 's'}`,
        variant: 'success',
      });
    },
    onError: (e) =>
      toast({
        title: 'Could not delete sessions',
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const deleteDropMutation = useMutation({
    mutationFn: (dropId: string) => api.delete(`/sessions/drops/${dropId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Drop removed', variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: 'Could not remove drop',
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const updateDropMutation = useMutation({
    mutationFn: (vars: { dropId: string; quantity: number; priceEach: number }) =>
      api.patch(`/sessions/drops/${vars.dropId}`, {
        quantity: vars.quantity,
        priceEach: vars.priceEach,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setEditingDropId(null);
      toast({ title: 'Drop updated', variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: 'Could not update drop',
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const startEditDrop = (dropId: string, quantity: number, priceEach: number) => {
    setEditingDropId(dropId);
    setEditQty(quantity);
    setEditPrice(priceEach);
  };

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

  // Reset to page 1 whenever filters/sort change the result set.
  useEffect(() => {
    setPage(1);
  }, [filterCharId, filterDateFrom, filterDateTo, sortBy]);

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
        <p className="text-sm text-muted">Loading sessions...</p>
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
                Sessions
              </h1>
              <p className="text-sm text-muted mt-2">
                View and export your grinding sessions
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                disabled={filteredSessions.length === 0}
                className="rounded-base px-4 py-2.5 text-sm font-medium text-foreground border border-border hover:bg-raised transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export Excel
              </button>
              {(sessions?.length ?? 0) > 0 && (
                <button
                  onClick={() => setConfirmDeleteAll(true)}
                  className="rounded-base px-4 py-2.5 text-sm font-medium text-[var(--fg-danger)] border border-[var(--border-danger)] hover:bg-[var(--danger-soft)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2"
                >
                  Delete All
                </button>
              )}
            </div>
          </div>

          {/* Delete-all confirmation */}
          <ConfirmDialog
            open={confirmDeleteAll}
            onOpenChange={setConfirmDeleteAll}
            title="Delete all sessions?"
            description={
              <>
                This permanently deletes all{' '}
                <span className="font-bold text-foreground">
                  {sessions?.length ?? 0}
                </span>{' '}
                session{(sessions?.length ?? 0) === 1 ? '' : 's'} and their drops.
                This cannot be undone.
              </>
            }
            confirmLabel="Yes, delete all"
            danger
            loading={deleteAllMutation.isPending}
            onConfirm={() => deleteAllMutation.mutate()}
          />

          {/* Filters */}
          <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 laptop:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Character</label>
                <Select
                  value={filterCharId}
                  onChange={setFilterCharId}
                  options={[
                    { value: '', label: 'All Characters' },
                    ...(characters ?? []).map((c) => ({
                      value: c.id,
                      label: c.name,
                    })),
                  ]}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">From</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">To</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Sort by</label>
                <Select
                  value={sortBy}
                  onChange={(v) => setSortBy(v as 'date' | 'gold')}
                  options={[
                    { value: 'date', label: 'Date (newest)' },
                    { value: 'gold', label: 'Gold (highest)' },
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
                Clear filters
              </button>
            )}
          </div>

          {/* Results count */}
          <p className="text-xs text-muted mb-4">
            Showing {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
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
                No sessions found. Try adjusting your filters or start grinding!
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
                        {session.characters?.name ?? 'Unknown Character'}
                      </h3>
                      <p className="text-xs text-muted mt-1">
                        {session.dungeons && (
                          <span className="font-medium text-foreground/70">
                            {session.dungeons.name}
                            {' · '}
                          </span>
                        )}
                        {session.started_at
                          ? new Date(session.started_at).toLocaleDateString('th-TH', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'No date'}
                        {session.duration_minutes && (
                          <span> · {session.duration_minutes} min</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setEditingSession(session)}
                        className="rounded-base px-3 py-1.5 text-xs font-medium text-muted border border-border hover:text-gold hover:border-gold transition-colors duration-150 focus:outline-none"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(session.id)}
                        disabled={deleteMutation.isPending}
                        className="rounded-base px-3 py-1.5 text-xs font-medium text-[var(--fg-danger)] border border-[var(--border-danger)] hover:bg-[var(--danger-soft)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                    <div className="min-w-0">
                      <p className="text-xs text-muted">Value</p>
                      <Currency
                        copper={Number(session.gold_earned)}
                        className="!flex flex-wrap text-base"
                      />
                    </div>
                    {Number(session.gold_dropped) > 0 && (
                      <div>
                        <p className="text-xs text-muted">Gold Drop</p>
                        <div className="text-sm">
                          <Currency copper={Number(session.gold_dropped)} className="text-sm" />
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted">Duration</p>
                      <p className="text-sm font-medium text-foreground">
                        {session.duration_minutes
                          ? `${session.duration_minutes} min`
                          : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Item Drops */}
                  {session.session_drops && session.session_drops.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.05)]">
                      <p className="text-xs text-muted mb-2">Drops</p>
                      <div className="flex flex-wrap gap-2">
                        {session.session_drops.map((drop: { id: string; quantity: number; price_each: number; items?: { name: string; icon_url?: string | null } }) =>
                          editingDropId === drop.id ? (
                            <div
                              key={drop.id}
                              className="flex items-center gap-1.5 rounded-sm bg-raised px-2 py-1 outline outline-1 outline-[rgba(224,165,60,0.4)]"
                            >
                              <span className="text-xs text-foreground">
                                {drop.items?.name ?? 'Unknown'}
                              </span>
                              <span className="text-[10px] text-muted">x</span>
                              <input
                                type="number"
                                min={1}
                                value={editQty}
                                onChange={(e) => setEditQty(Number(e.target.value))}
                                className="w-12 rounded-xs border border-border bg-surface px-1 py-0.5 text-xs text-foreground outline-none focus:border-[var(--focus)]"
                                aria-label="Quantity"
                              />
                              <span className="text-[10px] text-muted">@</span>
                              <input
                                type="number"
                                min={0}
                                value={editPrice}
                                onChange={(e) => setEditPrice(Number(e.target.value))}
                                className="w-16 rounded-xs border border-border bg-surface px-1 py-0.5 text-xs text-foreground outline-none focus:border-[var(--focus)]"
                                aria-label="Price each"
                              />
                              <button
                                onClick={() =>
                                  updateDropMutation.mutate({
                                    dropId: drop.id,
                                    quantity: editQty,
                                    priceEach: editPrice,
                                  })
                                }
                                disabled={updateDropMutation.isPending || editQty < 1}
                                className="text-[var(--fg-success)] hover:opacity-80 disabled:opacity-40"
                                aria-label="Save drop"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingDropId(null)}
                                className="text-muted hover:text-foreground"
                                aria-label="Cancel"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div
                              key={drop.id}
                              className="group/drop flex items-center gap-1.5 bg-raised rounded-sm px-2 py-1"
                            >
                              {drop.items?.icon_url && (
                                <img src={drop.items.icon_url} alt="" className="w-4 h-4 rounded-xs object-cover" />
                              )}
                              <span className="text-xs text-foreground">
                                {drop.items?.name ?? 'Unknown'}
                              </span>
                              <span className="text-xs text-muted">
                                x{drop.quantity}
                              </span>
                              {drop.price_each > 0 && (
                                <span className="text-xs text-muted">
                                  ({formatGoldShort(drop.quantity * drop.price_each)})
                                </span>
                              )}
                              <button
                                onClick={() => startEditDrop(drop.id, drop.quantity, drop.price_each)}
                                className="ml-0.5 text-muted opacity-0 transition-opacity group-hover/drop:opacity-100 hover:text-gold"
                                aria-label="Edit drop"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => deleteDropMutation.mutate(drop.id)}
                                disabled={deleteDropMutation.isPending}
                                className="text-muted opacity-0 transition-opacity group-hover/drop:opacity-100 hover:text-[var(--fg-danger)] disabled:opacity-50"
                                aria-label="Remove drop"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [characterId, setCharacterId] = useState(session.character_id);
  const [dungeonId, setDungeonId] = useState(session.dungeon_id ?? '');
  const [gold, setGold] = useState(Number(session.gold_earned));
  const [goldDrop, setGoldDrop] = useState(Number(session.gold_dropped ?? 0));
  const [duration, setDuration] = useState(session.duration_minutes ?? 0);

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
    }) => api.patch(`/sessions/${session.id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Session updated', variant: 'success' });
      onClose();
    },
    onError: (e) =>
      toast({
        title: 'Could not update session',
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  return (
    <div className="bg-surface rounded-base outline outline-1 outline-[rgba(224,165,60,0.35)] p-6 mb-6">
      <h3 className="text-sm font-medium text-foreground mb-4">Edit Session</h3>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Character</label>
            <Select
              value={characterId}
              onChange={setCharacterId}
              placeholder="Select character"
              options={(characters ?? []).map((c) => ({
                value: c.id,
                label: c.name,
              }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Dungeon</label>
            <Select
              value={dungeonId}
              onChange={setDungeonId}
              options={[
                { value: '', label: 'None' },
                ...(dungeons ?? []).map((d) => ({
                  value: d.id,
                  label: d.name,
                })),
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Total Value</label>
            <CurrencyInput value={gold} onChange={setGold} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Gold Drop</label>
            <CurrencyInput value={goldDrop} onChange={setGoldDrop} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Duration (min)</label>
            <input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)]"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded-base px-4 py-2 text-sm font-medium text-[#1b1407] bg-[var(--blue)] shadow-button transition-colors duration-150 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-base px-4 py-2 text-sm font-medium text-foreground border border-border hover:bg-raised transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
