'use client';

import { useMemo } from 'react';
import { m } from 'motion/react';
import type { Skill } from '@/types';
import {
  canIncrement,
  maxPointsAtLevel,
  skillSpCost,
  spBaseForClass,
  type Allocations,
} from '@/lib/skill-build';

interface Props {
  skills: Skill[];
  classId: number;
  charLevel: number;
  allocations: Allocations;
  onChange?: (next: Allocations) => void;
  readOnly?: boolean;
  tierLabels?: string[]; // [base, 1st, 2nd, 3rd job]
  bonusSp?: number;
}

const CELL = 62; // grid step
const ICON = 44; // icon box
const HEAD = 34; // panel header height

function initials(name: string) {
  return name.replace(/\[[^\]]*\]/g, '').trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '').join('');
}

// A single skill icon + "+" button + level pill, with a hover tooltip.
function SkillCell({
  skill, cur, locked, charLevel, allocations, byId, canAdd, onAdd, onRemove, readOnly,
}: {
  skill: Skill; cur: number; locked: boolean; charLevel: number; allocations: Allocations;
  byId: Map<number, Skill>; canAdd: boolean; onAdd: () => void; onRemove: () => void; readOnly?: boolean;
}) {
  const capped = maxPointsAtLevel(skill, charLevel);
  const maxed = cur >= skill.max_level;
  const prereqs = skill.prerequisites ?? [];
  const lvl = skill.levels.find((l) => l.level === Math.max(1, cur));

  return (
    <div className="group relative select-none" style={{ width: ICON }}>
      <div
        className={`relative h-11 w-11 overflow-visible rounded-[6px] ${!readOnly ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]' : ''}`}
        // Keyboard support: the cell is a real tab stop; Enter/Space/+ adds a
        // point, Delete/Backspace/- removes one (mirrors click / right-click).
        role={readOnly ? undefined : 'button'}
        tabIndex={readOnly ? undefined : 0}
        aria-label={
          readOnly ? undefined : `${skill.name} ${cur}/${skill.max_level}`
        }
        onClick={() => !readOnly && onAdd()}
        onContextMenu={(e) => { if (readOnly) return; e.preventDefault(); onRemove(); }}
        onKeyDown={(e) => {
          if (readOnly) return;
          if (e.key === 'Enter' || e.key === ' ' || e.key === '+') {
            e.preventDefault();
            onAdd();
          } else if (
            e.key === 'Delete' ||
            e.key === 'Backspace' ||
            e.key === '-'
          ) {
            e.preventDefault();
            onRemove();
          }
        }}
      >
        <div className={`h-full w-full overflow-hidden rounded-[6px] border ${
          cur > 0 ? 'border-[var(--gold)] ring-1 ring-[var(--gold)]' : locked ? 'border-[var(--border)]' : 'border-[var(--border)]'
        }`}>
          {skill.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={skill.icon_url} alt="" draggable={false}
              className={`h-full w-full object-cover ${locked ? 'opacity-60 grayscale' : ''}`} />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[var(--raised)] text-[10px] font-bold text-muted">
              {initials(skill.name)}
            </div>
          )}
        </div>
        {/* − button (remove a point), shown when the skill has points */}
        {!readOnly && cur > 0 && (
          <button type="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute -left-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-[3px] border border-[var(--border-danger)] bg-[var(--danger)] text-[11px] font-bold leading-none text-white shadow"
            aria-label="remove point">−</button>
        )}
        {/* + button, shown when a point can be added */}
        {!readOnly && canAdd && (
          <button type="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onAdd(); }}
            className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-[3px] border border-[var(--gold-dim)] bg-[var(--gold)] text-[11px] font-bold leading-none text-[var(--root)] shadow"
            aria-label="add point">+</button>
        )}
      </div>

      {/* level pill */}
      <div className="mx-auto mt-1 w-11 rounded-[3px] bg-[var(--root)] text-center text-[10px] font-bold leading-[15px] tabular-nums">
        <span className={maxed ? 'text-gold' : cur > 0 ? 'text-[var(--gold-strong)]' : 'text-foreground'}>{cur}</span>
        <span className="text-muted">/{skill.max_level}</span>
      </div>

      {/* hover / keyboard-focus detail */}
      <div className="pointer-events-none absolute left-1/2 top-full z-40 mt-1 hidden w-52 -translate-x-1/2 rounded-md border border-border bg-[var(--raised)] p-2.5 text-[11px] leading-relaxed text-muted shadow-xl group-hover:block group-focus-within:block">
        <div className="mb-1 font-semibold text-foreground">{skill.name}</div>
        {skill.description && <p className="mb-1">{skill.description}</p>}
        <div className="mb-1 flex flex-wrap gap-x-3 text-[10px] text-[var(--dark-gray)]">
          <span>Req Lv.{skill.req_level}</span>
          {!!lvl?.mp && lvl.mp > 0 && <span>MP {lvl.mp}</span>}
          {!!lvl?.cooldown && lvl.cooldown > 0 && (
            <span>CD {(lvl.cooldown / 1000).toFixed(1)}s</span>
          )}
          {!!lvl?.sp && <span>SP {lvl.sp}</span>}
          {capped < skill.max_level && <span className="text-gold">max {capped} now</span>}
        </div>
        {prereqs.length > 0 && (
          <div className="mt-1 border-t border-border pt-1">
            {prereqs.map((p) => {
              const met = Number(allocations[p.id] ?? 0) >= p.level;
              return (
                <div key={p.id} className={met ? 'text-[10px] text-[#6fcf7f]' : 'text-[10px] text-[var(--danger)]'}>
                  {met ? '✓' : '✕'} {byId.get(p.id)?.name ?? `#${p.id}`} Lv.{p.level}
                </div>
              );
            })}
          </div>
        )}
        {!readOnly && <div className="mt-1 text-[9px] text-[var(--dark-gray)]">Click +1 · Right-click −1</div>}
      </div>
    </div>
  );
}

