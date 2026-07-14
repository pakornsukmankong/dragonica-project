'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect, useRef } from 'react';
import { m } from 'motion/react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { NumericInput } from '@/components/numeric-input';
import { Currency, CurrencyInput } from '@/components/currency';
import { formatGoldShort } from '@/lib/currency';
import { Select } from '@/components/select';
import { Autocomplete } from '@/components/autocomplete';
import { ItemIcon } from '@/components/item-icon';
import {
  ITEM_CATEGORIES,
  itemRarity,
  type GameItem,
  type GameItemIcon,
} from '@/lib/items';
import { rarityStyle } from '@/lib/rarity';
import { useToast } from '@/components/toast';
import { X, Play, Pause, Square, RotateCcw } from 'lucide-react';
import type { Character, Dungeon, Item } from '@/types';

interface DropEntry {
  itemId: string; // items-table uuid (via /game-data/items/ensure)
  itemName: string;
  rarity: string | null;
  quantity: number;
  priceEach: number;
  icon?: GameItemIcon;
}

// The stopwatch survives a page refresh/navigation (a grind run can last an
// hour) by persisting to localStorage. `runningSince` is an absolute wall-clock
// timestamp, so a restored running timer correctly keeps counting.
const TIMER_STORAGE_KEY = 'dgn-grind-timer';

interface TimerState {
  durationMode: 'manual' | 'timer';
  elapsedMs: number;
  runningSince: number | null;
}

function loadTimerState(): TimerState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<TimerState>;
    if (s.durationMode !== 'manual' && s.durationMode !== 'timer') return null;
    return {
      durationMode: s.durationMode,
      elapsedMs:
        typeof s.elapsedMs === 'number' && s.elapsedMs >= 0 ? s.elapsedMs : 0,
      runningSince:
        typeof s.runningSince === 'number' ? s.runningSince : null,
    };
  } catch {
    return null;
  }
}

