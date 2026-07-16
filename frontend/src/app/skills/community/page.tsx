'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { m } from 'motion/react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Search,
  Loader2,
  ChevronRight,
  User,
  Calendar,
  Heart,
  Eye,
  MessageSquare,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/skeleton';
import { QueryError } from '@/components/query-error';
import type { CommunityBuildList, SkillClass } from '@/types';

function CommunityInner() {
  const t = useTranslations('skills');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [classId, setClassId] = useState<number | ''>('');
  const [sort, setSort] = useState<'newest' | 'popular'>('newest');
  const [page, setPage] = useState(1);

  const { data: classes } = useQuery<SkillClass[]>({
    queryKey: ['skills', 'classes'],
    queryFn: () => api.get('/skills/classes'),
    staleTime: Infinity,
  });

  const { data, isLoading, isError, isFetching, isPaused, refetch } = useQuery<CommunityBuildList>({
    queryKey: ['skills', 'community', query, classId, sort, page],
    queryFn: () => {
      const p = new URLSearchParams();
      if (query) p.set('search', query);
      if (classId) p.set('classId', String(classId));
      if (sort !== 'newest') p.set('sort', sort);
      p.set('page', String(page));
      return api.get(`/skills/community?${p.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  const builds = data?.builds ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(search);
  };

  return (
    <main className="mx-auto max-w-container px-4 py-8 sm:px-7">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-foreground laptop:text-2xl">
            {t('communityTitle')}
          </h1>
          <p className="mt-2 text-sm text-muted">{t('communitySubtitle')}</p>
        </div>
        <Link
          href="/skills"
          className="text-sm text-muted transition-colors hover:text-gold"
        >
          {t('backToClasses')}
        </Link>
      </header>

      {/* controls */}
      <div className="mb-6 flex flex-wrap gap-3">
        <form onSubmit={submitSearch} className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchBuilds')}
            className="w-full rounded-base border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-gold/50"
          />
        </form>
        <select
          value={classId}
          onChange={(e) => {
            setPage(1);
            setClassId(e.target.value ? Number(e.target.value) : '');
          }}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
        >
          <option value="">{t('allClasses')}</option>
          {(classes ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => {
            setPage(1);
            setSort(e.target.value as 'newest' | 'popular');
          }}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
        >
          <option value="newest">{t('sortNewest')}</option>
          <option value="popular">{t('sortPopular')}</option>
        </select>
      </div>

      {isLoading ? (
        // card-shaped shimmer placeholders in the same grid as the results
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex h-full flex-col rounded-base border border-border bg-raised p-4"
            >
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/3" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-1.5 h-3 w-2/3" />
              <div className="mt-auto border-t border-border pt-3">
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : isError || isPaused ? (
        <QueryError
          offline={isPaused}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      ) : builds.length === 0 ? (
        <div className="rounded-base border border-border bg-raised py-16 text-center text-sm text-muted">
          {t('noPublicBuilds')}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {builds.map((b, i) => (
              <m.div
                key={b.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3 }}
                transition={{
                  duration: 0.3,
                  delay: Math.min(i * 0.04, 0.4),
                  ease: 'easeOut',
                }}
                className="h-full"
              >
              <Link
                href={`/skills/build/${b.share_slug}`}
                className="group flex h-full flex-col rounded-base border border-border bg-raised p-4 transition-colors hover:border-gold/50"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                    {b.name}
                  </h3>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="mb-2 text-xs font-medium text-gold">
                  {b.skill_classes?.name ?? `#${b.class_id}`}
                </div>
                {b.description && (
                  <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted">
                    {b.description}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-dark-gray">
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {b.profiles?.username ?? 'Anonymous'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(b.created_at).toLocaleDateString()}
                  </span>
                  <span className="ml-auto rounded-full bg-gold-soft px-2 py-0.5 font-semibold text-gold">
                    Lv {b.char_level}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3 border-t border-border pt-2 text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1" title={t('likes')}>
                    <Heart className="h-3 w-3" />
                    <span className="tabular-nums">{b.like_count ?? 0}</span>
                  </span>
                  <span className="inline-flex items-center gap-1" title={t('views')}>
                    <Eye className="h-3 w-3" />
                    <span className="tabular-nums">{b.view_count ?? 0}</span>
                  </span>
                  <span className="inline-flex items-center gap-1" title={t('comments')}>
                    <MessageSquare className="h-3 w-3" />
                    <span className="tabular-nums">{b.comment_count ?? 0}</span>
                  </span>
                </div>
              </Link>
              </m.div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3 text-sm">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-base border border-border px-3 py-1.5 text-muted transition-colors hover:text-foreground disabled:opacity-40"
              >
                {t('prev')}
              </button>
              <span className="text-muted tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-base border border-border px-3 py-1.5 text-muted transition-colors hover:text-foreground disabled:opacity-40"
              >
                {t('next')}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default function CommunityPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      }
    >
      <CommunityInner />
    </Suspense>
  );
}
