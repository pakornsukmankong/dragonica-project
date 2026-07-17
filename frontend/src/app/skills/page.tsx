'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as Accordion from '@radix-ui/react-accordion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  ChevronDown,
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
import { QueryError } from '@/components/query-error';
import { Switch } from '@/components/switch';
import { useHasSession } from '@/hooks/use-session';
import type { SkillClass, SkillBuild } from '@/types';

// Job icon per stage name; files in /public/class-icons (Dragon Saga wiki,
// mapped by tier position to the Landverse names).
const stageIcon = (stage: string) =>
  `/class-icons/${stage.trim().toLowerCase().replace(/\s+/g, '-')}.webp`;

const BUILDS_SECTION = 'myBuilds';
const BUILDS_COLLAPSED_KEY = 'skills:my-builds-collapsed';

export default function SkillsPage() {
  const t = useTranslations('skills');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<SkillBuild | null>(null);

  // Collapsing is worth remembering: a build list long enough to bury the class
  // grid is long on every visit. Read lazily — the section only renders once the
  // client has fetched builds, so this never runs against the server's HTML.
  const [buildsOpen, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(BUILDS_COLLAPSED_KEY) !== '1';
  });
  const setBuildsOpen = (open: boolean) => {
    window.localStorage.setItem(BUILDS_COLLAPSED_KEY, open ? '0' : '1');
    setOpen(open);
  };

  const {
    data: classes,
    isLoading,
    isError,
    isFetching,
    isPaused,
    refetch,
  } = useQuery<SkillClass[]>({
    queryKey: ['skills', 'classes'],
    queryFn: () => api.get('/skills/classes'),
    staleTime: Infinity,
  });

  // Guests have no builds — skip the request instead of collecting a 401.
  const { hasSession } = useHasSession();
  const { data: builds, isLoading: buildsLoading } = useQuery<SkillBuild[]>({
    queryKey: ['skills', 'me', 'builds'],
    queryFn: () => api.get('/skills/me/builds'),
    enabled: hasSession,
    retry: false,
  });

  const visibilityMut = useMutation({
    mutationFn: ({
      id,
      visibility,
    }: {
      id: string;
      visibility: SkillBuild['visibility'];
    }) => api.patch(`/skills/builds/${id}/visibility`, { visibility }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills', 'me', 'builds'] });
      queryClient.invalidateQueries({ queryKey: ['skills', 'community'] });
      toast({ title: t('updated'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('saveError'),
        description: (e as Error).message,
        variant: 'error',
      }),
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
          className="inline-flex items-center gap-1.5 rounded-base bg-gold-soft px-3 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/25 hover:text-gold-strong"
        >
          <Users className="h-4 w-4" />
          {t('communityTitle')}
        </Link>
      </header>

      {/* Opening a build you already own is the repeat visit; picking a class is
          a one-off on the way to a new one. Reserve the row while it loads so
          the class grid below doesn't jump once the builds arrive. */}
      {hasSession && buildsLoading ? (
        <section className="mb-4" aria-hidden>
          <div className="h-[68px] animate-pulse rounded-base bg-surface" />
        </section>
      ) : builds && builds.length > 0 ? (
        <section className="mb-4">
          <Accordion.Root
            type="multiple"
            value={buildsOpen ? [BUILDS_SECTION] : []}
            onValueChange={(open) => setBuildsOpen(open.includes(BUILDS_SECTION))}
          >
            <Accordion.Item
              value={BUILDS_SECTION}
              className="overflow-hidden rounded-base bg-surface outline outline-1 outline-[rgba(255,255,255,0.08)]"
            >
              <Accordion.Header>
                <Accordion.Trigger className="group flex w-full items-center gap-3 p-4 text-left outline-none transition-colors hover:bg-raised">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base bg-gold-soft text-xs font-bold text-gold tabular-nums">
                    {builds.length}
                  </span>
                  <h2 className="flex-1 text-base font-semibold text-foreground">
                    {t('myBuilds')}
                  </h2>
                  <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="accordion-content overflow-hidden">
                <div className="space-y-2 px-4 pb-4 pt-2">
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
                            <span className="tabular-nums">
                              {b.like_count ?? 0}
                            </span>
                          </span>
                          <span
                            className="inline-flex items-center gap-1"
                            title={t('views')}
                          >
                            <Eye className="h-3 w-3" />
                            <span className="tabular-nums">
                              {b.view_count ?? 0}
                            </span>
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
                      {/* Sharing used to mean opening the editor and saving the
                          whole build again; from here it is the one flag. */}
                      <Switch
                        checked={b.visibility === 'public'}
                        onCheckedChange={(checked) =>
                          visibilityMut.mutate({
                            id: b.id,
                            visibility: checked ? 'public' : 'unlisted',
                          })
                        }
                        disabled={visibilityMut.isPending}
                        title={t('shareToCommunityHint')}
                        label={t('shareToCommunity')}
                        labelClassName="sr-only sm:not-sr-only"
                      />
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
              </Accordion.Content>
            </Accordion.Item>
          </Accordion.Root>
        </section>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : isError || isPaused ? (
        <QueryError
          offline={isPaused}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
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
