'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Loader2, Search } from 'lucide-react';
import { Currency } from '@/components/currency';
import { ItemIcon } from '@/components/item-icon';
import { Pagination } from '@/components/pagination';
import { Select } from '@/components/select';
import {
  BRANCH_ICON,
  BRANCH_IDS,
  EQUIP_SLOTS,
  ITEM_CATEGORIES,
  RARITY_ORDER,
  SLOT_CATEGORY,
  STAT_META,
  WEAPON_TYPES,
  formatStatValue,
  itemRarity,
  type EquipSlot,
  type GameItem,
  type GameItemDrops,
  type GameItemSet,
  type ItemCategory,
  type StatKey,
} from '@/lib/items';
import { rarityStyle } from '@/lib/rarity';

const PAGE_SIZE = 50;
// Slot-based sub-filter only makes sense for wearable categories.
const SLOTTED: ItemCategory[] = ['equipment', 'costume'];
const SUBCATS = ['all', 'weapon', 'armor', 'accessory'] as const;
type Subcat = (typeof SUBCATS)[number];

// Attack min/max pairs render as one "78–98" range chip.
const RANGE_PAIRS: [StatKey, StatKey, string][] = [
  ['phyAtkMin', 'phyAtkMax', 'phyAtkRange'],
  ['magAtkMin', 'magAtkMax', 'magAtkRange'],
];

type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

function statChips(
  stats: Partial<Record<StatKey, number>> | undefined,
  t: Translate,
): string[] {
  if (!stats) return [];
  const chips: string[] = [];
  const consumed = new Set<StatKey>();
  for (const [minKey, maxKey, label] of RANGE_PAIRS) {
    const min = stats[minKey];
    const max = stats[maxKey];
    if (min != null && max != null) {
      chips.push(
        `${t(`stats.${label}`)} ${min.toLocaleString()}–${max.toLocaleString()}`,
      );
      consumed.add(minKey).add(maxKey);
    }
  }
  for (const { key } of STAT_META) {
    if (consumed.has(key)) continue;
    const v = stats[key];
    if (v == null || v === 0) continue;
    chips.push(`${t(`stats.${key}`)} ${formatStatValue(key, v)}`);
  }
  return chips;
}

