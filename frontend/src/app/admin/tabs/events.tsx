"use client";

import { Fragment, useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Pagination } from "@/components/pagination";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DatePicker } from "@/components/date-picker";
import { useToast } from "@/components/toast";
import { useDateFormatter } from "@/lib/i18n";
import { ITEMS_PER_PAGE } from "./shared";

type AdminEvent = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  start_time: string; // HH:mm:ss
  end_time: string;
  detail: string | null;
  link: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  profiles: { username: string | null } | null;
};

type AdminEventList = {
  events: AdminEvent[];
  total: number;
  page: number;
  pageSize: number;
};

export function EventsTab() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const formatDate = useDateFormatter();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // committed search (Enter/submit)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editStartTime, setEditStartTime] = useState("00:00");
  const [editEndTime, setEditEndTime] = useState("00:00");
  const [editDetail, setEditDetail] = useState("");
  const [editLink, setEditLink] = useState("");
  const [pendingDelete, setPendingDelete] = useState<AdminEvent | null>(null);

  const { data, isLoading } = useQuery<AdminEventList>({
    queryKey: ["admin", "events", query, page],
    queryFn: () => {
      const p = new URLSearchParams();
      if (query) p.set("search", query);
      p.set("page", String(page));
      return api.get(`/admin/events?${p.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
    // the public /timetable calendar reads the same rows
    queryClient.invalidateQueries({ queryKey: ["game-events"] });
  };

  const updateMut = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/admin/events/${id}`, {
        title: editTitle.trim(),
        startDate: editStart,
        endDate: editEnd,
        startTime: editStartTime || "00:00",
        endTime: editEndTime || "00:00",
        detail: editDetail.trim() || undefined,
        link: editLink.trim() || undefined,
      }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      toast({ title: t("eventUpdated"), variant: "success" });
    },
    onError: (e) =>
      toast({
        title: t("eventUpdateError"),
        description: (e as Error).message,
        variant: "error",
      }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/events/${id}`),
    onSuccess: () => {
      setPendingDelete(null);
      invalidate();
      toast({ title: t("eventDeleted"), variant: "success" });
    },
    onError: (e) =>
      toast({
        title: t("eventDeleteError"),
        description: (e as Error).message,
        variant: "error",
      }),
  });

  const paged = data?.events ?? [];
  const pageCount = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / (data?.pageSize ?? ITEMS_PER_PAGE)),
  );

  const dateOpts = { day: "numeric", month: "short", year: "numeric" } as const;
  const range = (e: AdminEvent) => {
    const sTime = e.start_time.slice(0, 5);
    const eTime = e.end_time.slice(0, 5);
    const withTime = sTime !== "00:00" || eTime !== "00:00";
    const startDay = formatDate(`${e.start_date}T00:00:00`, dateOpts);
    if (e.start_date === e.end_date) {
      return withTime ? `${startDay}, ${sTime} – ${eTime}` : startDay;
    }
    const endDay = formatDate(`${e.end_date}T00:00:00`, dateOpts);
    const start = withTime ? `${startDay}, ${sTime}` : startDay;
    const end = withTime ? `${endDay}, ${eTime}` : endDay;
    return `${start} – ${end}`;
  };

  const startEdit = (e: AdminEvent) => {
    setEditingId(e.id);
    setEditTitle(e.title);
    setEditStart(e.start_date);
    setEditEnd(e.end_date);
    setEditStartTime(e.start_time.slice(0, 5));
    setEditEndTime(e.end_time.slice(0, 5));
    setEditDetail(e.detail ?? "");
    setEditLink(e.link ?? "");
  };

  // Mirror the API's guard so the save button reflects what will be accepted —
  // compare the whole instant so an inverted time on a single day is caught.
  const editValid =
    !!editTitle.trim() &&
    !!editStart &&
    !!editEnd &&
    `${editEnd}T${editEndTime}` >= `${editStart}T${editStartTime}`;

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-5">
        <p className="text-[11px] uppercase tracking-wider text-muted mb-2">
          {t("eventsTotal")}
        </p>
        <p className="text-2xl font-bold text-gold tabular-nums">
          {data?.total ?? 0}
        </p>
      </div>

      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(search);
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("eventSearchPlaceholder")}
            className="mb-4 w-full max-w-sm rounded-base border border-border bg-raised px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
          />
        </form>
        {isLoading ? (
          <p className="text-xs text-muted">{tc("loading")}</p>
        ) : paged.length === 0 ? (
          <p className="text-xs text-muted">{t("eventsNone")}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t("colEvent")}
                    </th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t("colDates")}
                    </th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t("colAuthor")}
                    </th>
                    <th className="pb-3 text-right text-xs font-medium text-muted"></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((e) => {
                    const editing = editingId === e.id;
                    return (
                      <Fragment key={e.id}>
                        <tr className="border-b border-[rgba(255,255,255,0.05)] align-top">
                          <td className="py-3 pr-3">
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                              {e.title}
                              {e.link && (
                                <a
                                  href={e.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted transition-colors hover:text-gold"
                                  aria-label={t("colLink")}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </span>
                            {e.detail && (
                              <p className="mt-0.5 max-w-[280px] truncate text-xs text-muted">
                                {e.detail}
                              </p>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-xs text-muted whitespace-nowrap">
                            {range(e)}
                          </td>
                          <td className="py-3 pr-3 text-sm text-foreground">
                            {e.profiles?.username || "—"}
                          </td>
                          <td className="py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() =>
                                  editing ? setEditingId(null) : startEdit(e)
                                }
                                title={tc("edit")}
                                aria-label={tc("edit")}
                                className={`inline-flex items-center rounded-base border border-border p-1.5 transition-colors ${
                                  editing
                                    ? "text-gold"
                                    : "text-muted hover:text-foreground"
                                }`}
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
                          </td>
                        </tr>
                        {editing && (
                          <tr>
                            <td colSpan={4} className="pb-4">
                              <div className="flex flex-wrap items-end gap-3 rounded-base border border-border bg-raised p-4">
                                <label className="flex min-w-[240px] flex-1 flex-col gap-1">
                                  <span className="text-[11px] text-muted">
                                    {t("eventFieldTitle")}
                                  </span>
                                  <input
                                    value={editTitle}
                                    onChange={(e) =>
                                      setEditTitle(e.target.value)
                                    }
                                    maxLength={120}
                                    className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
                                  />
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] text-muted">
                                    {t("eventFieldStart")}
                                  </span>
                                  <DatePicker
                                    value={editStart}
                                    onChange={(v) => {
                                      setEditStart(v);
                                      if (editEnd && v && editEnd < v)
                                        setEditEnd(v);
                                    }}
                                  />
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] text-muted">
                                    {t("eventFieldEnd")}
                                  </span>
                                  <DatePicker
                                    value={editEnd}
                                    min={editStart || undefined}
                                    onChange={setEditEnd}
                                  />
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] text-muted">
                                    {t("eventFieldStartTime")}
                                  </span>
                                  <input
                                    type="time"
                                    value={editStartTime}
                                    onChange={(e) =>
                                      setEditStartTime(
                                        e.target.value || "00:00",
                                      )
                                    }
                                    className="rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
                                  />
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] text-muted">
                                    {t("eventFieldEndTime")}
                                  </span>
                                  <input
                                    type="time"
                                    value={editEndTime}
                                    onChange={(e) =>
                                      setEditEndTime(e.target.value || "00:00")
                                    }
                                    className="rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
                                  />
                                </label>
                                <label className="flex min-w-[240px] flex-1 flex-col gap-1">
                                  <span className="text-[11px] text-muted">
                                    {t("eventFieldDetail")}
                                  </span>
                                  <input
                                    value={editDetail}
                                    onChange={(e) =>
                                      setEditDetail(e.target.value)
                                    }
                                    maxLength={1000}
                                    className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
                                  />
                                </label>
                                <label className="flex min-w-[240px] flex-1 flex-col gap-1">
                                  <span className="text-[11px] text-muted">
                                    {t("eventFieldLink")}
                                  </span>
                                  <input
                                    type="url"
                                    inputMode="url"
                                    value={editLink}
                                    onChange={(e) =>
                                      setEditLink(e.target.value)
                                    }
                                    maxLength={500}
                                    className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
                                  />
                                </label>
                                <div className="ml-auto flex items-center gap-2">
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="rounded-base border border-border px-3 py-2 text-xs text-muted transition-colors hover:text-foreground"
                                  >
                                    {tc("cancel")}
                                  </button>
                                  <button
                                    onClick={() => updateMut.mutate(e.id)}
                                    disabled={updateMut.isPending || !editValid}
                                    className="inline-flex items-center gap-1.5 rounded-base bg-gold px-4 py-2 text-xs font-semibold text-[#1b1407] shadow-button transition-opacity hover:opacity-90 disabled:opacity-40"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    {updateMut.isPending
                                      ? tc("saving")
                                      : tc("save")}
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && (
              <div className="mt-4">
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  onChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t("eventDeleteTitle")}
        description={t("eventDeleteConfirm", {
          title: pendingDelete?.title ?? "",
        })}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        danger
        loading={deleteMut.isPending}
        onConfirm={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
      />
    </div>
  );
}
