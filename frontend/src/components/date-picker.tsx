"use client";

import * as RP from "@radix-ui/react-popover";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

// Values are the same `YYYY-MM-DD` strings a native <input type="date"> uses,
// so this drops into existing forms without touching their state or payloads.
type DateValue = string;

const DAY_MS = 86400000;

function toValue(d: Date): DateValue {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Parse as *local* midnight. `new Date('2026-07-09')` would parse as UTC and
// can land on the previous day west of Greenwich.
function fromValue(v: DateValue): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

// The 42 cells (6 rows) of a month grid, starting on Sunday. A fixed cell count
// keeps the panel from resizing as the user pages between months.
function monthGrid(view: Date): Date[] {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from(
    { length: 42 },
    (_, i) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
}

/**
 * Themed date picker built on @radix-ui/react-popover, styled with this
 * project's dark/gold tokens. Replaces <input type="date">, whose calendar
 * popup is browser chrome and cannot be styled.
 *
 * Locale-aware via next-intl: Thai renders month/weekday names and the
 * Buddhist era through Intl, matching `useDateFormatter`.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder,
  id,
  className = "",
  disabled = false,
}: {
  value: DateValue;
  onChange: (value: DateValue) => void;
  /** Earliest selectable date, as `YYYY-MM-DD`. Earlier days render disabled. */
  min?: DateValue;
  /** Latest selectable date, as `YYYY-MM-DD`. Later days render disabled. */
  max?: DateValue;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("datePicker");
  const locale = useLocale();
  const intlLocale = locale === "th" ? "th-TH" : "en-US";

  const selected = fromValue(value);
  const minDate = min ? fromValue(min) : null;
  const maxDate = max ? fromValue(max) : null;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => selected ?? new Date());
  // Day the arrow keys are on. Kept separate from `selected` so the grid can be
  // explored without committing a value.
  const [focused, setFocused] = useState<Date>(() => selected ?? new Date());
  const gridRef = useRef<HTMLDivElement>(null);

  // Re-open onto the selected month rather than wherever the user last paged.
  // Done in the open handler, not an effect, so it is one render rather than a
  // cascading one.
  const handleOpenChange = (next: boolean) => {
    if (next) {
      const base = selected ?? new Date();
      setView(base);
      setFocused(base);
    }
    setOpen(next);
  };

  // Keep DOM focus on the active day so arrow keys and screen readers agree.
  useEffect(() => {
    if (!open) return;
    gridRef.current
      ?.querySelector<HTMLButtonElement>('[data-focused="true"]')
      ?.focus();
  }, [open, focused]);

  const monthLabel = new Intl.DateTimeFormat(intlLocale, {
    month: "long",
    year: "numeric",
  }).format(view);

  // Weekday initials from Intl (Sun-first), so Thai gets Thai letters.
  const weekdayFmt = new Intl.DateTimeFormat(intlLocale, { weekday: "short" });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    weekdayFmt.format(new Date(2024, 8, 1 + i)),
  );

  // Full date for each day button's accessible name — "19" alone is meaningless
  // out of the visual grid context a screen reader doesn't convey.
  const fullDateFmt = new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "full",
  });

  const today = startOfDay(new Date());
  const isDisabled = (d: Date) => {
    const day = startOfDay(d);
    if (minDate && day < startOfDay(minDate)) return true;
    if (maxDate && day > startOfDay(maxDate)) return true;
    return false;
  };
  const sameDay = (a: Date, b: Date | null) => !!b && toValue(a) === toValue(b);

  const shiftView = (months: number) =>
    setView((v) => new Date(v.getFullYear(), v.getMonth() + months, 1));

  const commit = (d: Date) => {
    if (isDisabled(d)) return;
    onChange(toValue(d));
    setOpen(false);
  };

  // Arrow keys move by day/week, PageUp/PageDown by month, Home/End to the
  // ends of the week — the conventions of a native calendar grid.
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const step = (days: number) => {
      e.preventDefault();
      const next = new Date(focused.getTime() + days * DAY_MS);
      setFocused(next);
      if (next.getMonth() !== view.getMonth()) setView(next);
    };
    switch (e.key) {
      case "ArrowLeft":
        return step(-1);
      case "ArrowRight":
        return step(1);
      case "ArrowUp":
        return step(-7);
      case "ArrowDown":
        return step(7);
      case "Home":
        return step(-focused.getDay());
      case "End":
        return step(6 - focused.getDay());
      case "PageUp":
        e.preventDefault();
        setFocused(
          new Date(
            focused.getFullYear(),
            focused.getMonth() - 1,
            focused.getDate(),
          ),
        );
        return shiftView(-1);
      case "PageDown":
        e.preventDefault();
        setFocused(
          new Date(
            focused.getFullYear(),
            focused.getMonth() + 1,
            focused.getDate(),
          ),
        );
        return shiftView(1);
      case "Enter":
      case " ":
        e.preventDefault();
        return commit(focused);
    }
  };

  const triggerLabel = selected
    ? new Intl.DateTimeFormat(intlLocale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(selected)
    : (placeholder ?? t("placeholder"));

  const navButton =
    "inline-flex h-7 w-7 items-center justify-center rounded-base text-muted transition-colors hover:bg-raised hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus)]";

  return (
    <RP.Root open={open} onOpenChange={handleOpenChange}>
      <RP.Trigger
        id={id}
        disabled={disabled}
        className={`flex w-full items-center justify-between gap-2 rounded-base border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors hover:border-[var(--border-dark)] focus:border-[var(--focus)] data-[state=open]:border-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50 ${
          selected ? "text-foreground" : "text-muted"
        } ${className}`}
      >
        <span className="min-w-0 truncate text-left">{triggerLabel}</span>
        <Calendar className="h-4 w-4 shrink-0 text-muted" />
      </RP.Trigger>

      <RP.Portal>
        <RP.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[17.5rem] rounded-base border border-border bg-surface p-3 shadow-sm"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">
              {monthLabel}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftView(-1)}
                aria-label={t("prevMonth")}
                className={navButton}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => shiftView(1)}
                aria-label={t("nextMonth")}
                className={navButton}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {weekdays.map((w, i) => (
              <span
                key={i}
                className="flex h-7 items-center justify-center text-[11px] font-medium text-dark-gray"
              >
                {w}
              </span>
            ))}
          </div>

          {/* Plain buttons with a roving tabindex rather than the ARIA grid
              pattern — a real grid needs role="row" wrappers, and the labelled
              buttons already read correctly. */}
          <div
            ref={gridRef}
            onKeyDown={onGridKeyDown}
            className="grid grid-cols-7 gap-0.5"
          >
            {monthGrid(view).map((d) => {
              const outside = d.getMonth() !== view.getMonth();
              const isSelected = sameDay(d, selected);
              const isToday = sameDay(d, today);
              const off = isDisabled(d);
              return (
                <button
                  key={d.getTime()}
                  type="button"
                  disabled={off}
                  aria-label={fullDateFmt.format(d)}
                  aria-pressed={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  data-focused={sameDay(d, focused)}
                  tabIndex={sameDay(d, focused) ? 0 : -1}
                  onClick={() => commit(d)}
                  className={`flex h-8 items-center justify-center rounded-base text-sm transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus)] ${
                    isSelected
                      ? "bg-gold font-semibold text-[#1b1407]"
                      : off
                        ? "cursor-not-allowed text-[var(--fg-disabled)]"
                        : outside
                          ? "text-dark-gray hover:bg-raised hover:text-muted"
                          : "text-foreground hover:bg-raised"
                  } ${isToday && !isSelected ? "ring-1 ring-inset ring-gold/50" : ""}`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="rounded-base px-2 py-1 text-xs text-muted transition-colors hover:text-foreground"
            >
              {t("clear")}
            </button>
            <button
              type="button"
              onClick={() => commit(today)}
              disabled={isDisabled(today)}
              className="rounded-base px-2 py-1 text-xs font-medium text-gold transition-colors hover:text-gold-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("today")}
            </button>
          </div>
        </RP.Content>
      </RP.Portal>
    </RP.Root>
  );
}
