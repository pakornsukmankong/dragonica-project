'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
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
