"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  LogIn,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/toast";
import { useHasSession } from "@/hooks/use-session";
import { useLoginPrompt } from "@/components/login-prompt";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DatePicker } from "@/components/date-picker";
import { useDateFormatter } from "@/lib/i18n";

type GameEvent = {
  id: string;
  title: string;
  start_date: string; // YYYY-MM-DD (inclusive)
  end_date: string; // YYYY-MM-DD (inclusive)
  start_time: string; // HH:mm:ss (00:00:00 = no specific time)
  end_time: string; // HH:mm:ss
  detail: string | null;
  link: string | null;
  created_at: string;
  created_by: string | null;
};

// Per-event bar colours (dark-tuned to match the app). Picked by a stable hash
// of the id so an event keeps its colour across renders and months. Ten hues
// spread around the wheel so a busy month (~20 events) reads with far less
// colour repetition; the title on each bar is still the real identifier.
const BAR_STYLES = [
  "bg-[#3b2f14] text-[#f0d68a] border-[#5a4a1e]", // gold
  "bg-[#332018] text-[#f0bfa0] border-[#553527]", // orange
  "bg-[#3a1c22] text-[#f0a8b8] border-[#5e2c38]", // rose
  "bg-[#361a2e] text-[#f0b0dc] border-[#57294a]", // pink
  "bg-[#2a1f33] text-[#d9b8f0] border-[#443055]", // purple
  "bg-[#221f3a] text-[#b8b8f0] border-[#39345e]", // indigo
  "bg-[#1b2a3a] text-[#a8cdf0] border-[#2c4661]", // blue
  "bg-[#15303a] text-[#8fd8e8] border-[#204c5a]", // cyan
  "bg-[#16302b] text-[#8fe3cf] border-[#245047]", // teal
  "bg-[#1e3320] text-[#a8e0a0] border-[#2f5030]", // green
];

// The palette class for a resolved colour index (see assignColors).
function colorClass(idx: number): string {
  return BAR_STYLES[idx % BAR_STYLES.length];
}

// An event's preferred colour: a stable hash of its id.
function hashColor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % 997;
  return h % BAR_STYLES.length;
}

