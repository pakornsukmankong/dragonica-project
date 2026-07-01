'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/image-upload';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { rarityStyle } from '@/lib/rarity';
import { Pagination } from '@/components/pagination';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { Trash2 } from 'lucide-react';
import { Currency, CurrencyInput } from '@/components/currency';
import { Select } from '@/components/select';
import type { Dungeon, Item, GameClass, Donation } from '@/types';

const ITEMS_PER_PAGE = 10;

const TABS = [
  { value: 'dungeons', Tab: DungeonsTab },
  { value: 'items', Tab: ItemsTab },
  { value: 'classes', Tab: ClassesTab },
  { value: 'donations', Tab: DonationsTab },
] as const;

export default function AdminPage() {
  const { isAdmin, isLoading: isRoleLoading } = useIsAdmin();

  if (isRoleLoading) {
    return (
      <div className="min-h-screen bg-root flex items-center justify-center">
        <p className="text-sm text-muted">Checking permissions...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-root flex items-center justify-center">
        <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-8 text-center max-w-sm">
          <p className="text-sm font-medium text-foreground mb-2">Access Denied</p>
          <p className="text-xs text-muted">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

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
          <div className="mb-8">
            <h1 className="text-xl laptop:text-2xl font-medium text-foreground">
              Admin Settings
            </h1>
            <p className="text-sm text-muted mt-2">
              Manage dungeons, items, classes, and donations
            </p>
          </div>

          <Tabs.Root defaultValue="dungeons">
            <Tabs.List className="mb-6 flex w-fit items-center gap-1 rounded-base bg-raised p-1">
              {TABS.map(({ value }) => (
                <Tabs.Trigger
                  key={value}
                  value={value}
                  className="rounded-sm px-4 py-2 text-xs font-medium capitalize text-muted outline-none transition-colors duration-150 hover:text-foreground data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:outline data-[state=active]:outline-1 data-[state=active]:outline-[rgba(255,255,255,0.08)]"
                >
                  {value}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {TABS.map(({ value, Tab }) => (
              <Tabs.Content key={value} value={value} className="outline-none">
                <Tab />
              </Tabs.Content>
            ))}
          </Tabs.Root>
        </div>
      </section>
    </main>
  );
}

// ===== DUNGEONS TAB =====
function DungeonsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [dragonCoreCost, setDragonCoreCost] = useState<number | ''>('');
  const [averageDuration, setAverageDuration] = useState<number | ''>('');

  const { data: dungeons, isLoading } = useQuery<Dungeon[]>({
    queryKey: ['admin', 'dungeons'],
    queryFn: () => api.get('/admin/dungeons'),
  });

  const createMutation = useMutation({
    mutationFn: (body: {
      name: string;
      imageUrl?: string;
      dragonCoreCost?: number;
      averageDuration?: number;
    }) => api.post('/admin/dungeons', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dungeons'] });
      setName('');
      setImageUrl('');
      setDragonCoreCost('');
      setAverageDuration('');
      toast({ title: 'Dungeon added', variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: 'Could not add dungeon',
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/dungeons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dungeons'] });
      toast({ title: 'Dungeon deleted', variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: 'Could not delete dungeon',
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        <h3 className="text-sm font-medium text-foreground mb-4">Add Dungeon</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name) return;
            createMutation.mutate({
              name,
              imageUrl: imageUrl || undefined,
              dragonCoreCost: dragonCoreCost || undefined,
              averageDuration: averageDuration || undefined,
            });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
              <label className="text-xs font-medium text-muted">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)]"
                placeholder="Dragon Nest F1"
              />
            </div>
            <div className="flex flex-col gap-1.5 w-32">
              <label className="text-xs font-medium text-muted">Core Cost</label>
              <input
                type="number"
                min={0}
                value={dragonCoreCost}
                onChange={(e) => setDragonCoreCost(e.target.value ? Number(e.target.value) : '')}
                placeholder="e.g. 5"
                className="rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)]"
              />
            </div>
            <div className="flex flex-col gap-1.5 w-36">
              <label className="text-xs font-medium text-muted">Avg Duration (min)</label>
              <input
                type="number"
                min={0}
                value={averageDuration}
                onChange={(e) => setAverageDuration(e.target.value ? Number(e.target.value) : '')}
                placeholder="e.g. 15"
                className="rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)]"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Image</label>
            <ImageUpload currentUrl={imageUrl || null} onUploaded={setImageUrl} />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="self-start rounded-base px-4 py-2 text-sm font-medium text-[#1b1407] bg-[var(--blue)] shadow-button hover:opacity-90 disabled:opacity-50"
          >
            Add
          </button>
        </form>
      </div>

      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        {isLoading ? (
          <p className="text-xs text-muted">Loading...</p>
        ) : (
          <div className="space-y-2">
            {dungeons?.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.05)] last:border-0">
                <div className="flex items-center gap-3">
                  {d.image_url ? (
                    <img src={d.image_url} alt={d.name} className="w-8 h-8 rounded-sm object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-sm bg-raised" />
                  )}
                  <div>
                    <span className="text-sm text-foreground font-medium">{d.name}</span>
                    <div className="flex gap-3 text-[11px] text-muted mt-0.5">
                      {d.dragon_core_cost != null && (
                        <span className="text-gold">◆ {d.dragon_core_cost} cores</span>
                      )}
                      {d.average_duration != null && <span>~{d.average_duration} min</span>}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(d.id)}
                  className="text-xs text-[var(--fg-danger)] hover:underline"
                >
                  Delete
                </button>
              </div>
            ))}
            {dungeons?.length === 0 && <p className="text-xs text-muted">No dungeons yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== ITEMS TAB =====
function ItemsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [rarity, setRarity] = useState('common');
  const [defaultPrice, setDefaultPrice] = useState<number | ''>('');
  const [iconUrl, setIconUrl] = useState('');
  const [page, setPage] = useState(1);

  const { data: items, isLoading } = useQuery<Item[]>({
    queryKey: ['admin', 'items'],
    queryFn: () => api.get('/admin/items'),
  });

  const pageCount = Math.max(1, Math.ceil((items?.length ?? 0) / ITEMS_PER_PAGE));
  const pagedItems = items?.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  const createMutation = useMutation({
    mutationFn: (body: { name: string; rarity: string; defaultPrice?: number; iconUrl?: string }) =>
      api.post('/admin/items', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'items'] });
      setName('');
      setDefaultPrice('');
      setIconUrl('');
      toast({ title: 'Item added', variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: 'Could not add item',
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'items'] });
      toast({ title: 'Item deleted', variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: 'Could not delete item',
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        <h3 className="text-sm font-medium text-foreground mb-4">Add Item</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name) return;
            createMutation.mutate({
              name,
              rarity,
              defaultPrice: defaultPrice || undefined,
              iconUrl: iconUrl || undefined,
            });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
              <label className="text-xs font-medium text-muted">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)]"
                placeholder="Dragon Scale"
              />
            </div>
            <div className="flex flex-col gap-1.5 w-32">
              <label className="text-xs font-medium text-muted">Rarity</label>
              <Select
                value={rarity}
                onChange={setRarity}
                options={[
                  { value: 'common', label: 'Common' },
                  { value: 'uncommon', label: 'Uncommon' },
                  { value: 'rare', label: 'Rare' },
                  { value: 'epic', label: 'Epic' },
                  { value: 'legendary', label: 'Legendary' },
                ]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Default Price</label>
              <CurrencyInput
                value={defaultPrice || 0}
                onChange={(v) => setDefaultPrice(v || '')}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Icon</label>
            <ImageUpload currentUrl={iconUrl || null} onUploaded={setIconUrl} />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="self-start rounded-base px-4 py-2 text-sm font-medium text-[#1b1407] bg-[var(--blue)] shadow-button hover:opacity-90 disabled:opacity-50"
          >
            Add
          </button>
        </form>
      </div>

      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        {isLoading ? (
          <p className="text-xs text-muted">Loading...</p>
        ) : (
          <div className="space-y-2">
            {pagedItems?.map((item) => {
              const r = rarityStyle(item.rarity);
              return (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.05)] last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    {item.icon_url ? (
                      <img
                        src={item.icon_url}
                        alt={item.name}
                        className="w-9 h-9 rounded-sm object-cover"
                        style={{ outline: `2px solid ${r.color}`, outlineOffset: '-1px' }}
                      />
                    ) : (
                      <div
                        className="w-9 h-9 rounded-sm"
                        style={{ background: r.soft, outline: `2px solid ${r.color}`, outlineOffset: '-1px' }}
                      />
                    )}
                    <span className="text-sm font-semibold truncate" style={{ color: r.color }}>
                      {item.name}
                    </span>
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0"
                      style={{ color: r.color, background: r.soft }}
                    >
                      {r.label}
                    </span>
                    <span className="shrink-0">
                      <Currency copper={item.default_price ?? 0} className="text-xs" />
                    </span>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(item.id)}
                    className="text-xs text-muted hover:text-[var(--fg-danger)] shrink-0"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
            {items?.length === 0 && <p className="text-xs text-muted">No items yet.</p>}
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}

// ===== CLASSES TAB =====
function ClassesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [parentClass, setParentClass] = useState('');

  const { data: classes, isLoading } = useQuery<GameClass[]>({
    queryKey: ['admin', 'classes'],
    queryFn: () => api.get('/admin/classes'),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; parentClass?: string }) =>
      api.post('/admin/classes', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setName('');
      setParentClass('');
      toast({ title: 'Class added', variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: 'Could not add class',
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/classes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: 'Class deleted', variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: 'Could not delete class',
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  // Base classes (no parent) are offered as parent options.
  const baseClasses = classes?.filter((c) => !c.parent_class) ?? [];

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        <h3 className="text-sm font-medium text-foreground mb-4">Add Class</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name) return;
            createMutation.mutate({ name, parentClass: parentClass || undefined });
          }}
          className="flex items-end gap-3 flex-wrap"
        >
          <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
            <label className="text-xs font-medium text-muted">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)]"
              placeholder="Gladiator"
            />
          </div>
          <div className="flex flex-col gap-1.5 w-44">
            <label className="text-xs font-medium text-muted">Parent Class</label>
            <Select
              value={parentClass}
              onChange={setParentClass}
              options={[
                { value: '', label: 'None (base class)' },
                ...baseClasses.map((c) => ({ value: c.name, label: c.name })),
              ]}
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-base px-4 py-2 text-sm font-medium text-[#1b1407] bg-[var(--blue)] shadow-button hover:opacity-90 disabled:opacity-50"
          >
            Add
          </button>
        </form>
      </div>

      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        {isLoading ? (
          <p className="text-xs text-muted">Loading...</p>
        ) : (
          <div className="space-y-2">
            {classes?.map((cls) => (
              <div
                key={cls.id}
                className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.05)] last:border-0"
              >
                <div>
                  <span className="text-sm text-foreground font-medium">{cls.name}</span>
                  {cls.parent_class ? (
                    <span className="text-xs text-muted ml-2">· {cls.parent_class}</span>
                  ) : (
                    <span className="text-[10px] text-gold ml-2 uppercase tracking-wide">base</span>
                  )}
                </div>
                <button
                  onClick={() => deleteMutation.mutate(cls.id)}
                  className="text-xs text-muted hover:text-[var(--fg-danger)]"
                >
                  Delete
                </button>
              </div>
            ))}
            {classes?.length === 0 && <p className="text-xs text-muted">No classes yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== DONATIONS TAB (read-only ledger) =====
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
};

function DonationsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<Donation | null>(null);

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
      toast({ title: 'Donation deleted', variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: 'Could not delete donation',
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
          <p className="text-[11px] uppercase tracking-wider text-muted mb-2">Total Raised</p>
          <p className="text-2xl font-bold text-gold tabular-nums">{bahtFromSatang(totalRaised)}</p>
        </div>
        <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted mb-2">Successful</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{successCount}</p>
        </div>
        <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted mb-2">Total Records</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{list.length}</p>
        </div>
      </div>

      {/* Ledger */}
      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        {isLoading ? (
          <p className="text-xs text-muted">Loading...</p>
        ) : list.length === 0 ? (
          <p className="text-xs text-muted">No donations yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">Donor</th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">Method</th>
                    <th className="pb-3 pr-3 text-right text-xs font-medium text-muted">Amount</th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">Status</th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">Date</th>
                    <th className="pb-3 text-right text-xs font-medium text-muted"></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-[rgba(255,255,255,0.05)] last:border-0 align-top"
                    >
                      <td className="py-3 pr-3">
                        <p className="text-sm font-medium text-foreground">{d.display_name}</p>
                        {d.message && (
                          <p className="max-w-[240px] truncate text-xs text-muted" title={d.message}>
                            {d.message}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-xs text-muted">{CHANNEL_LABEL[d.channel]}</td>
                      <td className="py-3 pr-3 text-right text-sm font-semibold text-foreground tabular-nums">
                        {bahtFromSatang(d.amount)}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-block rounded-sm px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLE[d.status]}`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-xs text-muted">
                        {new Date(d.created_at).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => setPendingDelete(d)}
                          className="rounded-base p-1.5 text-muted transition-colors hover:text-[var(--fg-danger)] hover:bg-[var(--danger-soft)]"
                          aria-label={`Delete donation from ${d.display_name}`}
                          title="Delete donation"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
        title="Delete this donation?"
        description={
          pendingDelete
            ? `This permanently removes the ${bahtFromSatang(pendingDelete.amount)} record from "${pendingDelete.display_name}". This cannot be undone and does not refund any real payment.`
            : undefined
        }
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </div>
  );
}

