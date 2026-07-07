'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { m } from 'motion/react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useDateFormatter } from '@/lib/i18n';
import { Coins, Clock, TrendingUp, MapPin } from 'lucide-react';
import type { Session } from '@/types';
import { GoldChart } from '@/components/gold-chart';
import { CharacterStats } from '@/components/character-stats';
import { DungeonStats } from '@/components/dungeon-stats';
import { Currency } from '@/components/currency';
import { CountUp, CountUpCurrency } from '@/components/count-up';
import { Skeleton } from '@/components/skeleton';
import {
  computeCharacterStats,
  computeDungeonStats,
  computeSummary,
} from '@/lib/dashboard-stats';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const formatDate = useDateFormatter();
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { data: sessions, isLoading: isSessionsLoading } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions'),
  });

  // Filter sessions by date range for the chart
  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    if (dateRange === 'all') return sessions;

    if (dateRange === 'custom') {
      return sessions.filter((s) => {
        if (!s.started_at) return false;
        const d = new Date(s.started_at);
        if (customFrom && d < new Date(customFrom)) return false;
        if (customTo) {
          const to = new Date(customTo);
          to.setHours(23, 59, 59, 999);
          if (d > to) return false;
        }
        return true;
      });
    }

    const now = new Date();
    const days = dateRange === '7d' ? 7 : 30;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return sessions.filter(
      (s) => s.started_at && new Date(s.started_at) >= cutoff,
    );
  }, [sessions, dateRange, customFrom, customTo]);

  // Every stat block is derived from the same filtered session list so one
  // date filter drives the whole page consistently.
  const summary = useMemo(() => computeSummary(filteredSessions), [filteredSessions]);
  const characterStats = useMemo(
    () => computeCharacterStats(filteredSessions),
    [filteredSessions],
  );
  const dungeonStats = useMemo(
    () => computeDungeonStats(filteredSessions),
    [filteredSessions],
  );

  // Local-timezone YYYY-MM-DD (en-CA yields ISO format), used to block picking
  // future dates in the range filter.
  const maxDate = new Date().toLocaleDateString('en-CA');

  if (isSessionsLoading) {
    return (
      <main className="min-h-screen bg-root">
        <section className="py-[60px] laptop:py-[90px]">
          <div className="mx-auto max-w-container px-4 sm:px-7">
            <div className="mb-10 space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 laptop:grid-cols-3 desktop:grid-cols-4 gap-6 mb-10">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[104px]" />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[88px]" />
              ))}
            </div>
            <Skeleton className="h-[280px] w-full" />
          </div>
        </section>
      </main>
    );
  }

  const stats: {
    label: string;
    value: string | number;
    icon: typeof Coins;
    currency?: boolean;
  }[] = [
    {
      label: t('statTotalValue'),
      value: summary.totalGold,
      icon: Coins,
      currency: true,
    },
    {
      label: t('statTotalHours'),
      value: `${summary.totalHours}h`,
      icon: Clock,
    },
    {
      label: t('statValuePerHour'),
      value: summary.goldPerHour,
      icon: TrendingUp,
      currency: true,
    },
    {
      label: t('statFavoriteDungeon'),
      value: summary.favoriteDungeon ?? t('na'),
      icon: MapPin,
    },
  ];

  const recentSessions = filteredSessions.slice(0, 5);
  // Characters that were actually active within the selected range.
  const totalCharacters = characterStats.length;
  const totalSessions = filteredSessions.length;

  return (
    <main className="min-h-screen bg-root">
      <section className="relative overflow-hidden py-[60px] laptop:py-[90px]">
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
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-xl laptop:text-2xl font-medium text-foreground">
                {t('title')}
              </h1>
              <p className="text-sm text-muted mt-2">
                {t('subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-raised rounded-base p-1">
                {(['7d', '30d', 'all', 'custom'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                      dateRange === range
                        ? 'bg-surface text-foreground outline outline-1 outline-[rgba(255,255,255,0.08)]'
                        : 'text-muted hover:text-foreground'
                    }`}
                  >
                    {range === '7d' ? t('range7d') : range === '30d' ? t('range30d') : range === 'all' ? t('rangeAll') : t('rangeCustom')}
                  </button>
                ))}
              </div>
              {dateRange === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customFrom}
                    max={customTo || maxDate}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="rounded-base border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-[var(--focus)]"
                  />
                  <span className="text-xs text-muted">—</span>
                  <input
                    type="date"
                    value={customTo}
                    min={customFrom || undefined}
                    max={maxDate}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="rounded-base border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-[var(--focus)]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 laptop:grid-cols-3 desktop:grid-cols-4 gap-6 mb-10">
            {stats.map((stat, i) => (
              <m.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.3, delay: i * 0.06, ease: 'easeOut' }}
                className="group bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-5 transition-all duration-200 hover:outline-[rgba(224,165,60,0.35)] hover:shadow-gold"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    {stat.label}
                  </p>
                  <span className="flex h-8 w-8 items-center justify-center rounded-base bg-gold-soft text-gold transition-transform duration-200 group-hover:scale-110">
                    <stat.icon className="w-4 h-4" />
                  </span>
                </div>
                {stat.currency ? (
                  <CountUpCurrency
                    copper={stat.value as number}
                    className="!flex flex-wrap text-2xl"
                  />
                ) : (
                  <p
                    className="text-xl laptop:text-2xl font-bold tracking-tight text-gold leading-tight break-words line-clamp-2"
                    title={String(stat.value)}
                  >
                    {stat.value}
                  </p>
                )}
              </m.div>
            ))}
          </div>

          {/* Overview row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
            <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
              <p className="text-xs text-muted mb-1">{t('characters')}</p>
              <p className="text-lg font-medium text-foreground">
                <CountUp value={totalCharacters} />
              </p>
            </div>
            <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
              <p className="text-xs text-muted mb-1">{t('totalSessions')}</p>
              <p className="text-lg font-medium text-foreground">
                <CountUp value={totalSessions} />
              </p>
            </div>
            <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
              <p className="text-xs text-muted mb-1">{t('avgValuePerSession')}</p>
              <CountUpCurrency
                copper={
                  totalSessions > 0
                    ? Math.round(summary.totalGold / totalSessions)
                    : 0
                }
                className="!flex flex-wrap text-lg"
              />
            </div>
          </div>

          {/* Dungeon efficiency ranking */}
          <div className="mb-10">
            <DungeonStats stats={dungeonStats} />
          </div>

          {/* Gold Chart */}
          <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6 mb-10">
            <GoldChart sessions={filteredSessions} />
          </div>

          {/* Recent Sessions */}
          <div className="grid grid-cols-1 laptop:grid-cols-2 gap-6">
            {/* Character Stats */}
            <CharacterStats stats={characterStats} />

            {/* Recent Sessions Table */}
            <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
              <h2 className="text-sm font-medium text-foreground mb-4">
                {t('recentSessions')}
              </h2>
              {recentSessions.length === 0 ? (
                <p className="text-xs text-muted">{t('noSessions')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-3 text-xs font-medium text-muted">{t('colCharacter')}</th>
                        <th className="pb-3 text-xs font-medium text-muted">{t('colDate')}</th>
                        <th className="pb-3 text-xs font-medium text-muted text-right">{t('colValue')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSessions.map((session) => (
                        <tr
                          key={session.id}
                          className="border-b border-[rgba(255,255,255,0.05)] last:border-0"
                        >
                          <td className="py-3 text-sm text-foreground">
                            {session.characters?.name ?? '-'}
                          </td>
                          <td className="py-3 text-xs text-muted">
                            {session.started_at
                              ? formatDate(session.started_at, {
                                  day: 'numeric',
                                  month: 'short',
                                })
                              : '-'}
                          </td>
                          <td className="py-3 text-sm text-right">
                            <Currency copper={Number(session.gold_earned)} className="justify-end text-sm" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