// ---- date helpers (all day-level, local) -----------------------------------

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A month grid of Monday-started weeks (each a list of 7 YYYY-MM-DD strings),
// including the leading/trailing days that fill the first and last rows.
function buildWeeks(year: number, month: number): string[][] {
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7; // Mon = 0 … Sun = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const numWeeks = Math.ceil((startWeekday + daysInMonth) / 7);

  const cursor = new Date(year, month, 1 - startWeekday);
  const weeks: string[][] = [];
  for (let w = 0; w < numWeeks; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(toYmd(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// Assign every event a stable lane (row) so a multi-day event keeps one line
// across the weeks it spans. Greedy interval colouring: an event takes the
// first lane whose previous event has already ended before it starts.
function assignLanes(events: GameEvent[]): Map<string, number> {
  const sorted = [...events].sort(
    (a, b) =>
      a.start_date.localeCompare(b.start_date) ||
      b.end_date.localeCompare(a.end_date) || // longer runs first
      a.id.localeCompare(b.id),
  );
  const laneEnd: string[] = []; // last end_date placed in each lane
  const lanes = new Map<string, number>();
  for (const e of sorted) {
    let lane = laneEnd.findIndex((end) => end < e.start_date);
    if (lane === -1) {
      lane = laneEnd.length;
      laneEnd.push(e.end_date);
    } else {
      laneEnd[lane] = e.end_date;
    }
    lanes.set(e.id, lane);
  }
  return lanes;
}

// Assign every event a palette colour. Each event prefers its stable hash
// colour, but if that colour is already taken by an event it overlaps in time,
// it steps to the nearest free colour instead. So concurrently-running events
// (the ones that stack as separate bars in a week) never share a colour, as
// long as fewer than BAR_STYLES.length overlap at once. Like the lane, the
// colour is stable within a month but can shift between months as the
// surrounding events change.
function assignColors(events: GameEvent[]): Map<string, number> {
  const sorted = [...events].sort(
    (a, b) =>
      a.start_date.localeCompare(b.start_date) ||
      b.end_date.localeCompare(a.end_date) ||
      a.id.localeCompare(b.id),
  );
  const colors = new Map<string, number>();
  const active: { end: string; color: number }[] = []; // still-open intervals
  for (const e of sorted) {
    const taken = new Set<number>();
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].end < e.start_date) active.splice(i, 1);
      else taken.add(active[i].color);
    }
    const preferred = hashColor(e.id);
    let color = preferred;
    if (taken.has(color)) {
      for (let k = 1; k < BAR_STYLES.length; k++) {
        const c = (preferred + k) % BAR_STYLES.length;
        if (!taken.has(c)) {
          color = c;
          break;
        }
      }
    }
    colors.set(e.id, color);
    active.push({ end: e.end_date, color });
  }
  return colors;
}

type Segment = {
  event: GameEvent;
  colStart: number; // 1-based grid column
  span: number;
  lane: number;
  continuesLeft: boolean;
  continuesRight: boolean;
};

// The bar segments to draw for one week, clamped to the week's Mon–Sun bounds.
function weekSegments(
  week: string[],
  events: GameEvent[],
  lanes: Map<string, number>,
): Segment[] {
  const weekStart = week[0];
  const weekEnd = week[6];
  const segs: Segment[] = [];
  for (const e of events) {
    if (e.end_date < weekStart || e.start_date > weekEnd) continue;
    const segStart = e.start_date < weekStart ? weekStart : e.start_date;
    const segEnd = e.end_date > weekEnd ? weekEnd : e.end_date;
    const colStart = week.indexOf(segStart) + 1;
    const colEnd = week.indexOf(segEnd) + 1;
    segs.push({
      event: e,
      colStart,
      span: colEnd - colStart + 1,
      lane: lanes.get(e.id) ?? 0,
      continuesLeft: e.start_date < weekStart,
      continuesRight: e.end_date > weekEnd,
    });
  }
  return segs;
}

function eventsOnDay(events: GameEvent[], ymd: string): GameEvent[] {
  return events
    .filter((e) => e.start_date <= ymd && e.end_date >= ymd)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
}

type EventStatus = "active" | "upcoming" | "ended";

function statusOf(e: GameEvent, today: string): EventStatus {
  if (e.end_date < today) return "ended";
  if (e.start_date > today) return "upcoming";
  return "active";
}

const STATUS_ORDER: Record<EventStatus, number> = {
  active: 0,
  upcoming: 1,
  ended: 2,
};

const STATUS_BADGE: Record<EventStatus, string> = {
  active:
    "border-[var(--border-success)] bg-[var(--success-soft)] text-[var(--fg-success)]",
  upcoming:
    "border-[var(--border-warning)] bg-[var(--warning-soft)] text-[var(--fg-warning)]",
  ended: "border-border bg-raised text-muted",
};

// Ongoing first, then the soonest upcoming, then the most-recently-ended. The
// summary list under the calendar reads the same "now" the badges do.
function sortForList(
  events: GameEvent[],
  today: string,
): { event: GameEvent; status: EventStatus }[] {
  return events
    .map((e) => ({ event: e, status: statusOf(e, today) }))
    .sort((a, b) => {
      if (a.status !== b.status) {
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      }
      if (a.status === "ended") {
        return b.event.end_date.localeCompare(a.event.end_date);
      }
      return a.event.start_date.localeCompare(b.event.start_date);
    });
}

// A description that clamps to a few lines, with a Read more / Show less
// toggle. The toggle appears only when the text is actually taller than the
// clamp, so short descriptions show in full with no button.
function EventDescription({ text }: { text: string }) {
  const t = useTranslations("timetable");
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    // Only measure while clamped; when expanded the clamp is off, so the
    // "does it overflow" answer is meaningless — keep the last collapsed value.
    if (!el || expanded) return;
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [text, expanded]);

  return (
    <div className="mt-1.5">
      <p
        ref={ref}
        className={`whitespace-pre-wrap break-words text-xs text-muted ${
          expanded ? "" : "line-clamp-3"
        }`}
      >
        {text}
      </p>
      {(overflowing || expanded) && (
        <button
          onClick={() => setExpanded((v) => !v)}
          // Muted + underlined so it reads as an expand control, not a link
          // (the event's link below is gold).
          className="mt-1 text-xs font-medium text-muted underline underline-offset-2 transition-colors hover:text-foreground"
        >
          {expanded ? t("showLess") : t("readMore")}
        </button>
      )}
    </div>
  );
}

