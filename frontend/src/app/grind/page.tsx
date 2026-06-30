'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { NumericInput } from '@/components/numeric-input';
import { Currency, CurrencyInput } from '@/components/currency';
import { formatGoldShort } from '@/lib/currency';
import { Select } from '@/components/select';
import { rarityStyle } from '@/lib/rarity';
import { useToast } from '@/components/toast';
import type { Character, Dungeon, Item } from '@/types';

interface DropEntry {
  itemId: string;
  itemName: string;
  rarity: string | null;
  quantity: number;
  priceEach: number;
}

export default function GrindPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedDungeonId, setSelectedDungeonId] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [drops, setDrops] = useState<DropEntry[]>([]);
  const [goldDropped, setGoldDropped] = useState(0); // raw currency, in copper

  const { data: dungeons } = useQuery<Dungeon[]>({
    queryKey: ['game-data', 'dungeons'],
    queryFn: () => api.get('/game-data/dungeons'),
  });

  const { data: characters } = useQuery<Character[]>({
    queryKey: ['characters'],
    queryFn: () => api.get('/characters'),
  });

  const { data: items } = useQuery<Item[]>({
    queryKey: ['game-data', 'items'],
    queryFn: () => api.get('/game-data/items'),
  });

  // All currency values are in copper. Total = item-drop value + raw currency.
  const dropsValue = useMemo(() => {
    return drops.reduce((sum, d) => sum + d.quantity * d.priceEach, 0);
  }, [drops]);
  const totalGold = dropsValue + goldDropped;

  const durationMinutes = hours * 60 + minutes;
  const goldPerHour = durationMinutes > 0 ? Math.round((totalGold / durationMinutes) * 60) : 0;

  // Update drop entry
  const updateDrop = (itemId: string, field: 'quantity' | 'priceEach', value: number) => {
    setDrops((prev) => {
      const existing = prev.find((d) => d.itemId === itemId);
      if (existing) {
        return prev.map((d) =>
          d.itemId === itemId ? { ...d, [field]: value } : d,
        );
      }
      // Create new entry
      const item = items?.find((i) => i.id === itemId);
      if (!item) return prev;
      return [
        ...prev,
        {
          itemId,
          itemName: item.name,
          rarity: item.rarity,
          quantity: field === 'quantity' ? value : 0,
          priceEach: field === 'priceEach' ? value : item.default_price,
        },
      ];
    });
  };

  // Get current value for a drop
  const getDropValue = (itemId: string, field: 'quantity' | 'priceEach'): number => {
    const entry = drops.find((d) => d.itemId === itemId);
    if (entry) return entry[field];
    if (field === 'priceEach') {
      const item = items?.find((i) => i.id === itemId);
      return item?.default_price ?? 0;
    }
    return 0;
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
        startedAt: new Date().toISOString(),
      });

      // Save drops
      const activeDrops = drops.filter((d) => d.quantity > 0);
      if (activeDrops.length > 0 && session.id) {
        for (const drop of activeDrops) {
          await api.post('/sessions/drops', {
            sessionId: session.id,
            itemId: drop.itemId,
            quantity: drop.quantity,
            priceEach: drop.priceEach,
          });
        }
      }

      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setDrops([]);
      setHours(1);
      setMinutes(0);
      setGoldDropped(0);
      toast({ title: 'Session saved', description: 'Added to your dashboard.', variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: 'Could not save session',
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
              Grind Tracker
            </h1>
            <p className="text-sm text-muted mt-2">
              Record drops and calculate gold per hour
            </p>
          </div>

          {/* Top Bar */}
          <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6 mb-6">
            {/* Dungeon image */}
            {selectedDungeon?.image_url && (
              <div className="mb-4">
                <img
                  src={selectedDungeon.image_url}
                  alt={selectedDungeon.name}
                  className="w-full max-h-[200px] object-cover rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)]"
                />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 laptop:grid-cols-4 gap-4">
              {/* Dungeon */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Dungeon</label>
                <Select
                  value={selectedDungeonId}
                  onChange={setSelectedDungeonId}
                  placeholder="Select dungeon..."
                  options={(dungeons ?? []).map((d) => ({
                    value: d.id,
                    label: d.name,
                  }))}
                />
              </div>

              {/* Character */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Character</label>
                <Select
                  value={selectedCharacterId}
                  onChange={setSelectedCharacterId}
                  placeholder="Select character..."
                  options={(characters ?? []).map((c) => ({
                    value: c.id,
                    label: `${c.name} (Lv.${c.level})`,
                  }))}
                />
              </div>

              {/* Hours + Minutes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Duration</label>
                <div className="flex items-center gap-2">
                  <NumericInput
                    value={hours}
                    onValueChange={(v) => setHours(Math.min(v, 24))}
                    className="w-16 rounded-base border border-border bg-surface px-2 py-2.5 text-sm text-foreground text-center outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20"
                    placeholder="1"
                  />
                  <span className="text-xs text-muted">h</span>
                  <NumericInput
                    value={minutes}
                    onValueChange={(v) => setMinutes(Math.min(v, 59))}
                    className="w-16 rounded-base border border-border bg-surface px-2 py-2.5 text-sm text-foreground text-center outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20"
                    placeholder="0"
                  />
                  <span className="text-xs text-muted">m</span>
                </div>
              </div>

              {/* Raw currency picked up during the run */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">
                  Gold Drop <span className="text-dark-gray">(currency picked up)</span>
                </label>
                <CurrencyInput
                  value={goldDropped}
                  onChange={setGoldDropped}
                  maxGold={9999}
                />
              </div>

            </div>
          </div>

          {/* Main content: Drops + Summary */}
          <div className="grid grid-cols-1 laptop:grid-cols-[1fr_300px] gap-6">
            {/* Drop Items List */}
            <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
              <h2 className="text-sm font-medium text-foreground mb-4">
                Item Drops
              </h2>

              {!items || items.length === 0 ? (
                <p className="text-xs text-muted py-8 text-center">
                  No items configured yet. Add items in Admin settings.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-3 text-left text-xs font-medium text-muted">Item</th>
                        <th className="pb-3 text-right text-xs font-medium text-muted w-[88px]">Quantity</th>
                        <th className="pb-3 text-right text-xs font-medium text-muted w-[232px]">Price Each</th>
                        <th className="pb-3 text-right text-xs font-medium text-muted w-[100px]">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const qty = getDropValue(item.id, 'quantity');
                        const price = getDropValue(item.id, 'priceEach');
                        const subtotal = qty * price;

                        return (
                          <tr
                            key={item.id}
                            className="border-b border-[rgba(255,255,255,0.05)] last:border-0"
                          >
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2.5">
                                {item.icon_url ? (
                                  <img
                                    src={item.icon_url}
                                    alt={item.name}
                                    className="h-8 w-8 shrink-0 rounded-sm object-cover"
                                    style={{ outline: `2px solid ${rarityStyle(item.rarity).color}`, outlineOffset: '-1px' }}
                                  />
                                ) : (
                                  <div
                                    className="h-8 w-8 shrink-0 rounded-sm"
                                    style={{ background: rarityStyle(item.rarity).soft, outline: `2px solid ${rarityStyle(item.rarity).color}`, outlineOffset: '-1px' }}
                                  />
                                )}
                                <span
                                  className="text-sm font-semibold leading-snug"
                                  style={{ color: rarityStyle(item.rarity).color }}
                                >
                                  {item.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-3">
                              <NumericInput
                                value={qty}
                                onValueChange={(v) =>
                                  updateDrop(item.id, 'quantity', Math.min(9999, v))
                                }
                                placeholder="0"
                                className="w-full rounded-base border border-border bg-surface px-2 py-1.5 text-sm text-foreground text-right outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20"
                              />
                            </td>
                            <td className="py-3">
                              <CurrencyInput
                                value={price}
                                onChange={(v) => updateDrop(item.id, 'priceEach', v)}
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
                <h2 className="text-sm font-medium text-foreground mb-4">Summary</h2>

                <div className="flex flex-col gap-3 mb-6">
                  <div className="flex items-center justify-between gap-2">
                    <span className="shrink-0 text-xs text-muted">Item Value</span>
                    <Currency copper={dropsValue} className="text-sm" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="shrink-0 text-xs text-muted">Gold Drop</span>
                    <Currency copper={goldDropped} className="text-sm" />
                  </div>

                  {/* Total — hero, on its own line so the big number has room */}
                  <div className="border-t border-border pt-3">
                    <span className="text-xs font-medium text-muted">Total Value</span>
                    <div className="mt-1">
                      <Currency
                        copper={totalGold}
                        className="!flex flex-wrap text-2xl"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="shrink-0 text-xs text-muted">Value / Hour</span>
                    <Currency copper={goldPerHour} className="text-sm" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted">Duration</span>
                    <span className="text-sm text-foreground">
                      {hours}h {minutes}m
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted">Items Tracked</span>
                    <span className="text-sm text-foreground">
                      {drops.filter((d) => d.quantity > 0).length}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  disabled={!selectedCharacterId || saveMutation.isPending}
                  className="w-full rounded-base px-4 py-3 text-sm font-medium text-white bg-[var(--success)] transition-colors duration-150 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save Session'}
                </button>

                {saveMutation.isSuccess && (
                  <p className="text-xs text-[var(--fg-success)] mt-3 text-center">
                    Session saved successfully!
                  </p>
                )}
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
