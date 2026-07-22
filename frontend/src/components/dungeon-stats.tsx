'use client';

import { useTranslations } from 'next-intl';
import { Trophy } from 'lucide-react';
import { Currency } from '@/components/currency';
import type { DungeonStats as DungeonStat } from '@/types';

interface DungeonStatsProps {
  stats: DungeonStat[];
}

export function DungeonStats({ stats }: DungeonStatsProps) {
  const t = useTranslations('dungeonStats');

  return (
    <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-gold" />
        <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
        <span className="text-xs text-muted">{t('subtitle')}</span>
      </div>

      {stats.length === 0 ? (
        <p className="text-xs text-muted">
          {t('empty')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-3 pr-3 text-xs font-medium text-muted">{t('colRank')}</th>
                <th className="pb-3 text-xs font-medium text-muted">{t('colDungeon')}</th>
                <th className="pb-3 text-right text-xs font-medium text-muted">{t('colValuePerStamina')}</th>
                <th className="pb-3 text-right text-xs font-medium text-muted">{t('colRuns')}</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((d, i) => (
                <tr
                  key={d.dungeonId}
                  className="border-b border-[rgba(255,255,255,0.05)] last:border-0"
                >
                  <td className="py-3 pr-3">
                    {i === 0 ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-base bg-gold-soft text-[11px] font-bold text-gold">
                        1
                      </span>
                    ) : (
                      <span className="text-xs text-muted tabular-nums">{i + 1}</span>
                    )}
                  </td>
                  <td className="py-3">
                    <span className={`text-sm font-medium ${i === 0 ? 'text-gold' : 'text-foreground'}`}>
                      {d.dungeonName}
                    </span>
                  </td>
                  <td className="py-3 text-right text-sm">
                    <Currency copper={d.goldPerStamina} className="justify-end text-sm" />
                  </td>
                  <td className="py-3 text-right text-xs text-muted tabular-nums">
                    {d.totalSessions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