function SetPanel({
  set,
  currentId,
  t,
}: {
  set: GameItemSet | undefined;
  currentId: number;
  t: Translate;
}) {
  return (
    <div className="ml-[52px] mt-2 rounded-base border border-gold/20 bg-surface p-3">
      {!set ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted" />
      ) : (
        <>
          <div className="text-xs font-semibold text-gold">
            {set.name}{' '}
            <span className="font-normal text-muted">
              — {t('setPieces', { count: set.members.length })}
            </span>
          </div>
          <ul className="mt-2 space-y-1">
            {set.members.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-xs">
                <ItemIcon
                  icon={m.icon}
                  size={20}
                  className="rounded-[3px] border border-border bg-raised"
                />
                <span
                  className={
                    m.id === currentId
                      ? 'font-medium text-gold'
                      : 'text-foreground'
                  }
                >
                  {m.name}
                </span>
                {m.level > 0 && (
                  <span className="text-muted tabular-nums">Lv. {m.level}</span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              {t('setEffects')}
            </div>
            {set.effects.map((e) => (
              <div
                key={e.pieces}
                className="flex flex-wrap items-baseline gap-x-2 text-xs"
              >
                <span className="shrink-0 font-medium text-foreground tabular-nums">
                  {t('setPieces', { count: e.pieces })}:
                </span>
                <span className="text-[var(--fg-success)]">
                  {statChips(e.stats, t).join(', ')}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DropsPanel({
  drops,
  t,
}: {
  drops: GameItemDrops | undefined;
  t: Translate;
}) {
  return (
    <div className="ml-[52px] mt-2 rounded-base border border-[var(--border-success)]/40 bg-surface p-3">
      {!drops ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted" />
      ) : (
        <div className="space-y-3">
          {drops.mons && drops.mons.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                {t('dropMonsters')}
              </div>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {drops.mons.map((m) => (
                  <li key={m.n} className="text-xs text-foreground">
                    {m.n}
                    {m.l ? (
                      <span className="ml-1 text-muted tabular-nums">
                        Lv. {m.l}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {drops.maps && drops.maps.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                {t('dropMaps')}
              </div>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {drops.maps.map((m) => (
                  <li key={m.n} className="text-xs text-foreground">
                    {m.n}
                    {m.l ? (
                      <span className="ml-1 text-muted tabular-nums">
                        Lv. {m.l}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ItemsPage() {
  const t = useTranslations('items');

  const [category, setCategory] = useState<ItemCategory>('equipment');
  const [search, setSearch] = useState('');
  const [subcat, setSubcat] = useState<Subcat>('all');
  const [slot, setSlot] = useState('');
  const [weapon, setWeapon] = useState('');
  const [branch, setBranch] = useState('');
  const [minLevel, setMinLevel] = useState('');
  const [maxLevel, setMaxLevel] = useState('');
  const [rarity, setRarity] = useState('');
  const [sort, setSort] = useState('levelAsc');
  const [page, setPage] = useState(1);
  /** Expanded detail panel: item id + which panel */
  const [openPanel, setOpenPanel] = useState<{
    id: number;
    kind: 'set' | 'drops';
  } | null>(null);

  const { data: items, isLoading } = useQuery<GameItem[]>({
    queryKey: ['items', 'db', category],
    queryFn: async () => {
      const res = await fetch(`/data/items/${category}.json`);
      if (!res.ok) throw new Error('Failed to load item data');
      return res.json();
    },
    staleTime: Infinity,
  });

  // Set/drop details load once, on the first expanded panel of each kind.
  const { data: sets } = useQuery<GameItemSet[]>({
    queryKey: ['items', 'sets'],
    queryFn: async () => {
      const res = await fetch('/data/items/sets.json');
      if (!res.ok) throw new Error('Failed to load set data');
      return res.json();
    },
    staleTime: Infinity,
    enabled: openPanel?.kind === 'set',
  });
  const setById = useMemo(
    () => new Map((sets ?? []).map((s) => [s.id, s])),
    [sets],
  );

  const { data: dropData } = useQuery<Record<number, GameItemDrops>>({
    queryKey: ['items', 'drops'],
    queryFn: async () => {
      const res = await fetch('/data/items/drops.json');
      if (!res.ok) throw new Error('Failed to load drop data');
      return res.json();
    },
    staleTime: Infinity,
    enabled: openPanel?.kind === 'drops',
  });

  const deferredSearch = useDeferredValue(search);
  const slotted = SLOTTED.includes(category);

  // Any filter change starts back at page 1.
  const withPageReset =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  const selectCategory = (c: ItemCategory) => {
    setCategory(c);
    setSubcat('all');
    setSlot('');
    setWeapon('');
    setBranch('');
    setPage(1);
  };

  const slotOptions = useMemo(
    () => [
      { value: '', label: t('allSlots') },
      ...EQUIP_SLOTS.filter(
        (s) => subcat === 'all' || SLOT_CATEGORY[s] === subcat,
      ).map((s) => ({ value: s, label: t(`slots.${s}`) })),
    ],
    [subcat, t],
  );

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = deferredSearch.trim().toLowerCase();
    const min = Number(minLevel) || 0;
    const max = Number(maxLevel) || Infinity;
    const branchId = Number(branch) || 0;

    const result = items.filter((it) => {
      if (q && !it.name.toLowerCase().includes(q)) return false;
      if (slotted) {
        if (subcat !== 'all' && (!it.slot || SLOT_CATEGORY[it.slot] !== subcat))
          return false;
        if (slot && it.slot !== slot && !it.slots?.includes(slot as EquipSlot))
          return false;
        if (weapon && it.weapon !== weapon) return false;
        if (
          branchId &&
          it.classes &&
          it.classes.length > 0 &&
          !it.classes.includes(branchId)
        )
          return false;
      }
      if (it.level < min || it.level > max) return false;
      if (rarity && itemRarity(it) !== rarity) return false;
      return true;
    });

    switch (sort) {
      case 'levelDesc':
        result.sort((a, b) => b.level - a.level || a.id - b.id);
        break;
      case 'nameAsc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'priceDesc':
        result.sort((a, b) => b.price - a.price || a.id - b.id);
        break;
      default:
        result.sort((a, b) => a.level - b.level || a.id - b.id);
    }
    return result;
  }, [
    items,
    deferredSearch,
    slotted,
    subcat,
    slot,
    weapon,
    branch,
    minLevel,
    maxLevel,
    rarity,
    sort,
  ]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const levelField =
    'w-16 rounded-base border border-border bg-surface px-2 py-2 text-sm text-foreground text-center placeholder:text-muted outline-none focus:border-[var(--focus)]';

  return (
    <main className="mx-auto max-w-container px-4 py-8 sm:px-7">
      <header className="mb-6">
        <h1 className="text-xl font-medium text-foreground laptop:text-2xl">
          {t('title')}
        </h1>
        <p className="mt-2 text-sm text-muted">{t('subtitle')}</p>
      </header>

      {/* Category tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {ITEM_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => selectCategory(c)}
            className={`rounded-base border px-3 py-1.5 text-sm transition-colors ${
              category === c
                ? 'border-gold/60 bg-gold-soft font-medium text-gold'
                : 'border-border text-muted hover:border-gold/40 hover:text-foreground'
            }`}
          >
            {t(`categories.${c}`)}
          </button>
        ))}
      </div>

      {/* Sub-category chips (wearables only) */}
      {slotted && (
        <div className="mb-4 flex flex-wrap gap-2">
          {SUBCATS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setSubcat(c);
                setSlot('');
                if (c !== 'weapon' && c !== 'all') setWeapon('');
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                subcat === c
                  ? 'border-gold/60 bg-gold-soft font-medium text-gold'
                  : 'border-border text-muted hover:border-gold/40 hover:text-foreground'
              }`}
            >
              {t(`subcats.${c}`)}
            </button>
          ))}
        </div>
      )}

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
        {slotted && (
          <Select
            value={slot}
            onChange={withPageReset(setSlot)}
            options={slotOptions}
            className="w-40"
          />
        )}
        {slotted && (subcat === 'weapon' || slot === 'weapon') && (
          <Select
            value={weapon}
            onChange={withPageReset(setWeapon)}
            options={[
              { value: '', label: t('allWeapons') },
              ...WEAPON_TYPES.map((w) => ({
                value: w,
                label: t(`weapons.${w}`),
              })),
            ]}
            className="w-44"
          />
        )}
        {slotted && (
          <Select
            value={branch}
            onChange={withPageReset(setBranch)}
            options={[
              { value: '', label: t('allClasses') },
              ...BRANCH_IDS.map((id) => ({
                value: String(id),
                label: t(`branches.${id}`),
                icon: `/class-icons/${BRANCH_ICON[id]}.webp`,
              })),
            ]}
            className="w-44"
          />
        )}
        <Select
          value={rarity}
          onChange={withPageReset(setRarity)}
          options={[
            { value: '', label: t('allRarities') },
            ...RARITY_ORDER.map((r) => ({
              value: r,
              label: t(`rarities.${r}`),
            })),
          ]}
          className="w-40"
        />
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
          options={['levelAsc', 'levelDesc', 'nameAsc', 'priceDesc'].map(
            (s) => ({ value: s, label: t(`sort.${s}`) }),
          )}
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

          {pageItems.length === 0 ? (
            <div className="rounded-base border border-border bg-raised py-16 text-center text-sm text-muted">
              {t('empty')}
            </div>
          ) : (
            <div className="space-y-2">
              {pageItems.map((item) => {
                const rk = itemRarity(item);
                const rc = rk ? rarityStyle(rk) : null;
                return (
                <article
                  key={item.id}
                  className="rounded-base border border-border bg-raised px-3 py-2.5 transition-colors hover:border-gold/40"
                >
                  <div className="flex items-start gap-3 sm:items-center">
                  <ItemIcon
                    icon={item.icon}
                    size={40}
                    className="mt-0.5 rounded-[4px] border bg-surface sm:mt-0"
                    style={
                      rc
                        ? { borderColor: rc.color, backgroundColor: rc.soft }
                        : undefined
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span
                        className={`text-sm font-medium ${rc ? '' : 'text-foreground'}`}
                        style={rc ? { color: rc.color } : undefined}
                      >
                        {item.name}
                      </span>
                      {item.slot && (
                        <span className="rounded-full bg-gold-soft px-1.5 py-0.5 text-[10px] font-medium text-gold">
                          {t(`slots.${item.slot}`)}
                        </span>
                      )}
                      {item.weapon && (
                        <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted">
                          {t(`weapons.${item.weapon}`)}
                        </span>
                      )}
                      {(item.gender === 1 || item.gender === 2) && (
                        <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted">
                          {t(item.gender === 1 ? 'genderMale' : 'genderFemale')}
                        </span>
                      )}
                      {item.set != null && (
                        <button
                          onClick={() =>
                            setOpenPanel(
                              openPanel?.id === item.id &&
                                openPanel.kind === 'set'
                                ? null
                                : { id: item.id, kind: 'set' },
                            )
                          }
                          aria-expanded={
                            openPanel?.id === item.id &&
                            openPanel.kind === 'set'
                          }
                          className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                            openPanel?.id === item.id &&
                            openPanel.kind === 'set'
                              ? 'border-gold/60 bg-gold-soft text-gold'
                              : 'border-gold/40 text-gold hover:bg-gold-soft'
                          }`}
                        >
                          {t('setBadge')} ▾
                        </button>
                      )}
                      {item.drops != null && item.drops > 0 && (
                        <button
                          onClick={() =>
                            setOpenPanel(
                              openPanel?.id === item.id &&
                                openPanel.kind === 'drops'
                                ? null
                                : { id: item.id, kind: 'drops' },
                            )
                          }
                          aria-expanded={
                            openPanel?.id === item.id &&
                            openPanel.kind === 'drops'
                          }
                          className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                            openPanel?.id === item.id &&
                            openPanel.kind === 'drops'
                              ? 'border-[var(--border-success)] bg-[var(--success-soft)] text-[var(--fg-success)]'
                              : 'border-[var(--border-success)] text-[var(--fg-success)] hover:bg-[var(--success-soft)]'
                          }`}
                        >
                          {t('dropBadge', { count: item.drops })} ▾
                        </button>
                      )}
                      {item.classes && item.classes.length > 0 ? (
                        <span
                          className="inline-flex items-center gap-0.5"
                          title={item.classes
                            .map((c) => t(`branches.${c}`))
                            .join(', ')}
                        >
                          {item.classes.map((c) => (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              key={c}
                              src={`/class-icons/${BRANCH_ICON[c]}.webp`}
                              alt={t(`branches.${c}`)}
                              className="h-4 w-4"
                              draggable={false}
                            />
                          ))}
                        </span>
                      ) : (
                        slotted && (
                          <span className="text-[10px] text-muted">
                            {t('allClassesTag')}
                          </span>
                        )
                      )}
                    </div>
                    {item.desc && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                        {item.desc}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                      {statChips(item.stats, t).map((chip) => (
                        <span key={chip} className="whitespace-nowrap">
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {item.level > 0 && (
                      <span className="text-xs font-semibold text-foreground tabular-nums">
                        Lv. {item.level}
                      </span>
                    )}
                    {item.price > 0 && (
                      <Currency copper={item.price} className="text-xs" />
                    )}
                  </div>
                  </div>

                  {openPanel?.id === item.id &&
                    openPanel.kind === 'set' &&
                    item.set != null && (
                      <SetPanel
                        set={setById.get(item.set)}
                        currentId={item.id}
                        t={t}
                      />
                    )}
                  {openPanel?.id === item.id && openPanel.kind === 'drops' && (
                    <DropsPanel drops={dropData?.[item.id]} t={t} />
                  )}
                </article>
                );
              })}
            </div>
          )}

          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </>
      )}
    </main>
  );
}
