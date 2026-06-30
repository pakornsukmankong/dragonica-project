'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { Coins, Clock, TrendingUp, MapPin } from 'lucide-react';
import type { Session, Character, DashboardSummary } from '@/types';
import { GoldChart } from '@/components/gold-chart';
import { CharacterStats } from '@/components/character-stats';
import { DungeonStats } from '@/components/dungeon-stats';
import { Currency } from '@/components/currency';

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { data: summary, isLoading: isSummaryLoading } = useQuery<DashboardSummary>({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get('/dashboard/summary'),
  });

  const { data: sessions } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions'),
  });

  const { data: characters } = useQuery<Character[]>({
    queryKey: ['characters'],
    queryFn: () => api.get('/characters'),
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

  if (isSummaryLoading) {
    return (
      <div className="min-h-screen bg-root flex items-center justify-center">
        <p className="text-sm text-muted">Loading dashboard...</p>
      </div>
    );
  }

  const stats: {
    label: string;
    value: string | number;
    icon: typeof Coins;
    currency?: boolean;
  }[] = [
    {
      label: 'Total Value',
      value: summary?.totalGold ?? 0,
      icon: Coins,
      currency: true,
    },
    {
      label: 'Total Hours',
      value: `${summary?.totalHours ?? 0}h`,
      icon: Clock,
    },
    {
      label: 'Value / Hour',
      value: summary?.goldPerHour ?? 0,
      icon: TrendingUp,
      currency: true,
    },
    {
      label: 'Favorite Dungeon',
      value: summary?.favoriteDungeon ?? 'N/A',
      icon: MapPin,
    },
  ];

  const recentSessions = filteredSessions.slice(0, 5);
  const totalCharacters = characters?.length ?? 0;
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
                Dashboard
              </h1>
              <p className="text-sm text-muted mt-2">
                Your grinding summary at a glance
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
                    {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === 'all' ? 'All' : 'Custom'}
                  </button>
                ))}
              </div>
              {dateRange === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="rounded-base border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-[var(--focus)]"
                  />
                  <span className="text-xs text-muted">—</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="rounded-base border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-[var(--focus)]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 laptop:grid-cols-3 desktop:grid-cols-4 gap-6 mb-10">
            {stats.map((stat) => (
              <div
                key={stat.label}
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
                  <Currency
                    copper={stat.value as number}
                    className="!flex flex-wrap text-2xl"
                  />
                ) : (
                  <p className="text-2xl font-bold tracking-tight text-gold tabular-nums truncate">
                    {stat.value}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Overview row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
            <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
              <p className="text-xs text-muted mb-1">Characters</p>
              <p className="text-lg font-medium text-foreground">{totalCharacters}</p>
            </div>
            <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
              <p className="text-xs text-muted mb-1">Total Sessions</p>
              <p className="text-lg font-medium text-foreground">{totalSessions}</p>
            </div>
            <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
              <p className="text-xs text-muted mb-1">Avg Value / Session</p>
              <Currency
                copper={
                  totalSessions > 0
                    ? Math.round((summary?.totalGold ?? 0) / totalSessions)
                    : 0
                }
                className="!flex flex-wrap text-lg"
              />
            </div>
          </div>

          {/* Dungeon efficiency ranking */}
          <div className="mb-10">
            <DungeonStats />
          </div>

          {/* Gold Chart */}
          <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6 mb-10">
            <GoldChart sessions={filteredSessions} />
          </div>

          {/* Recent Sessions */}
          <div className="grid grid-cols-1 laptop:grid-cols-2 gap-6">
            {/* Character Stats */}
            <CharacterStats />

            {/* Recent Sessions Table */}
            <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
              <h2 className="text-sm font-medium text-foreground mb-4">
                Recent Sessions
              </h2>
              {recentSessions.length === 0 ? (
                <p className="text-xs text-muted">No sessions recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-3 text-xs font-medium text-muted">Character</th>
                        <th className="pb-3 text-xs font-medium text-muted">Date</th>
                        <th className="pb-3 text-xs font-medium text-muted text-right">Value</th>
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
                              ? new Date(session.started_at).toLocaleDateString('th-TH', {
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
