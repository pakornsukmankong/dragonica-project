'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/image-upload';
import { useToast } from '@/components/toast';
import { Select } from '@/components/select';
import type { GameClass } from '@/types';

export function ClassesTab() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [parentClass, setParentClass] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  // Which class row is in edit mode (null = none), and its name draft.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const { data: classes, isLoading } = useQuery<GameClass[]>({
    queryKey: ['admin', 'classes'],
    queryFn: () => api.get('/admin/classes'),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; parentClass?: string; imageUrl?: string }) =>
      api.post('/admin/classes', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setName('');
      setParentClass('');
      setImageUrl('');
      toast({ title: t('toastClassAdded'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('toastClassAddError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      imageUrl?: string;
    }) => api.patch(`/admin/classes/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] });
      // The character form reads the same classes through /game-data.
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setEditingId(null);
      toast({ title: t('toastClassUpdated'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('toastClassUpdateError'),
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
            createMutation.mutate({
              name,
              parentClass: parentClass || undefined,
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
            {classes?.map((cls) => (
              <div
                key={cls.id}
                className="py-2 border-b border-[rgba(255,255,255,0.05)] last:border-0"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {cls.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- dynamic storage URL thumbnail; not worth next/image optimization
                      <img src={cls.image_url} alt={cls.name} className="w-8 h-8 rounded-sm object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-sm bg-raised" />
                    )}
                    <div>
                      <span className="text-sm text-foreground font-medium">{cls.name}</span>
                      {cls.parent_class ? (
                        <span className="text-xs text-muted ml-2">· {cls.parent_class}</span>
                      ) : (
                        <span className="text-[10px] text-gold ml-2 uppercase tracking-wide">{t('base')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => {
                        setEditingId(editingId === cls.id ? null : cls.id);
                        setEditName(cls.name);
                      }}
                      className="text-xs text-[var(--blue)] hover:underline"
                    >
                      {editingId === cls.id ? tc('cancel') : tc('edit')}
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(cls.id)}
                      className="text-xs text-muted hover:text-[var(--fg-danger)]"
                    >
                      {tc('delete')}
                    </button>
                  </div>
                </div>
                {editingId === cls.id && (
                  <div className="mt-3 pl-11 space-y-3">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const next = editName.trim();
                        if (!next || next === cls.name) return;
                        updateMutation.mutate({ id: cls.id, name: next });
                      }}
                      className="flex items-end gap-3"
                    >
                      <div className="flex flex-col gap-1.5 w-56">
                        <label className="text-xs font-medium text-muted">{t('name')}</label>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                          className="rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={
                          updateMutation.isPending ||
                          !editName.trim() ||
                          editName.trim() === cls.name
                        }
                        className="rounded-base px-4 py-2 text-sm font-medium text-[#1b1407] bg-[var(--blue)] shadow-button hover:opacity-90 disabled:opacity-50"
                      >
                        {tc('save')}
                      </button>
                    </form>
                    {/* Image saves as soon as the upload finishes */}
                    <ImageUpload
                      currentUrl={cls.image_url}
                      onUploaded={(url) =>
                        updateMutation.mutate({ id: cls.id, imageUrl: url })
                      }
                    />
                    {updateMutation.isPending && (
                      <p className="mt-2 text-xs text-muted">{tc('saving')}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {classes?.length === 0 && <p className="text-xs text-muted">{t('noClasses')}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