// ---- page ------------------------------------------------------------------

export default function TimetablePage() {
  const t = useTranslations("timetable");
  const tc = useTranslations("common");
  const formatDate = useDateFormatter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hasSession, userId } = useHasSession();
  const promptLogin = useLoginPrompt();

  const now = new Date();
  const [cursor, setCursor] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });

  // "Today" as a local YYYY-MM-DD, kept fresh so the today-highlight and the
  // status badges roll over at midnight even if the tab is left open.
  const [today, setToday] = useState(() => toYmd(new Date()));
  useEffect(() => {
    const id = setInterval(() => {
      const d = toYmd(new Date());
      setToday((prev) => (prev === d ? prev : d));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const [selected, setSelected] = useState<GameEvent | null>(null);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GameEvent | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GameEvent | null>(null);

  // form fields
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("00:00");
  const [detail, setDetail] = useState("");
  const [link, setLink] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Details-list filter: the current (ongoing + upcoming) events, or the ones
  // that have already ended. Defaults to the current ones.
  const [listFilter, setListFilter] = useState<"current" | "ended">("current");

  const { data: events, isLoading } = useQuery<GameEvent[]>({
    queryKey: ["game-events"],
    queryFn: () => api.get("/events"),
  });

  const all = useMemo(() => events ?? [], [events]);
  // The calendar hides events that have already ended (end_date < today) — only
  // ongoing and upcoming runs are drawn as bars. Colours are still assigned from
  // every event so each keeps its colour in the details list after it ends.
  const calendarEvents = useMemo(
    () => all.filter((e) => e.end_date >= today),
    [all, today],
  );
  const listed = useMemo(() => sortForList(all, today), [all, today]);
  const visibleList = useMemo(
    () =>
      listed.filter(({ status }) =>
        listFilter === "ended" ? status === "ended" : status !== "ended",
      ),
    [listed, listFilter],
  );
  const lanes = useMemo(() => assignLanes(calendarEvents), [calendarEvents]);
  const colors = useMemo(() => assignColors(all), [all]);
  const weeks = useMemo(() => buildWeeks(cursor.year, cursor.month), [cursor]);

  const monthLabel = useMemo(
    () =>
      new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [cursor],
  );

  const weekdayLabels = t.raw("weekdays") as string[];

  const goPrev = () =>
    setCursor((c) =>
      c.month === 0
        ? { year: c.year - 1, month: 11 }
        : { year: c.year, month: c.month - 1 },
    );
  const goNext = () =>
    setCursor((c) =>
      c.month === 11
        ? { year: c.year + 1, month: 0 }
        : { year: c.year, month: c.month + 1 },
    );
  const goToday = () =>
    setCursor({ year: now.getFullYear(), month: now.getMonth() });

  // ---- form open/close ----

  const resetForm = useCallback(() => {
    setTitle("");
    setStartDate("");
    setEndDate("");
    setStartTime("00:00");
    setEndTime("00:00");
    setDetail("");
    setLink("");
    setFormError(null);
    setEditing(null);
    setFormOpen(false);
  }, []);

  // The form modal is a plain overlay (not a Radix Dialog), so close-on-Escape
  // is wired up here. A Dialog's focus trap would fight the date pickers'
  // portaled popovers, closing them the moment they open.
  useEffect(() => {
    if (!formOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resetForm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [formOpen, resetForm]);

  const openAdd = (isoDay?: string) => {
    if (!hasSession) {
      promptLogin("/timetable");
      return;
    }
    setEditing(null);
    setTitle("");
    setStartDate(isoDay ?? "");
    setEndDate(isoDay ?? "");
    setStartTime("00:00");
    setEndTime("00:00");
    setDetail("");
    setLink("");
    setFormError(null);
    setDayOpen(null);
    setFormOpen(true);
  };

  const startEdit = (e: GameEvent) => {
    setEditing(e);
    setTitle(e.title);
    setStartDate(e.start_date);
    setEndDate(e.end_date);
    // Stored as HH:mm:ss; the <input type="time"> wants HH:mm.
    setStartTime(e.start_time.slice(0, 5));
    setEndTime(e.end_time.slice(0, 5));
    setDetail(e.detail ?? "");
    setLink(e.link ?? "");
    setFormError(null);
    setSelected(null);
    setFormOpen(true);
  };

  const payload = () => ({
    title: title.trim(),
    startDate,
    endDate,
    startTime: startTime || "00:00",
    endTime: endTime || "00:00",
    detail: detail.trim() || undefined,
    link: link.trim() || undefined,
  });

  const createMut = useMutation({
    mutationFn: () => api.post("/events", payload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-events"] });
      resetForm();
      toast({ title: t("added"), variant: "success" });
    },
    onError: (e) => setFormError((e as Error).message),
  });

  const updateMut = useMutation({
    mutationFn: (id: string) => api.patch(`/events/${id}`, payload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-events"] });
      resetForm();
      toast({ title: t("updated"), variant: "success" });
    },
    onError: (e) => setFormError((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-events"] });
      setPendingDelete(null);
      setSelected(null);
      toast({ title: t("deleted"), variant: "success" });
    },
    onError: (e) =>
      toast({
        title: t("deleteError"),
        description: (e as Error).message,
        variant: "error",
      }),
  });

  const saving = createMut.isPending || updateMut.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setFormError(t("errors.required"));
      return;
    }
    if (!startDate || !endDate) {
      setFormError(t("errors.datesRequired"));
      return;
    }
    // Compare the whole instant so an end time before the start on the same day
    // is caught too (fixed-width strings make this lexicographic).
    if (`${endDate}T${endTime}` < `${startDate}T${startTime}`) {
      setFormError(t("errors.dateOrder"));
      return;
    }
    if (editing) updateMut.mutate(editing.id);
    else createMut.mutate();
  };

  // Parse a YYYY-MM-DD at local midnight (not UTC) so the displayed day never
  // shifts across a timezone offset.
  const fmtDay = (ymd: string, opts: Intl.DateTimeFormatOptions) =>
    formatDate(`${ymd}T00:00:00`, opts);

  // "date, time – date, time", with the time always shown (even 00:00). Used
  // everywhere an event's span is displayed so the format stays consistent.
  const rangeLabel = (e: GameEvent) => {
    const opts = { day: "numeric", month: "short", year: "numeric" } as const;
    const start = `${fmtDay(e.start_date, opts)}, ${e.start_time.slice(0, 5)}`;
    const end = `${fmtDay(e.end_date, opts)}, ${e.end_time.slice(0, 5)}`;
    return `${start} – ${end}`;
  };

  const dayEvents = dayOpen ? eventsOnDay(calendarEvents, dayOpen) : [];

  return (
    <main className="mx-auto max-w-container px-4 py-8 sm:px-7">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-foreground laptop:text-2xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
        </div>
        <button
          onClick={() => openAdd()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-base bg-gold px-4 py-2 text-sm font-semibold text-[#1b1407] shadow-button transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {t("add")}
        </button>
      </header>

      {/* Month toolbar */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={goPrev}
            aria-label={t("prevMonth")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-base border border-border text-muted transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goNext}
            aria-label={t("nextMonth")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-base border border-border text-muted transition-colors hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            className="ml-1 rounded-base border border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            {t("today")}
          </button>
        </div>
        <h2 className="text-lg font-bold tracking-tight text-foreground first-letter:uppercase laptop:text-2xl">
          {monthLabel}
        </h2>
      </div>

      {/* Calendar */}
      <div className="relative overflow-hidden rounded-lg border border-border bg-surface/40 shadow-sm">
        {/* Lit gold seam along the top edge, like the game's own panels. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 z-10 h-px bg-[linear-gradient(90deg,transparent,rgba(224,165,60,0.55),transparent)]"
        />
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-border bg-surface/80">
          {weekdayLabels.map((w, i) => (
            <div
              key={i}
              className={`px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider ${
                i >= 5 ? "text-gold-dim" : "text-muted"
              }`}
            >
              {w}
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        ) : (
          weeks.map((week, wi) => {
            const segs = weekSegments(week, calendarEvents, lanes);
            // Show every lane — the week row grows to fit rather than
            // collapsing the overflow into a "+N more" affordance.
            const laneRows = segs.reduce((m, s) => Math.max(m, s.lane + 1), 0);

            return (
              <div
                key={wi}
                className="relative min-h-[84px] border-b border-border last:border-b-0 laptop:min-h-[128px]"
              >
                {/* Per-day background: grid lines, weekend + out-of-month
                    tint, today highlight — and the whole-cell click target
                    that opens the day's event list. */}
                <div className="absolute inset-0 grid grid-cols-7">
                  {week.map((ymd, i) => {
                    const inMonth =
                      Number(ymd.slice(5, 7)) - 1 === cursor.month;
                    const isToday = ymd === today;
                    const weekend = i >= 5;
                    return (
                      <button
                        key={ymd}
                        onClick={() => setDayOpen(ymd)}
                        aria-label={fmtDay(ymd, {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                        className={`transition-colors hover:bg-gold-soft ${
                          i > 0 ? "border-l border-border" : ""
                        } ${
                          isToday
                            ? "bg-gold-soft"
                            : !inMonth
                              ? "bg-black/20"
                              : weekend
                                ? "bg-[rgba(224,165,60,0.025)]"
                                : ""
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Content overlay — the layer itself lets clicks fall through
                    to the day buttons above; only the bars/labels capture. */}
                <div className="pointer-events-none relative pb-1.5">
                  {/* date numbers */}
                  <div className="grid grid-cols-7">
                    {week.map((ymd) => {
                      const inMonth =
                        Number(ymd.slice(5, 7)) - 1 === cursor.month;
                      const isToday = ymd === today;
                      return (
                        <div
                          key={ymd}
                          className="flex items-start justify-end px-1.5 pt-1.5"
                        >
                          <span
                            className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] ${
                              isToday
                                ? "bg-gold font-semibold text-[#1b1407]"
                                : inMonth
                                  ? "text-foreground"
                                  : "text-dark-gray"
                            }`}
                          >
                            {Number(ymd.slice(8, 10))}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* event lanes */}
                  {Array.from({ length: laneRows }).map((_, lane) => (
                    <div key={lane} className="mt-1 grid grid-cols-7 px-1">
                      {segs
                        .filter((s) => s.lane === lane)
                        .map((s) => (
                          <button
                            key={s.event.id}
                            onClick={() => setSelected(s.event)}
                            title={s.event.title}
                            style={{
                              gridColumn: `${s.colStart} / span ${s.span}`,
                            }}
                            className={`pointer-events-auto truncate rounded-[4px] border px-2 py-[3px] text-left text-[11px] font-medium leading-tight shadow-sm transition-opacity hover:opacity-90 ${colorClass(
                              colors.get(s.event.id) ?? 0,
                            )} ${s.continuesLeft ? "rounded-l-none" : ""} ${
                              s.continuesRight ? "rounded-r-none" : ""
                            }`}
                          >
                            {s.continuesLeft ? "◂ " : ""}
                            {s.event.title}
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Event details — a summary of every event under the calendar, ongoing
          first. Clicking a row's title opens its modal; owners get edit/delete
          inline. */}
      {!isLoading && listed.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {t("detailsHeading")}
            </h2>
            <div className="flex flex-wrap gap-2">
              {(["current", "ended"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setListFilter(f)}
                  className={`rounded-base border px-3 py-1.5 text-sm transition-colors ${
                    listFilter === f
                      ? "border-gold/60 bg-gold-soft font-medium text-gold"
                      : "border-border text-muted hover:border-gold/40 hover:text-foreground"
                  }`}
                >
                  {t(`filter.${f}`)}
                </button>
              ))}
            </div>
          </div>
          {visibleList.length === 0 ? (
            <p className="rounded-base border border-border bg-raised px-4 py-6 text-center text-sm text-muted">
              {t("noneInFilter")}
            </p>
          ) : (
            <ul className="space-y-2">
              {visibleList.map(({ event: e, status }) => {
              const mine = !!userId && e.created_by === userId;
              return (
                <li
                  key={e.id}
                  className="rounded-base border border-border bg-raised px-4 py-3 transition-colors hover:border-gold/40"
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full border ${colorClass(
                        colors.get(e.id) ?? 0,
                      )}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_BADGE[status]}`}
                        >
                          {t(`status.${status}`)}
                        </span>
                        <button
                          onClick={() => setSelected(e)}
                          className="truncate text-left text-sm font-semibold text-foreground transition-colors hover:text-gold"
                        >
                          {e.title}
                        </button>
                        <span className="whitespace-nowrap text-xs text-muted">
                          {rangeLabel(e)}
                        </span>
                      </div>
                      {e.detail && <EventDescription text={e.detail} />}
                      {e.link && (
                        <a
                          href={e.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={t("openLink")}
                          className="mt-1.5 inline-flex items-start gap-1.5 text-xs text-gold underline-offset-2 transition-colors hover:text-gold-strong hover:underline"
                        >
                          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="break-all">{e.link}</span>
                        </a>
                      )}
                    </div>
                    {mine && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          onClick={() => startEdit(e)}
                          title={tc("edit")}
                          aria-label={tc("edit")}
                          className="inline-flex items-center rounded-base border border-border p-1.5 text-muted transition-colors hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setPendingDelete(e)}
                          title={tc("delete")}
                          aria-label={tc("delete")}
                          className="inline-flex items-center rounded-base border border-[var(--border-danger)] p-1.5 text-[var(--fg-danger)] transition-colors hover:bg-[var(--danger-soft)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
            </ul>
          )}
        </section>
      )}

      {/* Empty hint */}
      {!isLoading && all.length === 0 && (
        <div className="mt-4 rounded-base border border-border bg-raised py-10 text-center">
          <CalendarDays className="mx-auto mb-3 h-8 w-8 text-dark-gray" />
          <p className="text-sm text-muted">{t("empty")}</p>
          {!hasSession && (
            <button
              onClick={() => promptLogin("/timetable")}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:text-gold-strong"
            >
              <LogIn className="h-3.5 w-3.5" />
              {t("loginToAdd")}
            </button>
          )}
        </div>
      )}

      {/* ---- Event detail modal ---- */}
      <Dialog.Root
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[100] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-base border border-border bg-surface p-5 shadow-sm outline-none">
            {selected && (
              <>
                <div className="flex items-start justify-between gap-3">
                  <Dialog.Title className="text-base font-semibold text-foreground">
                    {selected.title}
                  </Dialog.Title>
                  <Dialog.Close
                    aria-label={tc("close")}
                    className="shrink-0 rounded-base p-1 text-muted transition-colors hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </Dialog.Close>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-gold">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {rangeLabel(selected)}
                </p>
                {selected.detail && (
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted">
                    {selected.detail}
                  </p>
                )}
                {selected.link && (
                  <div className="mt-4">
                    <p className="mb-1 text-xs font-medium text-muted">
                      {t("fields.link")}
                    </p>
                    <a
                      href={selected.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t("openLink")}
                      className="inline-flex items-start gap-1.5 text-sm text-gold underline-offset-2 transition-colors hover:text-gold-strong hover:underline"
                    >
                      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="break-all">{selected.link}</span>
                    </a>
                  </div>
                )}
                {!!userId && selected.created_by === userId && (
                  <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
                    <button
                      onClick={() => startEdit(selected)}
                      className="inline-flex items-center gap-1.5 rounded-base border border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {tc("edit")}
                    </button>
                    <button
                      onClick={() => setPendingDelete(selected)}
                      className="inline-flex items-center gap-1.5 rounded-base border border-[var(--border-danger)] px-3 py-1.5 text-sm font-medium text-[var(--fg-danger)] transition-colors hover:bg-[var(--danger-soft)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {tc("delete")}
                    </button>
                  </div>
                )}
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ---- Day list modal ---- */}
      <Dialog.Root
        open={!!dayOpen}
        onOpenChange={(o) => !o && setDayOpen(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[100] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-base border border-border bg-surface p-5 shadow-sm outline-none">
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="text-base font-semibold text-foreground">
                {dayOpen &&
                  fmtDay(dayOpen, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
              </Dialog.Title>
              <Dialog.Close
                aria-label={tc("close")}
                className="shrink-0 rounded-base p-1 text-muted transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            {dayEvents.length === 0 ? (
              <p className="mt-4 text-sm text-muted">{t("noEventsDay")}</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {dayEvents.map((e) => (
                  <li key={e.id}>
                    <button
                      onClick={() => {
                        setDayOpen(null);
                        setSelected(e);
                      }}
                      className="w-full rounded-base border border-border px-3 py-2 text-left transition-colors hover:border-gold/40"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full border ${colorClass(
                            colors.get(e.id) ?? 0,
                          )}`}
                        />
                        <span className="truncate text-sm font-medium text-foreground">
                          {e.title}
                        </span>
                      </span>
                      <span className="mt-0.5 block pl-[18px] text-xs text-muted">
                        {rangeLabel(e)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={() => openAdd(dayOpen ?? undefined)}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:text-gold-strong"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("addOnDay")}
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ---- Create / edit form modal ----
          A plain overlay rather than a Radix Dialog: the dialog's focus trap
          would steal focus from the date pickers' portaled popovers (z-110,
          above this modal) and close them the instant they open. Backdrop
          click + Escape + Cancel/✕ all dismiss it. */}
      {formOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          <div
            aria-hidden
            onClick={resetForm}
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
          />
          {/* min-h-full + items-center centres the card vertically yet still
              lets it scroll into view when it is taller than the viewport. */}
          <div className="relative flex min-h-full items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-label={editing ? t("editTitle") : t("addTitle")}
              className="relative z-[101] w-full max-w-2xl rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-7"
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  {editing ? t("editTitle") : t("addTitle")}
                </h2>
                <button
                  type="button"
                  onClick={resetForm}
                  aria-label={tc("close")}
                  className="shrink-0 rounded-base p-1 text-muted transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium text-muted">
                    {t("fields.title")} <span className="text-gold">*</span>
                  </span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder={t("fields.titlePlaceholder")}
                    autoFocus
                    maxLength={120}
                    className="w-full rounded-base border border-border bg-raised px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-[var(--focus)]"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted">
                    {t("fields.startDate")} <span className="text-gold">*</span>
                  </span>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <DatePicker
                        value={startDate}
                        onChange={(v) => {
                          setStartDate(v);
                          // Keep the end on/after the new start.
                          if (endDate && v && endDate < v) setEndDate(v);
                        }}
                      />
                    </div>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value || "00:00")}
                      aria-label={t("fields.startTime")}
                      className="w-[7.5rem] shrink-0 rounded-base border border-border bg-raised px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)]"
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted">
                    {t("fields.endDate")} <span className="text-gold">*</span>
                  </span>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <DatePicker
                        value={endDate}
                        min={startDate || undefined}
                        onChange={setEndDate}
                      />
                    </div>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value || "00:00")}
                      aria-label={t("fields.endTime")}
                      className="w-[7.5rem] shrink-0 rounded-base border border-border bg-raised px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--focus)]"
                    />
                  </div>
                </label>

                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium text-muted">
                    {t("fields.detail")}
                  </span>
                  <textarea
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    placeholder={t("fields.detailPlaceholder")}
                    maxLength={1000}
                    rows={3}
                    className="w-full resize-none rounded-base border border-border bg-raised px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-[var(--focus)]"
                  />
                </label>

                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium text-muted">
                    {t("fields.link")}
                  </span>
                  <input
                    type="url"
                    inputMode="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder={t("fields.linkPlaceholder")}
                    maxLength={500}
                    className="w-full rounded-base border border-border bg-raised px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-[var(--focus)]"
                  />
                </label>

                {formError && (
                  <p className="text-xs text-[var(--fg-danger)] sm:col-span-2">
                    {formError}
                  </p>
                )}

                <div className="mt-1 flex items-center justify-end gap-2 sm:col-span-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-base border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-base bg-gold px-4 py-2 text-sm font-semibold text-[#1b1407] shadow-button transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {editing ? t("saveChanges") : t("submit")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t("deleteTitle")}
        description={t("deleteConfirm", { title: pendingDelete?.title ?? "" })}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        danger
        loading={deleteMut.isPending}
        onConfirm={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
      />
    </main>
  );
}
