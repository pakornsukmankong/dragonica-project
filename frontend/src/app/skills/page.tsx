'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  ChevronRight,
  Loader2,
  Users,
  Pencil,
  Trash2,
  Globe,
  Heart,
  Eye,
  MessageSquare,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import type { SkillClass, SkillBuild } from '@/types';

// Job icon per stage name; files in /public/class-icons (Dragon Saga wiki,
// mapped by tier position to the Landverse names).
const stageIcon = (stage: string) =>
  `/class-icons/${stage.trim().toLowerCase().replace(/\s+/g, '-')}.webp`;

export default function SkillsPage() {
  const t = useTranslations('skills');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<SkillBuild | null>(null);

  const { data: classes, isLoading } = useQuery<SkillClass[]>({
    queryKey: ['skills', 'classes'],
    queryFn: () => api.get('/skills/classes'),
    staleTime: Infinity,
  });

  const { data: builds } = useQuery<SkillBuild[]>({
    queryKey: ['skills', 'me', 'builds'],
    queryFn: () => api.get('/skills/me/builds'),
    retry: false,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/skills/builds/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills', 'me', 'builds'] });
      toast({ title: t('deleted'), variant: 'success' });
      setPendingDelete(null);
    },
    onError: (e) =>
      toast({
        title: t('deleteError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const grouped = (classes ?? []).reduce<Record<string, SkillClass[]>>(
    (acc, c) => {
      (acc[c.base_class] ??= []).push(c);
      return acc;
    },
    {},
  );

  return (
    <main className="mx-auto max-w-container px-4 py-8 sm:px-7">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-foreground laptop:text-2xl">
            {t('title')}
          </h1>
          <p className="mt-2 text-sm text-muted">{t('subtitle')}</p>
        </div>
        <Link
          href="/skills/community"
          className="inline-flex items-center gap-1.5 rounded-base border border-gold/40 bg-gold-soft px-3 py-2 text-sm font-medium text-gold transition-colors hover:border-gold/70"
        >
          <Users className="h-4 w-4" />
          {t('communityTitle')}
        </Link>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([base, list]) => (
            <section key={base}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                {base}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {list.map((c) => (
                  <Link
                    key={c.id}
                    href={`/skills/${c.id}`}
                    className="group flex h-full items-center gap-3 rounded-base border border-border bg-raised p-4 transition-colors hover:border-gold/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-semibold leading-snug text-foreground">
                        {c.name.split('→').map((stage, i) => (
                          <span
                            key={stage}
                            className="inline-flex items-center gap-1.5"
                          >
                            {i > 0 && (
                              <span className="font-normal text-muted">→</span>
                            )}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={stageIcon(stage)}
                              alt=""
                              draggable={false}
                              className="h-6 w-6 shrink-0 transition-transform duration-200 group-hover:scale-110"
                            />
                            {stage.trim()}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1 text-xs text-muted">{base}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {builds && builds.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            {t('myBuilds')}
          </h2>
          <div className="space-y-2">
            {builds.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-base border border-border bg-raised px-4 py-3 transition-colors hover:border-gold/40"
              >
                <Link
                  href={`/skills/build/${b.share_slug}`}
                  className="min-w-0 flex-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {b.name}
                    </span>
                    {b.visibility === 'public' && (
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold-soft px-1.5 py-0.5 text-[10px] font-medium text-gold"
                        title={t('sharedToCommunity')}
                      >
                        <Globe className="h-2.5 w-2.5" /> {t('community')}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span>
                      {t('charLevel')} {b.char_level}
                    </span>
                    <span
                      className="inline-flex items-center gap-1"
                      title={t('likes')}
                    >
                      <Heart className="h-3 w-3" />
                      <span className="tabular-nums">{b.like_count ?? 0}</span>
                    </span>
                    <span
                      className="inline-flex items-center gap-1"
                      title={t('views')}
                    >
                      <Eye className="h-3 w-3" />
                      <span className="tabular-nums">{b.view_count ?? 0}</span>
                    </span>
                    <span
                      className="inline-flex items-center gap-1"
                      title={t('comments')}
                    >
                      <MessageSquare className="h-3 w-3" />
                      <span className="tabular-nums">
                        {b.comment_count ?? 0}
                      </span>
                    </span>
                  </div>
                </Link>
                <Link
                  href={`/skills/${b.class_id}?edit=${b.share_slug}`}
                  title={t('edit')}
                  className="flex items-center gap-1.5 rounded-base border border-border px-2.5 py-1.5 text-xs text-foreground transition-colors hover:border-gold/50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('edit')}</span>
                </Link>
                <button
                  onClick={() => setPendingDelete(b)}
                  title={t('delete')}
                  className="flex items-center gap-1.5 rounded-base border border-[var(--border-danger)] px-2.5 py-1.5 text-xs text-[var(--fg-danger)] transition-colors hover:bg-[var(--danger-soft)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('delete')}</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('deleteBuildTitle')}
        description={t('deleteBuildConfirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        danger
        loading={deleteMut.isPending}
        onConfirm={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
      />
    </main>
  );
}
