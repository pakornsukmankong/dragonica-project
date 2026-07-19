'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Loader2, Search } from 'lucide-react';
import { Currency } from '@/components/currency';
import { ItemIcon } from '@/components/item-icon';
import { Pagination } from '@/components/pagination';
import { Select } from '@/components/select';
import { MONSTER_GRADES, type GameMonster } from '@/lib/items';

const PAGE_SIZE = 50;

// Grade badge styling: normal is muted; higher grades get warmer emphasis.
const GRADE_CLASS: Record<number, string> = {
  1: 'border-border text-muted',
  2: 'border-[var(--border-success)] text-[var(--fg-success)]',
  3: 'border-gold/50 text-gold',
  4: 'border-[var(--border-danger)] text-[var(--fg-danger)]',
};

/**
 * The monster half of the Game Database — its own data, filters and card, shown
 * when the Monsters tab is picked on the items page. Self-contained so the
 * items page only decides which panel to render, not how each one works.
 */
export function MonstersPanel() {
  const t = useTranslations('monsters');

  const { data: monsters, isLoading } = useQuery<GameMonster[]>({
    queryKey: ['monsters', 'db'],
    queryFn: async () => {
      const res = await fetch('/data/items/monsters.json');
      if (!res.ok) throw new Error('Failed to load monster data');
      return res.json();
    },
    staleTime: Infinity,
  });

  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState(0); // 0 = all
  const [minLevel, setMinLevel] = useState('');
  const [maxLevel, setMaxLevel] = useState('');
  const [sort, setSort] = useState('levelAsc');
  const [page, setPage] = useState(1);
  const [openDrops, setOpenDrops] = useState<number | null>(null);

  const deferredSearch = useDeferredValue(search);

  // Any filter change starts back at page 1.
  const withPageReset =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  const filtered = useMemo(() => {
    if (!monsters) return [];
    const q = deferredSearch.trim().toLowerCase();
    const min = Number(minLevel) || 0;
    const max = Number(maxLevel) || Infinity;

    const result = monsters.filter((m) => {
      // The dump carries a few nameless placeholder rows (e.g. "."), which read
      // as broken entries in the list.
      if (!/[\p{L}\p{N}]/u.test(m.name)) return false;
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (grade && m.grade !== grade) return false;
      const top = m.lvMax ?? m.lv;
      if (top < min || m.lv > max) return false;
      return true;
    });

    switch (sort) {
      case 'levelDesc':
        result.sort((a, b) => b.lv - a.lv || a.name.localeCompare(b.name));
        break;
      case 'nameAsc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        result.sort((a, b) => a.lv - b.lv || a.name.localeCompare(b.name));
    }
    return result;
  }, [monsters, deferredSearch, grade, minLevel, maxLevel, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageMonsters = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const levelField =
    'w-16 rounded-base border border-border bg-surface px-2 py-2 text-sm text-foreground text-center placeholder:text-muted outline-none focus:border-[var(--focus)]';

  return (
    <>
      {/* Grade tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[0, ...MONSTER_GRADES].map((g) => (
          <button
            key={g}
            onClick={() => withPageReset(setGrade)(g)}
            className={`rounded-base border px-3 py-1.5 text-sm transition-colors ${
              grade === g
                ? 'border-gold/60 bg-gold-soft font-medium text-gold'
                : 'border-border text-muted hover:border-gold/40 hover:text-foreground'
            }`}
          >
            {t(`grades.${g}`)}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => withPageReset(setSearch)(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-base border border-border bg-surface py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-[var(--focus)]"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            inputMode="numeric"
            value={minLevel}
            onChange={(e) =>
              withPageReset(setMinLevel)(e.target.value.replace(/[^0-9]/g, ''))
            }
            placeholder={t('levelMin')}
            className={levelField}
            aria-label={t('levelMin')}
          />
          <span className="text-xs text-muted">–</span>
          <input
            type="text"
            inputMode="numeric"
            value={maxLevel}
            onChange={(e) =>
              withPageReset(setMaxLevel)(e.target.value.replace(/[^0-9]/g, ''))
            }
            placeholder={t('levelMax')}
            className={levelField}
            aria-label={t('levelMax')}
          />
        </div>
        <Select
          value={sort}
          onChange={withPageReset(setSort)}
          options={['levelAsc', 'levelDesc', 'nameAsc'].map((s) => ({
            value: s,
            label: t(`sort.${s}`),
          }))}
          className="w-44"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted tabular-nums">
            {t('resultCount', { count: filtered.length.toLocaleString() })}
          </p>

          {pageMonsters.length === 0 ? (
            <div className="rounded-base border border-border bg-raised py-16 text-center text-sm text-muted">
              {t('empty')}
            </div>
          ) : (
            <div className="space-y-2">
              {pageMonsters.map((m) => (
                <article
                  key={m.id}
                  className="rounded-base border border-border bg-raised px-3 py-2.5 transition-colors hover:border-gold/40"
                >
                  <div className="flex items-start gap-3 sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm font-medium text-foreground">
                          {m.name}
                        </span>
                        <span
                          className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${GRADE_CLASS[m.grade]}`}
                        >
                          {t(`grades.${m.grade}`)}
                        </span>
                        {m.drops && (
                          <button
                            onClick={() =>
                              setOpenDrops(openDrops === m.id ? null : m.id)
                            }
                            aria-expanded={openDrops === m.id}
                            className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                              openDrops === m.id
                                ? 'border-[var(--border-success)] bg-[var(--success-soft)] text-[var(--fg-success)]'
                                : 'border-[var(--border-success)] text-[var(--fg-success)] hover:bg-[var(--success-soft)]'
                            }`}
                          >
                            {t('dropBadge', { count: m.drops.length })} ▾
                          </button>
                        )}
                        {m.maps && (
                          <button
                            onClick={() =>
                              setOpenDrops(openDrops === m.id ? null : m.id)
                            }
                            aria-expanded={openDrops === m.id}
                            className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                              openDrops === m.id
                                ? 'border-gold/60 bg-gold-soft text-gold'
                                : 'border-gold/40 text-gold hover:bg-gold-soft'
                            }`}
                          >
                            {t('mapBadge', { count: m.maps.length })} ▾
                          </button>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                        {m.hp != null && (
                          <span className="whitespace-nowrap">
                            HP {m.hp.toLocaleString()}
                          </span>
                        )}
                        {m.atk && (
                          <span className="whitespace-nowrap">
                            {t('atk')} {m.atk[0].toLocaleString()}
                            {m.atk[1] !== m.atk[0] &&
                              `–${m.atk[1].toLocaleString()}`}
                          </span>
                        )}
                        {m.def != null && (
                          <span className="whitespace-nowrap">
                            {t('def')} {m.def.toLocaleString()}
                          </span>
                        )}
                        {m.mdef != null && (
                          <span className="whitespace-nowrap">
                            {t('mdef')} {m.mdef.toLocaleString()}
                          </span>
                        )}
                        {m.money && m.money[1] > 0 && (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            {t('money')}{' '}
                            <Currency copper={m.money[1]} showSub />
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-foreground tabular-nums">
                      Lv. {m.lv}
                      {m.lvMax ? `–${m.lvMax}` : ''}
                    </span>
                  </div>

                  {openDrops === m.id && m.maps && (
                    <div className="mt-2 rounded-base border border-gold/20 bg-surface p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                        {t('mapsTitle')}
                      </div>
                      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        {m.maps.map((mp) => (
                          <li key={mp.n} className="text-xs text-foreground">
                            {mp.n}
                            {mp.l ? (
                              <span className="ml-1 text-muted tabular-nums">
                                Lv. {mp.l}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {openDrops === m.id && m.drops && (
                    <div className="mt-2 rounded-base border border-[var(--border-success)]/40 bg-surface p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                        {t('dropsTitle')}
                      </div>
                      <ul className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 laptop:grid-cols-3">
                        {m.drops.map((d) => (
                          <li
                            key={d.id}
                            className="flex items-center gap-2 text-xs"
                          >
                            <ItemIcon
                              icon={d.icon}
                              size={20}
                              className="rounded-[3px] border border-border bg-raised"
                            />
                            <span className="min-w-0 truncate text-foreground">
                              {d.name}
                            </span>
                            {d.level > 0 && (
                              <span className="shrink-0 text-muted tabular-nums">
                                Lv. {d.level}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </>
      )}
    </>
  );
}
