'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/image-upload';
import { rarityStyle } from '@/lib/rarity';
import { Pagination } from '@/components/pagination';
import { useToast } from '@/components/toast';
import { Currency, CurrencyInput } from '@/components/currency';
import { Select } from '@/components/select';
import type { Item } from '@/types';
import { ITEMS_PER_PAGE } from './shared';

export function ItemsTab() {
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
