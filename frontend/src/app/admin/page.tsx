'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as Tabs from '@radix-ui/react-tabs';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/image-upload';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { rarityStyle } from '@/lib/rarity';
import { Pagination } from '@/components/pagination';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { useDateFormatter } from '@/lib/i18n';
import {
  Trash2,
  ChevronLeft,
  ChevronDown,
  Send,
  Pencil,
  Check,
  X,
  Eye,
  EyeOff,
  Heart,
  MessageSquare,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { Currency, CurrencyInput } from '@/components/currency';
import { Select } from '@/components/select';
import { TicketStatusBadge } from '@/components/ticket-status';
import { TicketThread } from '@/components/ticket-thread';
import type {
  Dungeon,
  Item,
  GameClass,
  Donation,
  Ticket,
  TicketStatus,
  AdminUser,
  AdminSkillBuild,
  BuildComment,
  Session,
  Character,
} from '@/types';

const ITEMS_PER_PAGE = 10;

const TABS = [
  { value: 'dungeons', Tab: DungeonsTab },
  { value: 'items', Tab: ItemsTab },
  { value: 'classes', Tab: ClassesTab },
  { value: 'users', Tab: UsersTab },
  { value: 'skillBuilds', Tab: SkillBuildsTab },
  { value: 'donations', Tab: DonationsTab },
  { value: 'tickets', Tab: TicketsTab },
] as const;

export default function AdminPage() {
  const t = useTranslations('admin');
  const { isAdmin, isLoading: isRoleLoading } = useIsAdmin();

  if (isRoleLoading) {
    return (
      <div className="min-h-screen bg-root flex items-center justify-center">
        <p className="text-sm text-muted">{t('checkingPermissions')}</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-root flex items-center justify-center">
        <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-8 text-center max-w-sm">
          <p className="text-sm font-medium text-foreground mb-2">{t('accessDenied')}</p>
          <p className="text-xs text-muted">{t('accessDeniedDesc')}</p>
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
              {t('title')}
            </h1>
            <p className="text-sm text-muted mt-2">
              {t('subtitle')}
            </p>
          </div>

          <Tabs.Root defaultValue="dungeons">
            <Tabs.List className="mb-8 flex w-fit max-w-full flex-wrap items-center gap-2 rounded-base border border-border bg-raised p-2">
              {TABS.map(({ value }) => (
                <Tabs.Trigger
                  key={value}
                  value={value}
                  className="rounded-sm px-5 py-2.5 text-xs font-semibold tracking-wide text-muted outline-none transition-all duration-150 hover:bg-surface hover:text-foreground data-[state=active]:bg-gold-soft data-[state=active]:text-gold data-[state=active]:shadow-[inset_0_0_0_1px_rgba(224,165,60,0.35)]"
                >
                  {t(`tab${value.charAt(0).toUpperCase()}${value.slice(1)}`)}
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
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const { data: dungeons, isLoading } = useQuery<Dungeon[]>({
    queryKey: ['admin', 'dungeons'],
    queryFn: () => api.get('/admin/dungeons'),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; imageUrl?: string }) =>
      api.post('/admin/dungeons', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dungeons'] });
      setName('');
      setImageUrl('');
      toast({ title: t('toastDungeonAdded'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('toastDungeonAddError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/dungeons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dungeons'] });
      toast({ title: t('toastDungeonDeleted'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('toastDungeonDeleteError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        <h3 className="text-sm font-medium text-foreground mb-4">{t('addDungeon')}</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name) return;
            createMutation.mutate({
              name,
              imageUrl: imageUrl || undefined,
            });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
              <label className="text-xs font-medium text-muted">{t('name')}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)]"
                placeholder={t('dungeonNamePlaceholder')}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">{t('image')}</label>
            <ImageUpload currentUrl={imageUrl || null} onUploaded={setImageUrl} />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="self-start rounded-base px-4 py-2 text-sm font-medium text-[#1b1407] bg-[var(--blue)] shadow-button hover:opacity-90 disabled:opacity-50"
          >
            {t('add')}
          </button>
        </form>
      </div>

      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        {isLoading ? (
          <p className="text-xs text-muted">{tc('loading')}</p>
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
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(d.id)}
                  className="text-xs text-[var(--fg-danger)] hover:underline"
                >
                  {tc('delete')}
                </button>
              </div>
            ))}
            {dungeons?.length === 0 && <p className="text-xs text-muted">{t('noDungeons')}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== ITEMS TAB =====
function ItemsTab() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const tr = useTranslations('rarity');
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
      toast({ title: t('toastItemAdded'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('toastItemAddError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'items'] });
      toast({ title: t('toastItemDeleted'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('toastItemDeleteError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        <h3 className="text-sm font-medium text-foreground mb-4">{t('addItem')}</h3>
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
              <label className="text-xs font-medium text-muted">{t('name')}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)]"
                placeholder={t('itemNamePlaceholder')}
              />
            </div>
            <div className="flex flex-col gap-1.5 w-32">
              <label className="text-xs font-medium text-muted">{t('rarity')}</label>
              <Select
                value={rarity}
                onChange={setRarity}
                options={[
                  { value: 'common', label: tr('common') },
                  { value: 'uncommon', label: tr('uncommon') },
                  { value: 'rare', label: tr('rare') },
                  { value: 'epic', label: tr('epic') },
                  { value: 'legendary', label: tr('legendary') },
                ]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">{t('defaultPrice')}</label>
              <CurrencyInput
                value={defaultPrice || 0}
                onChange={(v) => setDefaultPrice(v || '')}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">{t('icon')}</label>
            <ImageUpload currentUrl={iconUrl || null} onUploaded={setIconUrl} />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="self-start rounded-base px-4 py-2 text-sm font-medium text-[#1b1407] bg-[var(--blue)] shadow-button hover:opacity-90 disabled:opacity-50"
          >
            {t('add')}
          </button>
        </form>
      </div>

      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        {isLoading ? (
          <p className="text-xs text-muted">{tc('loading')}</p>
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
                      {item.rarity ? tr(item.rarity) : r.label}
                    </span>
                    <span className="shrink-0">
                      <Currency copper={item.default_price ?? 0} className="text-xs" />
                    </span>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(item.id)}
                    className="text-xs text-muted hover:text-[var(--fg-danger)] shrink-0"
                  >
                    {tc('delete')}
                  </button>
                </div>
              );
            })}
            {items?.length === 0 && <p className="text-xs text-muted">{t('noItems')}</p>}
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}

// ===== CLASSES TAB =====
function ClassesTab() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
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
      toast({ title: t('toastClassAdded'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('toastClassAddError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/classes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: t('toastClassDeleted'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('toastClassDeleteError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  // Base classes (no parent) are offered as parent options.
  const baseClasses = classes?.filter((c) => !c.parent_class) ?? [];

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        <h3 className="text-sm font-medium text-foreground mb-4">{t('addClass')}</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name) return;
            createMutation.mutate({ name, parentClass: parentClass || undefined });
          }}
          className="flex items-end gap-3 flex-wrap"
        >
          <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
            <label className="text-xs font-medium text-muted">{t('name')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)]"
              placeholder={t('classNamePlaceholder')}
            />
          </div>
          <div className="flex flex-col gap-1.5 w-56">
            <label className="text-xs font-medium text-muted">{t('parentClass')}</label>
            <Select
              value={parentClass}
              onChange={setParentClass}
              options={[
                { value: '', label: t('parentNone') },
                ...baseClasses.map((c) => ({ value: c.name, label: c.name })),
              ]}
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-base px-4 py-2 text-sm font-medium text-[#1b1407] bg-[var(--blue)] shadow-button hover:opacity-90 disabled:opacity-50"
          >
            {t('add')}
          </button>
        </form>
      </div>

      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        {isLoading ? (
          <p className="text-xs text-muted">{tc('loading')}</p>
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
                    <span className="text-[10px] text-gold ml-2 uppercase tracking-wide">{t('base')}</span>
                  )}
                </div>
                <button
                  onClick={() => deleteMutation.mutate(cls.id)}
                  className="text-xs text-muted hover:text-[var(--fg-danger)]"
                >
                  {tc('delete')}
                </button>
              </div>
            ))}
            {classes?.length === 0 && <p className="text-xs text-muted">{t('noClasses')}</p>}
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

function DonationsTab() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<Donation | null>(null);
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
                        <p className="text-sm font-medium text-foreground">{d.display_name}</p>
                        {d.message && (
                          <p className="max-w-[240px] truncate text-xs text-muted" title={d.message}>
                            {d.message}
                          </p>
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


// ===== USERS TAB =====
function UsersTab() {
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

// ===== TICKETS TAB =====
const TICKET_STATUSES: TicketStatus[] = [
  'open',
  'in_progress',
  'resolved',
  'closed',
];

function TicketsTab() {
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

function SkillBuildsTab() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const formatDate = useDateFormatter();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVisibility, setEditVisibility] = useState<'public' | 'unlisted'>(
    'unlisted',
  );
  const [pendingDelete, setPendingDelete] = useState<AdminSkillBuild | null>(
    null,
  );

  const { data: builds, isLoading } = useQuery<AdminSkillBuild[]>({
    queryKey: ['admin', 'skill-builds'],
    queryFn: () => api.get('/admin/skill-builds'),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'skill-builds'] });
    // the public gallery and share pages read the same rows
    queryClient.invalidateQueries({ queryKey: ['skills', 'community'] });
    queryClient.invalidateQueries({ queryKey: ['skills', 'build'] });
  };

  const updateMut = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/admin/skill-builds/${id}`, {
        name: editName.trim() || undefined,
        description: editDescription,
        visibility: editVisibility,
      }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      toast({ title: t('buildUpdated'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('buildUpdateError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/skill-builds/${id}`),
    onSuccess: () => {
      setPendingDelete(null);
      invalidate();
      toast({ title: t('buildDeleted'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('buildDeleteError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const list = (builds ?? []).filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      (b.profiles?.username ?? '').toLowerCase().includes(q)
    );
  });
  const pageCount = Math.max(1, Math.ceil(list.length / ITEMS_PER_PAGE));
  const paged = list.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const startEdit = (b: AdminSkillBuild) => {
    setEditingId(b.id);
    setEditName(b.name);
    setEditDescription(b.description ?? '');
    setEditVisibility(b.visibility);
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted mb-2">
            {t('buildsTotal')}
          </p>
          <p className="text-2xl font-bold text-gold tabular-nums">
            {(builds ?? []).length}
          </p>
        </div>
        <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted mb-2">
            {t('buildsPublic')}
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {(builds ?? []).filter((b) => b.visibility === 'public').length}
          </p>
        </div>
      </div>

      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        <input
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder={t('buildSearchPlaceholder')}
          className="mb-4 w-full max-w-sm rounded-base border border-border bg-raised px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
        />
        {isLoading ? (
          <p className="text-xs text-muted">{tc('loading')}</p>
        ) : list.length === 0 ? (
          <p className="text-xs text-muted">{t('buildsNone')}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t('colBuild')}
                    </th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t('colAuthor')}
                    </th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t('colVisibility')}
                    </th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t('colStats')}
                    </th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t('colCreated')}
                    </th>
                    <th className="pb-3 text-right text-xs font-medium text-muted"></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((b) => {
                    const expanded = expandedId === b.id;
                    const editing = editingId === b.id;
                    return (
                      <Fragment key={b.id}>
                        <tr className="border-b border-[rgba(255,255,255,0.05)] align-top">
                          <td className="py-3 pr-3">
                            <p className="max-w-[240px] truncate text-sm font-medium text-foreground">
                              {b.name}
                            </p>
                            <p className="text-xs text-muted">
                              {b.skill_classes?.name ?? `#${b.class_id}`} · Lv{' '}
                              {b.char_level}
                            </p>
                          </td>
                          <td className="py-3 pr-3 text-sm text-foreground">
                            {b.profiles?.username || '—'}
                          </td>
                          <td className="py-3 pr-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-medium ${
                                b.visibility === 'public'
                                  ? 'bg-gold-soft text-gold'
                                  : 'bg-raised text-muted'
                              }`}
                            >
                              {b.visibility === 'public' ? (
                                <Globe className="h-3 w-3" />
                              ) : (
                                <EyeOff className="h-3 w-3" />
                              )}
                              {b.visibility === 'public'
                                ? t('visPublic')
                                : t('visUnlisted')}
                            </span>
                          </td>
                          <td className="py-3 pr-3">
                            <span className="inline-flex items-center gap-3 text-xs text-muted">
                              <span className="inline-flex items-center gap-1">
                                <Heart className="h-3 w-3" />
                                <span className="tabular-nums">
                                  {b.like_count}
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                <span className="tabular-nums">
                                  {b.view_count}
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                <span className="tabular-nums">
                                  {b.comment_count}
                                </span>
                              </span>
                            </span>
                          </td>
                          <td className="py-3 pr-3 text-xs text-muted">
                            {formatDate(b.created_at, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Link
                                href={`/skills/build/${b.share_slug}`}
                                target="_blank"
                                title={t('openBuild')}
                                className="inline-flex items-center rounded-base border border-border p-1.5 text-muted transition-colors hover:text-foreground"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                              <button
                                onClick={() =>
                                  setExpandedId(expanded ? null : b.id)
                                }
                                title={t('viewBuildComments')}
                                className={`inline-flex items-center gap-1 rounded-base border border-border px-2 py-1.5 text-xs transition-colors ${
                                  expanded
                                    ? 'text-gold'
                                    : 'text-muted hover:text-foreground'
                                }`}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                <span className="tabular-nums">
                                  {b.comment_count}
                                </span>
                              </button>
                              <button
                                onClick={() =>
                                  editing ? setEditingId(null) : startEdit(b)
                                }
                                title={tc('edit')}
                                className={`inline-flex items-center rounded-base border border-border p-1.5 transition-colors ${
                                  editing
                                    ? 'text-gold'
                                    : 'text-muted hover:text-foreground'
                                }`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setPendingDelete(b)}
                                title={tc('delete')}
                                className="inline-flex items-center rounded-base border border-[var(--border-danger)] p-1.5 text-[var(--fg-danger)] transition-colors hover:bg-[var(--danger-soft)]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {editing && (
                          <tr>
                            <td colSpan={6} className="pb-4">
                              <div className="space-y-2 rounded-base border border-border bg-raised p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    value={editName}
                                    onChange={(e) =>
                                      setEditName(e.target.value)
                                    }
                                    maxLength={60}
                                    className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50 sm:w-64"
                                  />
                                  <Select
                                    value={editVisibility}
                                    onChange={(v) =>
                                      setEditVisibility(
                                        v as 'public' | 'unlisted',
                                      )
                                    }
                                    options={[
                                      { value: 'public', label: t('visPublic') },
                                      {
                                        value: 'unlisted',
                                        label: t('visUnlisted'),
                                      },
                                    ]}
                                    className="w-52"
                                  />
                                  <div className="ml-auto flex items-center gap-2">
                                    <button
                                      onClick={() => setEditingId(null)}
                                      className="rounded-base border border-border px-3 py-2 text-xs text-muted transition-colors hover:text-foreground"
                                    >
                                      {tc('cancel')}
                                    </button>
                                    <button
                                      onClick={() => updateMut.mutate(b.id)}
                                      disabled={
                                        updateMut.isPending || !editName.trim()
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-base bg-gold px-4 py-2 text-xs font-semibold text-[#1b1407] shadow-button transition-opacity hover:opacity-90 disabled:opacity-40"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                      {updateMut.isPending
                                        ? tc('saving')
                                        : tc('save')}
                                    </button>
                                  </div>
                                </div>
                                <textarea
                                  value={editDescription}
                                  onChange={(e) =>
                                    setEditDescription(e.target.value)
                                  }
                                  maxLength={2000}
                                  rows={2}
                                  className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                        {expanded && (
                          <tr>
                            <td colSpan={6} className="pb-4">
                              <AdminBuildComments buildId={b.id} />
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

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('deleteBuildTitle')}
        description={t('deleteBuildDesc', { name: pendingDelete?.name ?? '' })}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        danger
        loading={deleteMut.isPending}
        onConfirm={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
      />
    </div>
  );
}

// Comment list under an expanded build row, with per-comment delete (the
// shared DELETE /skills/comments/:id lets admins remove anyone's comment).
function AdminBuildComments({ buildId }: { buildId: string }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const formatDate = useDateFormatter();
  const [pendingDelete, setPendingDelete] = useState<BuildComment | null>(null);

  const { data: comments, isLoading } = useQuery<BuildComment[]>({
    queryKey: ['admin', 'skill-builds', buildId, 'comments'],
    queryFn: () => api.get(`/admin/skill-builds/${buildId}/comments`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/skills/comments/${id}`),
    onSuccess: () => {
      setPendingDelete(null);
      queryClient.invalidateQueries({
        queryKey: ['admin', 'skill-builds', buildId, 'comments'],
      });
      // comment_count on the build row changed
      queryClient.invalidateQueries({ queryKey: ['admin', 'skill-builds'] });
      toast({ title: t('buildCommentDeleted'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('buildCommentDeleteError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  return (
    <div className="rounded-base border border-border bg-raised p-4">
      {isLoading ? (
        <p className="text-xs text-muted">{tc('loading')}</p>
      ) : !comments || comments.length === 0 ? (
        <p className="text-xs text-muted">{t('buildCommentsNone')}</p>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div
              key={c.id}
              className="flex items-start justify-between gap-3 rounded-base bg-surface px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-[11px] text-muted">
                  <span className="font-medium text-gold">
                    {c.profiles?.username ?? 'Anonymous'}
                  </span>{' '}
                  ·{' '}
                  {formatDate(c.created_at, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                  {c.body}
                </p>
              </div>
              <button
                onClick={() => setPendingDelete(c)}
                title={tc('delete')}
                className="shrink-0 rounded-base border border-[var(--border-danger)] p-1.5 text-[var(--fg-danger)] transition-colors hover:bg-[var(--danger-soft)]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('deleteBuildCommentTitle')}
        description={t('deleteBuildCommentDesc')}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        danger
        loading={deleteMut.isPending}
        onConfirm={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
      />
    </div>
  );
}
