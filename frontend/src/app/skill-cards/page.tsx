'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Loader2, MapPin, Search, Swords } from 'lucide-react';

type SkillCardSkill = { no: number; name: string; job: string | null };
type SkillCardMap = { n: string; l: number };
type SkillCard = {
  id: number;
  monster: string;
  /** In-game card item name, only set when it differs from the monster's name. */
  cardName: string | null;
  monsterId: number | null;
  class: 'Warrior' | 'Magician' | 'Archer' | 'Thief';
  levels: string[];
  maps: SkillCardMap[];
  skills: SkillCardSkill[];
};

const CLASSES = ['Warrior', 'Magician', 'Archer', 'Thief'] as const;

// Per base-class accent, reusing the app's existing semantic tokens so it stays
// on-theme in both light and dark.
const CLASS_CLASS: Record<string, string> = {
  Warrior: 'border-[var(--border-danger)] text-[var(--fg-danger)]',
  Magician: 'border-[var(--blue)] text-[var(--blue)]',
  Archer: 'border-[var(--border-success)] text-[var(--fg-success)]',
  Thief: 'border-[var(--border-warning)] text-[var(--fg-warning)]',
};

// First level threshold of a card, for sorting (levels like "30-34").
const firstLevel = (c: SkillCard) =>
  Math.min(...c.levels.map((l) => Number(l.split('-')[0]) || 0));

export default function SkillCardsPage() {
  const t = useTranslations('skillCards');

  const { data: cards, isLoading } = useQuery<SkillCard[]>({
    queryKey: ['skill-cards'],
    queryFn: async () => {
      const res = await fetch('/data/skill-cards.json');
      if (!res.ok) throw new Error('Failed to load skill-card data');
      return res.json();
    },
    staleTime: Infinity,
  });

  const [search, setSearch] = useState('');
  const [cls, setCls] = useState<string>(''); // '' = all
  const [sort, setSort] = useState('levelAsc');

  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(() => {
    if (!cards) return [];
    const q = deferredSearch.trim().toLowerCase();

    const result = cards.filter((c) => {
      if (cls && c.class !== cls) return false;
      if (q) {
        const inMonster = c.monster.toLowerCase().includes(q);
        // also match the card's in-game name — that's what players read off
        // their inventory, and for a few cards it differs from the monster's
        const inCard = !!c.cardName?.toLowerCase().includes(q);
        const inSkill = c.skills.some((s) => s.name.toLowerCase().includes(q));
        if (!inMonster && !inCard && !inSkill) return false;
      }
      return true;
    });

    if (sort === 'nameAsc') {
      result.sort((a, b) => a.monster.localeCompare(b.monster));
    } else {
      result.sort(
        (a, b) => firstLevel(a) - firstLevel(b) || a.monster.localeCompare(b.monster),
      );
    }
    return result;
  }, [cards, deferredSearch, cls, sort]);

  return (
    <main className="mx-auto max-w-container px-4 py-8 sm:px-7">
      <header className="mb-6">
        <h1 className="text-xl font-medium text-foreground laptop:text-2xl">
          {t('title')}
        </h1>
        <p className="mt-2 text-sm text-muted">{t('subtitle')}</p>
      </header>

      {/* Class tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {['', ...CLASSES].map((c) => (
          <button
            key={c || 'all'}
            onClick={() => setCls(c)}
            className={`rounded-base border px-3 py-1.5 text-sm transition-colors ${
              cls === c
                ? 'border-gold/60 bg-gold-soft font-medium text-gold'
                : 'border-border text-muted hover:border-gold/40 hover:text-foreground'
            }`}
          >
            {c ? t(`classes.${c}`) : t('classes.all')}
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-base border border-border bg-surface py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-[var(--focus)]"
          />
        </div>
        <div className="flex gap-2">
          {(['levelAsc', 'nameAsc'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`rounded-base border px-3 py-2 text-sm transition-colors ${
                sort === s
                  ? 'border-gold/60 bg-gold-soft font-medium text-gold'
                  : 'border-border text-muted hover:border-gold/40 hover:text-foreground'
              }`}
            >
              {t(`sort.${s}`)}
            </button>
          ))}
        </div>
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

          {filtered.length === 0 ? (
            <div className="rounded-base border border-border bg-raised py-16 text-center text-sm text-muted">
              {t('empty')}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 laptop:grid-cols-2">
              {filtered.map((c) => (
                <article
                  key={c.id}
                  className="flex flex-col rounded-base border border-border bg-raised px-3.5 py-3 transition-colors hover:border-gold/40"
                >
                  {/* Monster (source) + class */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${CLASS_CLASS[c.class]}`}
                    >
                      {t(`classes.${c.class}`)}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {c.monster}
                    </span>
                    {c.cardName && (
                      <span className="text-[11px] text-muted">
                        {t('cardNamed', { name: c.cardName })}
                      </span>
                    )}
                  </div>

                  {/* Skills granted */}
                  <ul className="mt-2 space-y-1.5">
                    {c.skills.map((s) => (
                      <li
                        key={s.name}
                        className="flex items-center gap-2 text-sm text-foreground"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/skill-card-icons/${s.no}.webp`}
                          alt=""
                          width={28}
                          height={28}
                          loading="lazy"
                          draggable={false}
                          className="h-7 w-7 shrink-0 rounded-[4px] border border-border bg-surface object-cover"
                        />
                        <span>{s.name}</span>
                        {s.job && (
                          <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted">
                            {s.job}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* Source + obtain levels */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Swords className="h-3.5 w-3.5" />
                      {t('dropFrom')}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {c.levels.map((lv) => (
                        <span
                          key={lv}
                          className="rounded-full border border-gold/40 bg-gold-soft px-1.5 py-0.5 text-[10px] font-medium text-gold tabular-nums"
                        >
                          {t('level')} {lv}
                        </span>
                      ))}
                    </span>
                  </div>

                  {/* Spawn maps of the source monster */}
                  {c.maps.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-start gap-x-2 gap-y-1 text-xs text-muted">
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {t('foundIn')}
                      </span>
                      <span className="min-w-0 flex-1">
                        {c.maps.map((mp, i) => (
                          <span key={mp.n}>
                            {i > 0 && <span className="text-border"> · </span>}
                            <span className="text-foreground/80">{mp.n}</span>
                          </span>
                        ))}
                      </span>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
