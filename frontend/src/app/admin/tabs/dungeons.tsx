'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/image-upload';
import { useToast } from '@/components/toast';
import type { Dungeon } from '@/types';

export function DungeonsTab() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  // Which dungeon row is in image-edit mode (null = none).
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const updateImageMutation = useMutation({
    mutationFn: ({ id, imageUrl }: { id: string; imageUrl: string }) =>
      api.patch(`/admin/dungeons/${id}`, { imageUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dungeons'] });
      // The grind page reads the same dungeons through /game-data.
      queryClient.invalidateQueries({ queryKey: ['game-data', 'dungeons'] });
      setEditingId(null);
      toast({ title: t('toastDungeonUpdated'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('toastDungeonUpdateError'),
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
              <div key={d.id} className="py-2 border-b border-[rgba(255,255,255,0.05)] last:border-0">
                <div className="flex items-center justify-between">
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
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() =>
                        setEditingId(editingId === d.id ? null : d.id)
                      }
                      className="text-xs text-[var(--blue)] hover:underline"
                    >
                      {editingId === d.id ? tc('cancel') : t('editImage')}
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(d.id)}
                      className="text-xs text-[var(--fg-danger)] hover:underline"
                    >
                      {tc('delete')}
                    </button>
                  </div>
                </div>
                {editingId === d.id && (
                  <div className="mt-3 pl-11">
                    {/* Saves as soon as the upload finishes */}
                    <ImageUpload
                      currentUrl={d.image_url}
                      onUploaded={(url) =>
                        updateImageMutation.mutate({ id: d.id, imageUrl: url })
                      }
                    />
                    {updateImageMutation.isPending && (
                      <p className="mt-2 text-xs text-muted">{tc('saving')}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {dungeons?.length === 0 && <p className="text-xs text-muted">{t('noDungeons')}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