// One tier = one light "skill window" panel with its own grid + prereq arrows.
function TierPanel({
  label, list, allSkills, byId, classId, spBase, bonusSp, charLevel, allocations, onChange, readOnly,
}: {
  label: string; list: Skill[]; allSkills: Skill[]; byId: Map<number, Skill>;
  classId: number; spBase: number; bonusSp: number; charLevel: number; allocations: Allocations;
  onChange?: (n: Allocations) => void; readOnly?: boolean;
}) {
  const pos = (s: Skill) => s.positions[String(classId)];
  const idsHere = new Set(list.map((s) => s.id));

  const { minX, minY, W, H } = useMemo(() => {
    let mnX = Infinity, mnY = Infinity, mxX = 0, mxY = 0;
    for (const s of list) {
      const [, x, y] = pos(s);
      mnX = Math.min(mnX, x); mnY = Math.min(mnY, y);
      mxX = Math.max(mxX, x); mxY = Math.max(mxY, y);
    }
    return { minX: mnX, minY: mnY, W: (mxX - mnX + 1) * CELL, H: (mxY - mnY + 1) * CELL };
  }, [list]); // eslint-disable-line react-hooks/exhaustive-deps

  const gx = (s: Skill) => (pos(s)[1] - minX) * CELL;
  const gy = (s: Skill) => (pos(s)[2] - minY) * CELL;
  const cxv = (s: Skill) => gx(s) + ICON / 2;

  const spSpent = list.reduce(
    (n, s) => n + skillSpCost(s, Number(allocations[s.id] ?? 0)),
    0,
  );

  const add = (s: Skill) => {
    if (!onChange || !canIncrement(s, charLevel, allocations, allSkills, spBase, bonusSp).ok) return;
    onChange({ ...allocations, [s.id]: Number(allocations[s.id] ?? 0) + 1 });
  };
  const remove = (s: Skill) => {
    if (!onChange) return;
    const cur = Number(allocations[s.id] ?? 0);
    if (cur <= 0) return;
    const next = { ...allocations };
    if (cur - 1 <= 0) delete next[s.id]; else next[s.id] = cur - 1;
    onChange(next);
  };
  const locked = (s: Skill) =>
    charLevel < s.req_level || (s.prerequisites ?? []).some((p) => Number(allocations[p.id] ?? 0) < p.level);

  const mId = `arw-${classId}-${label.replace(/\W/g, '')}`;

  return (
    <div className="flex min-w-[180px] shrink-0 flex-col rounded-[6px] border border-border bg-surface p-3 shadow-sm">
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="text-[15px] font-semibold text-foreground">{label}</h3>
        <span className="text-[11px] font-medium text-muted">{spSpent} SP</span>
      </div>
      <div className="relative self-center" style={{ width: W, height: H }}>
        <svg className="pointer-events-none absolute inset-0" width={W} height={H}>
          <defs>
            <marker id={mId} markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="var(--gold-dim)" />
            </marker>
          </defs>
          {list.flatMap((s) =>
            (s.prerequisites ?? [])
              .filter((p) => idsHere.has(p.id))
              .map((p) => byId.get(p.id)!)
              .filter(Boolean)
              .map((par) => {
                const sx = cxv(par), sy = gy(par) + ICON; // parent bottom-center
                const ex = cxv(s), ey = gy(s); // child top-center
                const midY = (sy + ey) / 2;
                const d = sx === ex
                  ? `M${sx},${sy} L${ex},${ey - 2}`
                  : `M${sx},${sy} L${sx},${midY} L${ex},${midY} L${ex},${ey - 2}`;
                return (
                  <path key={`${par.id}-${s.id}`} d={d} fill="none"
                    stroke="var(--gold-dim)" strokeWidth="2" markerEnd={`url(#${mId})`} />
                );
              }),
          )}
        </svg>
        {list.map((s) => (
          <div key={s.id} className="absolute" style={{ left: gx(s), top: gy(s) }}>
            <SkillCell skill={s} cur={Number(allocations[s.id] ?? 0)} locked={locked(s)}
              charLevel={charLevel} allocations={allocations} byId={byId}
              canAdd={!!onChange && canIncrement(s, charLevel, allocations, allSkills, spBase, bonusSp).ok}
              onAdd={() => add(s)} onRemove={() => remove(s)} readOnly={readOnly} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkillTree({
  skills, classId, charLevel, allocations, onChange, readOnly, tierLabels, bonusSp = 0,
}: Props) {
  const byId = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const posOf = (s: Skill) => s.positions?.[String(classId)];

  const tiers = useMemo(() => {
    const g: Skill[][] = [[], [], [], []];
    for (const s of skills) { const p = posOf(s); if (p) g[p[0]].push(s); }
    return g;
  }, [skills, classId]); // eslint-disable-line react-hooks/exhaustive-deps
  const extras = useMemo(() => skills.filter((s) => !posOf(s)), [skills, classId]); // eslint-disable-line react-hooks/exhaustive-deps
  const spBase = spBaseForClass(classId);

  const add = (s: Skill) => {
    if (!onChange || !canIncrement(s, charLevel, allocations, skills, spBase, bonusSp).ok) return;
    onChange({ ...allocations, [s.id]: Number(allocations[s.id] ?? 0) + 1 });
  };
  const remove = (s: Skill) => {
    if (!onChange) return;
    const cur = Number(allocations[s.id] ?? 0);
    if (cur <= 0) return;
    const next = { ...allocations };
    if (cur - 1 <= 0) delete next[s.id]; else next[s.id] = cur - 1;
    onChange(next);
  };
  const locked = (s: Skill) =>
    charLevel < s.req_level || (s.prerequisites ?? []).some((p) => Number(allocations[p.id] ?? 0) < p.level);

  return (
    <div className="flex flex-col items-stretch gap-4">
      {tiers.map((list, t) =>
        list.length ? (
          <m.div
            key={t}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: t * 0.08, ease: 'easeOut' }}
          >
            <TierPanel label={tierLabels?.[t] ?? ['Base', '1st', '2nd', '3rd'][t]}
              list={list} allSkills={skills} byId={byId} classId={classId} spBase={spBase} bonusSp={bonusSp}
              charLevel={charLevel} allocations={allocations} onChange={onChange} readOnly={readOnly} />
          </m.div>
        ) : null,
      )}

      {extras.length > 0 && (
        <div className="rounded-[6px] border border-border bg-surface p-3 shadow-sm">
          <h3 className="mb-2 text-[15px] font-semibold text-foreground">
            Other <span className="text-[11px] font-medium text-muted">{extras.length}</span>
          </h3>
          <div className="grid max-w-[280px] grid-cols-5 gap-x-1 gap-y-3">
            {extras.map((s) => (
              <SkillCell key={s.id} skill={s} cur={Number(allocations[s.id] ?? 0)} locked={locked(s)}
                charLevel={charLevel} allocations={allocations} byId={byId}
                canAdd={!!onChange && canIncrement(s, charLevel, allocations, skills, spBase, bonusSp).ok}
                onAdd={() => add(s)} onRemove={() => remove(s)} readOnly={readOnly} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