export default function GrindPage() {
  const t = useTranslations('grind');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedDungeonId, setSelectedDungeonId] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [note, setNote] = useState('');

  // Duration can be typed in by hand ("manual") or measured with a built-in
  // stopwatch ("timer"). The timer keeps a running total in `elapsedMs`
  // (accumulated across pauses) plus `runningSince` (when the current segment
  // started, or null while paused/stopped). `now` re-renders it every second.
  const [durationMode, setDurationMode] = useState<'manual' | 'timer'>('manual');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [runningSince, setRunningSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (runningSince == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [runningSince]);

  // Restore any timer left running/paused before a refresh. This must be an
  // effect, not lazy init: reading localStorage during render would make the
  // client's first paint differ from the server's and mismatch hydration. A
  // one-shot mount sync is exactly that exception to set-state-in-effect.
  useEffect(() => {
    const s = loadTimerState();
    if (!s) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setDurationMode(s.durationMode);
    setElapsedMs(s.elapsedMs);
    setRunningSince(s.runningSince);
    setNow(Date.now());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Persist on every change. Skip the first run so the mount write doesn't
  // clobber saved state with the defaults before the restore effect applies.
  const timerHydrated = useRef(false);
  useEffect(() => {
    if (!timerHydrated.current) {
      timerHydrated.current = true;
      return;
    }
    try {
      window.localStorage.setItem(
        TIMER_STORAGE_KEY,
        JSON.stringify({ durationMode, elapsedMs, runningSince }),
      );
    } catch {
      // storage unavailable (private mode/quota) — timer just won't persist.
    }
  }, [durationMode, elapsedMs, runningSince]);

  const liveMs = elapsedMs + (runningSince != null ? now - runningSince : 0);
  const isTimerRunning = runningSince != null;

  const startTimer = () => {
    if (isTimerRunning) return;
    // Fresh start (elapsedMs 0) or resume after a pause (elapsedMs kept).
    const t0 = Date.now();
    setNow(t0);
    setRunningSince(t0);
  };
  const pauseTimer = () => {
    if (!isTimerRunning) return;
    setElapsedMs((ms) => ms + (Date.now() - runningSince));
    setRunningSince(null);
  };
  const stopTimer = () => {
    // Finish timing: drop the measured time into the manual hour/minute fields
    // and switch to Manual so the user can review or tweak it before saving.
    const totalMs =
      elapsedMs + (runningSince != null ? Date.now() - runningSince : 0);
    const totalMinutes = Math.round(totalMs / 60000);
    setHours(Math.floor(totalMinutes / 60));
    setMinutes(totalMinutes % 60);
    setDurationMode('manual');
    // The value now lives in the manual fields — clear the stopwatch.
    setElapsedMs(0);
    setRunningSince(null);
  };
  const resetTimer = () => {
    setElapsedMs(0);
    setRunningSince(null);
  };
  const [drops, setDrops] = useState<DropEntry[]>([]);
  // Wallet gold before/after the run (in copper) — the currency picked up is
  // their difference. Ending below the start (repairs, potions) counts as 0
  // rather than subtracting: the backend rejects a negative goldDropped.
  const [goldStart, setGoldStart] = useState(0);
  const [goldEnd, setGoldEnd] = useState(0);
  const goldDropped = Math.max(0, goldEnd - goldStart);

  const { data: dungeons } = useQuery<Dungeon[]>({
    queryKey: ['game-data', 'dungeons'],
    queryFn: () => api.get('/game-data/dungeons'),
  });

  const { data: characters } = useQuery<Character[]>({
    queryKey: ['characters'],
    queryFn: () => api.get('/characters'),
  });

  // Full static game item database — the same per-category JSON the /items
  // page reads. Loaded once (staleTime: Infinity) and searched client-side.
  const { data: gameItems } = useQuery<GameItem[]>({
    queryKey: ['game-db', 'all-items'],
    queryFn: async () => {
      const lists = await Promise.all(
        ITEM_CATEGORIES.map(async (cat) => {
          const res = await fetch(`/data/items/${cat}.json`);
          if (!res.ok) throw new Error(`Failed to load ${cat} items`);
          return (await res.json()) as GameItem[];
        }),
      );
      return lists.flat();
    },
    staleTime: Infinity,
  });

  // Items already ensured into the backend `items` table by past grind logs —
  // familiar picks float to the top of the search dropdown.
  const { data: dbItems } = useQuery<Item[]>({
    queryKey: ['game-data', 'items'],
    queryFn: () => api.get('/game-data/items'),
  });

  // Options keyed by list position — game ids are only unique per category.
  // The game data repeats many names across categories, so duplicates
  // collapse to one option (preferring one already in the database). Sorted
  // (stably) so items that already exist in the database come first.
  const itemOptions = useMemo(() => {
    const known = new Set(
      (dbItems ?? []).map((it) => it.game_item_id).filter((id) => id != null),
    );
    const byName = new Map<
      string,
      { value: string; label: string; icon: React.ReactNode; known: boolean }
    >();
    (gameItems ?? []).forEach((g, i) => {
      const key = g.name.toLowerCase();
      const isKnown = known.has(g.id);
      if (byName.has(key) && !(isKnown && !byName.get(key)!.known)) return;
      byName.set(key, {
        value: String(i),
        label: g.name,
        icon: <ItemIcon icon={g.icon} size={24} className="rounded-xs" />,
        known: isKnown,
      });
    });
    return [...byName.values()].sort(
      (a, b) => Number(b.known) - Number(a.known),
    );
  }, [gameItems, dbItems]);

  // All currency values are in copper. Total = item-drop value + raw currency.
  const dropsValue = useMemo(() => {
    return drops.reduce((sum, d) => sum + d.quantity * d.priceEach, 0);
  }, [drops]);
  const totalGold = dropsValue + goldDropped;

  // Exact (fractional) minutes drive the rate math; the rounded integer is
  // what we display and store. Rounding first made a sub-minute timer run read
  // as 0 gold/hr.
  const durationMinutesExact =
    durationMode === 'timer' ? liveMs / 60000 : hours * 60 + minutes;
  const durationMinutes = Math.round(durationMinutesExact);
  const goldPerHour =
    durationMinutesExact > 0
      ? Math.round((totalGold / durationMinutesExact) * 60)
      : 0;
  // Duration shown in the summary — unified across both input modes.
  const displayHours = Math.floor(durationMinutes / 60);
  const displayMinutes = durationMinutes % 60;
  // The live stopwatch read-out (HH:MM:SS).
  const timerClock = (() => {
    const s = Math.floor(liveMs / 1000);
    return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
      .map((n) => String(n).padStart(2, '0'))
      .join(':');
  })();

  // Picking a game item: find-or-create its `items` row (drops reference the
  // row by uuid), then append an entry. Only the game id is sent — the server
  // fills name/rarity/icon from its own manifest. Price is intentionally left
  // at 0 for the user to fill in — market value isn't the NPC price.
  const addItemMutation = useMutation({
    mutationFn: async (game: GameItem) => {
      const row = await api.post<Item>('/game-data/items/ensure', {
        gameItemId: game.id,
      });
      return { row, game };
    },
    onSuccess: ({ row, game }) => {
      setDrops((prev) =>
        prev.some((d) => d.itemId === row.id)
          ? prev
          : [
              ...prev,
              {
                itemId: row.id,
                itemName: game.name,
                rarity: itemRarity(game),
                quantity: 1,
                priceEach: 0,
                icon: game.icon,
              },
            ],
      );
    },
    onError: (e) =>
      toast({
        title: t('toastAddItemError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const pickGameItem = (key: string) => {
    if (!key) return; // the picker clearing itself
    const game = gameItems?.[Number(key)];
    if (game) addItemMutation.mutate(game);
  };

  const updateDrop = (itemId: string, field: 'quantity' | 'priceEach', value: number) => {
    setDrops((prev) =>
      prev.map((d) => (d.itemId === itemId ? { ...d, [field]: value } : d)),
    );
  };

  const removeDrop = (itemId: string) => {
    setDrops((prev) => prev.filter((d) => d.itemId !== itemId));
  };

  // Save session
  const saveMutation = useMutation({
    mutationFn: async () => {
      const session = await api.post<{ id: string }>('/sessions', {
        characterId: selectedCharacterId,
        dungeonId: selectedDungeonId || undefined,
        durationMinutes: durationMinutes || undefined,
        goldEarned: totalGold,
        goldDropped: goldDropped || undefined,
        note: note.trim() || undefined,
        startedAt: new Date().toISOString(),
      });

      // Save all drops in one request.
      const activeDrops = drops.filter((d) => d.quantity > 0);
      if (activeDrops.length > 0 && session.id) {
        await api.post('/sessions/drops/bulk', {
          sessionId: session.id,
          drops: activeDrops.map((d) => ({
            itemId: d.itemId,
            quantity: d.quantity,
            priceEach: d.priceEach,
          })),
        });
      }

      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setDrops([]);
      setHours(1);
      setMinutes(0);
      resetTimer();
      setDurationMode('manual'); // back to the default input after a clean save
      setNote('');
      setGoldStart(0);
      setGoldEnd(0);
      toast({ title: t('toastSavedTitle'), description: t('toastSavedDesc'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('toastSaveErrorTitle'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const handleSave = () => {
    if (!selectedCharacterId) return;
    saveMutation.mutate();
  };

  const selectedDungeon = dungeons?.find((d) => d.id === selectedDungeonId);

  return (
    <main className="min-h-screen bg-root">
      <section className="relative overflow-hidden py-[40px] laptop:py-[60px]">
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
          <div className="mb-8">
            <h1 className="text-xl laptop:text-2xl font-medium text-foreground">
              {t('title')}
            </h1>
            <p className="text-sm text-muted mt-2">
              {t('subtitle')}
            </p>
          </div>

          {/* Top Bar */}
          <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6 mb-6">
            {/* Dungeon image */}
            {selectedDungeon?.image_url && (
              <div className="mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- dynamic storage URL behind login; not worth next/image optimization */}
                <img
                  src={selectedDungeon.image_url}
                  alt={selectedDungeon.name}
                  className="w-full max-h-[200px] object-cover rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)]"
                />
              </div>
            )}
            {/* Two rows on laptop: dungeon/character/duration/gold-start,
                then the note (3 cols) beside gold-end */}
            <div className="grid grid-cols-1 sm:grid-cols-2 laptop:grid-cols-4 gap-4 items-start">
              {/* Dungeon — searchable: the seeded list is hundreds of names */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">{t('dungeon')}</label>
                <Autocomplete
                  value={selectedDungeonId}
                  onChange={setSelectedDungeonId}
                  placeholder={t('searchDungeon')}
                  emptyText={t('noDungeonResults')}
                  options={(dungeons ?? []).map((d) => ({
                    value: d.id,
                    label: d.name,
                  }))}
                />
              </div>

              {/* Character */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">{t('character')}</label>
                <Select
                  value={selectedCharacterId}
                  onChange={setSelectedCharacterId}
                  placeholder={t('selectCharacter')}
                  options={(characters ?? []).map((c) => ({
                    value: c.id,
                    label: `${c.name} (Lv.${c.level})`,
                  }))}
                />
              </div>

              {/* Duration — typed in by hand, or measured with the stopwatch */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-muted">{t('duration')}</label>
                  {/* Mode toggle: manual vs timer */}
                  <div className="flex items-center gap-0.5 rounded-base bg-raised p-0.5">
                    {(['manual', 'timer'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDurationMode(m)}
                        className={`rounded-sm px-2 py-0.5 text-[10px] font-medium transition-colors duration-150 ${
                          durationMode === m
                            ? 'bg-surface text-foreground outline outline-1 outline-[rgba(255,255,255,0.08)]'
                            : 'text-muted hover:text-foreground'
                        }`}
                      >
                        {m === 'manual' ? t('durationManual') : t('durationTimer')}
                      </button>
                    ))}
                  </div>
                </div>

                {durationMode === 'manual' ? (
                  <div className="flex items-center gap-2">
                    <NumericInput
                      value={hours}
                      onValueChange={(v) => setHours(Math.min(v, 24))}
                      className="w-16 rounded-base border border-border bg-surface px-2 py-2.5 text-sm text-foreground text-center placeholder:text-muted outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20"
                      placeholder="0"
                    />
                    <span className="text-xs text-muted">{t('hourShort')}</span>
                    <NumericInput
                      value={minutes}
                      onValueChange={(v) => setMinutes(Math.min(v, 59))}
                      className="w-16 rounded-base border border-border bg-surface px-2 py-2.5 text-sm text-foreground text-center placeholder:text-muted outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20"
                      placeholder="0"
                    />
                    <span className="text-xs text-muted">{t('minuteShort')}</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`min-w-[78px] rounded-base border border-border bg-surface px-2 py-2 text-center text-base font-semibold tabular-nums ${
                        isTimerRunning ? 'text-gold' : 'text-foreground'
                      }`}
                    >
                      {timerClock}
                    </span>
                    {!isTimerRunning ? (
                      <button
                        type="button"
                        onClick={startTimer}
                        aria-label={liveMs === 0 ? t('timerStart') : t('timerResume')}
                        title={liveMs === 0 ? t('timerStart') : t('timerResume')}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base bg-[var(--success)] text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={pauseTimer}
                        aria-label={t('timerPause')}
                        title={t('timerPause')}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base bg-[var(--warning)] text-[var(--root)] transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
                      >
                        <Pause className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={stopTimer}
                      disabled={liveMs === 0}
                      aria-label={t('timerStop')}
                      title={t('timerStop')}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base bg-[var(--danger)] text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Square className="h-4 w-4" />
                    </button>
                    {!isTimerRunning && liveMs > 0 && (
                      <button
                        type="button"
                        onClick={resetTimer}
                        aria-label={t('timerReset')}
                        title={t('timerReset')}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base border border-border text-muted transition-colors hover:text-foreground hover:border-[var(--border-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Wallet gold before the run */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">
                  {t('goldStart')}
                </label>
                <CurrencyInput
                  value={goldStart}
                  onChange={setGoldStart}
                  maxGold={999999}
                />
              </div>

              {/* Session note — spans under dungeon/character/duration */}
              <div className="flex flex-col gap-1.5 laptop:col-span-3">
                <label htmlFor="session-note" className="text-xs font-medium text-muted">
                  {t('note')}
                </label>
                <textarea
                  id="session-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('notePlaceholder')}
                  maxLength={1000}
                  rows={1}
                  className="w-full resize-y rounded-base border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors hover:border-[var(--border-dark)] focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20"
                />
              </div>

              {/* Wallet gold after the run — picked-up currency is the difference */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">
                  {t('goldEnd')}
                </label>
                <CurrencyInput
                  value={goldEnd}
                  onChange={setGoldEnd}
                  maxGold={999999}
                />
                {goldEnd > 0 && goldEnd < goldStart && (
                  <p className="text-xs text-[var(--fg-danger)]">
                    {t('goldDiffWarn')}
                  </p>
                )}
              </div>

            </div>
          </div>

          {/* Main content: Drops + Summary */}
          <div className="grid grid-cols-1 laptop:grid-cols-[1fr_300px] gap-6">
            {/* Drop Items List */}
            <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
              <h2 className="text-sm font-medium text-foreground mb-4">
                {t('itemDrops')}
              </h2>

              {/* Search the full game item database; picks become rows below. */}
              <Autocomplete
                value=""
                onChange={pickGameItem}
                placeholder={gameItems ? t('searchItem') : tc('loading')}
                emptyText={t('noItemResults')}
                options={itemOptions}
                disabled={!gameItems}
                className="mb-4"
              />

              {drops.length === 0 ? (
                <p className="text-xs text-muted py-8 text-center">
                  {t('noDropsSelected')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-3 text-left text-xs font-medium text-muted">{t('colItem')}</th>
                        <th className="pb-3 text-right text-xs font-medium text-muted w-[88px]">{t('colQuantity')}</th>
                        <th className="pb-3 text-right text-xs font-medium text-muted w-[232px]">{t('colPriceEach')}</th>
                        <th className="pb-3 text-right text-xs font-medium text-muted w-[100px]">{t('colSubtotal')}</th>
                        <th className="pb-3 w-[40px]" />
                      </tr>
                    </thead>
                    <tbody>
                      {drops.map((d) => {
                        const subtotal = d.quantity * d.priceEach;
                        const style = rarityStyle(d.rarity);

                        return (
                          <tr
                            key={d.itemId}
                            className="border-b border-[rgba(255,255,255,0.05)] last:border-0"
                          >
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2.5">
                                {d.icon ? (
                                  <ItemIcon
                                    icon={d.icon}
                                    size={32}
                                    className="rounded-sm"
                                    style={{ outline: `2px solid ${style.color}`, outlineOffset: '-1px' }}
                                  />
                                ) : (
                                  <div
                                    className="h-8 w-8 shrink-0 rounded-sm"
                                    style={{ background: style.soft, outline: `2px solid ${style.color}`, outlineOffset: '-1px' }}
                                  />
                                )}
                                <span
                                  className="text-sm font-semibold leading-snug"
                                  style={{ color: style.color }}
                                >
                                  {d.itemName}
                                </span>
                              </div>
                            </td>
                            <td className="py-3">
                              <NumericInput
                                value={d.quantity}
                                onValueChange={(v) =>
                                  updateDrop(d.itemId, 'quantity', Math.min(9999, v))
                                }
                                placeholder="0"
                                className="w-full rounded-base border border-border bg-surface px-2 py-1.5 text-sm text-foreground text-right outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20"
                              />
                            </td>
                            <td className="py-3">
                              <CurrencyInput
                                value={d.priceEach}
                                onChange={(v) => updateDrop(d.itemId, 'priceEach', v)}
                                maxGold={9999}
                                className="justify-end"
                              />
                            </td>
                            <td className="py-3 text-right">
                              {subtotal > 0 ? (
                                <span
                                  className="whitespace-nowrap text-sm font-bold tabular-nums text-gold"
                                  title={`${subtotal.toLocaleString()} copper`}
                                >
                                  {formatGoldShort(subtotal)}
                                </span>
                              ) : (
                                <span className="text-sm text-muted">-</span>
                              )}
                            </td>
                            <td className="py-3 text-right">
                              <button
                                type="button"
                                onClick={() => removeDrop(d.itemId)}
                                aria-label={`Remove ${d.itemName}`}
                                className="rounded-base p-1.5 text-muted transition-colors hover:text-[var(--fg-danger)] hover:bg-[var(--danger-soft)]"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Summary Panel */}
            <div className="flex flex-col gap-4">
              <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6 sticky top-6">
                <h2 className="text-sm font-medium text-foreground mb-4">{t('summary')}</h2>

                <div className="flex flex-col gap-3 mb-6">
                  <div className="flex items-center justify-between gap-2">
                    <span className="shrink-0 text-xs text-muted">{t('itemValue')}</span>
                    <Currency copper={dropsValue} className="text-sm" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="shrink-0 text-xs text-muted">
                      {t('goldDrop')} <span className="text-dark-gray">{t('goldDropHint')}</span>
                    </span>
                    <Currency copper={goldDropped} className="text-sm" />
                  </div>

                  {/* Total — hero, on its own line so the big number has room */}
                  <div className="border-t border-border pt-3">
                    <span className="text-xs font-medium text-muted">{t('totalValue')}</span>
                    <div className="mt-1">
                      <Currency
                        copper={totalGold}
                        className="!flex flex-wrap text-2xl"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="shrink-0 text-xs text-muted">{t('valuePerHour')}</span>
                    <Currency copper={goldPerHour} className="text-sm" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted">{t('duration')}</span>
                    <span className="text-sm text-foreground tabular-nums">
                      {displayHours}{t('hourShort')} {displayMinutes}{t('minuteShort')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted">{t('itemsTracked')}</span>
                    <span className="text-sm text-foreground">
                      {drops.filter((d) => d.quantity > 0).length}
                    </span>
                  </div>
                </div>

                <m.button
                  onClick={handleSave}
                  whileTap={{ scale: 0.98 }}
                  disabled={!selectedCharacterId || saveMutation.isPending}
                  className="w-full rounded-base px-4 py-3 text-sm font-medium text-white bg-[var(--success)] transition-colors duration-150 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saveMutation.isPending ? tc('saving') : t('saveSession')}
                </m.button>

                {saveMutation.isError && (
                  <p className="text-xs text-[var(--fg-danger)] mt-3 text-center">
                    {(saveMutation.error as Error).message}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
