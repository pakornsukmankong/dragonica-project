'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Currency } from '@/components/currency';
import { formatGoldShort } from '@/lib/currency';

interface CharacterStat {
  characterId: string;
  characterName: string;
  className: string;
  level: number;
  totalSessions: number;
  totalGold: number;
  totalMinutes: number;
  goldPerHour: number;
}

export function CharacterStats() {
  const t = useTranslations('charStats');
  const { data: stats, isLoading } = useQuery<CharacterStat[]>({
    queryKey: ['dashboard', 'character-stats'],
    queryFn: () => api.get('/dashboard/character-stats'),
  });

  if (isLoading) {
    return (
      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        <p className="text-xs text-muted">{t('loading')}</p>
      </div>
    );
  }

  if (!stats || stats.length === 0) {
    return (
      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        <h2 className="text-sm font-medium text-foreground mb-4">
          {t('title')}
        </h2>
        <p className="text-xs text-muted">
          {t('empty')}
        </p>
      </div>
    );
  }

  const maxGold = Math.max(...stats.map((s) => s.totalGold), 1);

  return (
    <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
      <h2 className="text-sm font-medium text-foreground mb-4">
        {t('title')}
      </h2>
      <div className="flex flex-col gap-4">
        {stats.map((stat) => (
          <div key={stat.characterId} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-foreground">
                  {stat.characterName}
                </span>
                <span className="text-xs text-muted ml-2">
                  {stat.className} · Lv.{stat.level}
                </span>
              </div>
              <Currency copper={stat.totalGold} className="text-sm" />
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 bg-raised rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold-dim to-gold transition-all duration-300"
                style={{ width: `${(stat.totalGold / maxGold) * 100}%` }}
              />
            </div>
            <div className="flex gap-4 text-xs text-muted">
              <span>{t('sessions', { count: stat.totalSessions })}</span>
              <span>{t('hoursPlayed', { count: Math.round(stat.totalMinutes / 60) })}</span>
              <span>{t('perHour', { value: formatGoldShort(stat.goldPerHour) })}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
