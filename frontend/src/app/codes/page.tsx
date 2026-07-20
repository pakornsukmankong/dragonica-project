"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Check,
  Copy,
  Loader2,
  LogIn,
  Pencil,
  Plus,
  Search,
  Ticket,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/toast";
import { useHasSession } from "@/hooks/use-session";
import { useLoginPrompt } from "@/components/login-prompt";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DatePicker } from "@/components/date-picker";
import { statusOf, type CodeStatus } from "@/lib/item-code-status";
import { useDateFormatter } from "@/lib/i18n";

type ItemCode = {
  id: string;
  code: string;
  description: string | null;
  start_date: string | null;
  expire_date: string | null;
  created_at: string;
  created_by: string | null;
};

// Mirrors the `.limit(500)` in ItemCodeService.list().
const LIST_LIMIT = 500;

type SortedCode = ItemCode & { status: CodeStatus };

const STATUS_ORDER: Record<CodeStatus, number> = {
  active: 0,
  scheduled: 1,
  expired: 2,
};

// Green = usable now, amber = not live yet, red = done.
const STATUS_BADGE: Record<CodeStatus, string> = {
  active:
    "border-[var(--border-success)] bg-[var(--success-soft)] text-[var(--fg-success)]",
  scheduled:
    "border-[var(--border-warning)] bg-[var(--warning-soft)] text-[var(--fg-warning)]",
  expired:
    "border-[var(--border-danger)] bg-[var(--danger-soft)] text-[var(--fg-danger)]",
};

// Usable codes first, then ones that have not started, then dead ones. Within
// Active soonest expiry first with no-expiry codes at the end of the group;
// within Scheduled soonest start first; within Expired most recently expired
// first. Reads the clock itself (rather than in the render body) so status and
// ordering share one now.
function sortCodes(codes: ItemCode[]): SortedCode[] {
  const now = Date.now();
  return [...codes]
    .map((c) => ({ ...c, status: statusOf(c, now) }))
    .sort((a, b) => {
      if (a.status !== b.status) {
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      }

      const aExp = a.expire_date ? new Date(a.expire_date).getTime() : null;
      const bExp = b.expire_date ? new Date(b.expire_date).getTime() : null;

      if (a.status === "scheduled") {
        return (
          new Date(a.start_date ?? 0).getTime() -
          new Date(b.start_date ?? 0).getTime()
        );
      }

      if (a.status === "active") {
        if (aExp === null && bExp === null) {
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
        if (aExp === null) return 1;
        if (bExp === null) return -1;
        return aExp - bExp;
      }
      // Both expired — most recently expired first.
      return (bExp ?? 0) - (aExp ?? 0);
    });
}

// Start/expire are day-level, so the form uses date-only pickers and the time
// is fixed at local midnight. These convert between a `type="date"` value
// (YYYY-MM-DD, local) and the stored ISO timestamp.
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A picked date (YYYY-MM-DD) → ISO at local midnight, or undefined when unset.
function toIsoMidnight(date: string): string | undefined {
  return date ? new Date(`${date}T00:00`).toISOString() : undefined;
}

export default function CodesPage() {
  const t = useTranslations("codes");
  const tc = useTranslations("common");
  const formatDate = useDateFormatter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hasSession, userId } = useHasSession();
  const promptLogin = useLoginPrompt();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [expireDate, setExpireDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ItemCode | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CodeStatus>("all");

  const { data: codes, isLoading } = useQuery<ItemCode[]>({
    queryKey: ["item-codes"],
    queryFn: () => api.get("/item-codes"),
  });

  // Re-derive on each render so the badges/ordering track the passing of time
  // for anyone leaving the page open. Date.now() is cheap.
  const sorted = useMemo(() => (codes ? sortCodes(codes) : []), [codes]);

  // Filter (by code/description text and by status) after sorting, so the
  // active-first ordering is preserved within the results. Filtering runs on
  // the live `search` value rather than a deferred one — the list is capped at
  // 500 rows so there is nothing to defer, and a low-priority render leaves
  // AnimatePresence's exit animations hanging (rows stay on screen, dimmed).
  const visible = useMemo(() => {
    let list = sorted;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          (c.description?.toLowerCase().includes(q) ?? false),
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((c) => c.status === statusFilter);
    }
    return list;
  }, [sorted, search, statusFilter]);

  const resetForm = () => {
    setCode("");
    setDescription("");
    setStartDate("");
    setExpireDate("");
    setFormError(null);
    setEditingId(null);
    setFormOpen(false);
  };

  const payload = () => ({
    code: code.trim(),
    description: description.trim() || undefined,
    startDate: toIsoMidnight(startDate),
    expireDate: toIsoMidnight(expireDate),
  });

  const createMut = useMutation({
    mutationFn: () => api.post("/item-codes", payload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-codes"] });
      resetForm();
      toast({ title: t("added"), variant: "success" });
    },
    onError: (e) => setFormError((e as Error).message),
  });

  const updateMut = useMutation({
    mutationFn: (id: string) => api.patch(`/item-codes/${id}`, payload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-codes"] });
      resetForm();
      toast({ title: t("updated"), variant: "success" });
    },
    onError: (e) => setFormError((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/item-codes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-codes"] });
      setPendingDelete(null);
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

  const openAdd = () => {
    if (!hasSession) {
      promptLogin("/codes");
      return;
    }
    if (formOpen && !editingId) {
      resetForm();
      return;
    }
    setEditingId(null);
    setCode("");
    setDescription("");
    setStartDate("");
    setExpireDate("");
    setFormError(null);
    setFormOpen(true);
  };

  const startEdit = (c: ItemCode) => {
    setEditingId(c.id);
    setCode(c.code);
    setDescription(c.description ?? "");
    setStartDate(toDateInput(c.start_date));
    setExpireDate(toDateInput(c.expire_date));
    setFormError(null);
    setFormOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setFormError(t("errors.required"));
      return;
    }
    // Case-insensitive duplicate guard, mirroring the backend so the user gets
    // instant feedback (the DB unique index is the real backstop). The row
    // being edited is excluded from the comparison.
    const exists = (codes ?? []).some(
      (c) =>
        c.id !== editingId && c.code.toUpperCase() === trimmed.toUpperCase(),
    );
    if (exists) {
      setFormError(t("errors.duplicate"));
      return;
    }
    if (
      startDate &&
      expireDate &&
      new Date(startDate).getTime() > new Date(expireDate).getTime()
    ) {
      setFormError(t("errors.dateOrder"));
      return;
    }
    if (editingId) updateMut.mutate(editingId);
    else createMut.mutate();
  };

  const copy = async (c: ItemCode) => {
    try {
      await navigator.clipboard.writeText(c.code);
      setCopiedId(c.id);
      setTimeout(() => setCopiedId((id) => (id === c.id ? null : id)), 1500);
      toast({ title: t("copied"), variant: "success" });
    } catch {
      toast({ title: t("copyFailed"), variant: "error" });
    }
  };

  return (
    <main className="mx-auto max-w-container px-4 py-8 sm:px-7">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-medium text-foreground laptop:text-2xl">
          {t("title")}
        </h1>
        <button
          onClick={openAdd}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-base bg-gold px-4 py-2 text-sm font-semibold text-[#1b1407] shadow-button transition-opacity hover:opacity-90"
        >
          {formOpen && !editingId ? (
            <X className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {t("add")}
        </button>
      </header>

      {/* Add / edit form */}
      <AnimatePresence initial={false}>
        {formOpen && hasSession && (
          <m.form
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onSubmit={submit}
            className="mb-6 overflow-hidden"
          >
            <div className="rounded-base border border-border bg-raised p-4">
              <p className="mb-3 text-sm font-medium text-foreground">
                {editingId ? t("editTitle") : t("addTitle")}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium text-muted">
                    {t("fields.code")} <span className="text-gold">*</span>
                  </span>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder={t("fields.codePlaceholder")}
                    autoFocus
                    maxLength={100}
                    className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm uppercase text-foreground outline-none placeholder:normal-case placeholder:text-muted focus:border-[var(--focus)]"
                  />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium text-muted">
                    {t("fields.description")}
                  </span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("fields.descriptionPlaceholder")}
                    maxLength={300}
                    rows={2}
                    className="w-full resize-none rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-[var(--focus)]"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted">
                    {t("fields.startDate")}
                  </span>
                  <DatePicker
                    value={startDate}
                    onChange={(v) => {
                      setStartDate(v);
                      // Keep expire on/after the new start (clear it if it now
                      // falls before) so the pair can never go out of order.
                      if (expireDate && v && expireDate < v) setExpireDate("");
                    }}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted">
                    {t("fields.expireDate")}
                  </span>
                  <DatePicker
                    value={expireDate}
                    min={startDate || undefined}
                    onChange={setExpireDate}
                  />
                </label>
              </div>

              {formError && (
                <p className="mt-3 text-xs text-[var(--fg-danger)]">
                  {formError}
                </p>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
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
                  {editingId ? t("saveChanges") : t("submit")}
                </button>
              </div>
            </div>
          </m.form>
        )}
      </AnimatePresence>

      {/* Filters — only once there is something to filter */}
      {!isLoading && sorted.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-base border border-border bg-surface py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-[var(--focus)]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "active", "scheduled", "expired"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-base border px-3 py-1.5 text-sm transition-colors ${
                  statusFilter === s
                    ? "border-gold/60 bg-gold-soft font-medium text-gold"
                    : "border-border text-muted hover:border-gold/40 hover:text-foreground"
                }`}
              >
                {t(`filter.${s}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* The API returns at most LIST_LIMIT codes and all filtering happens
          here, so once the list is that long, older codes are silently absent
          from search results. Say so rather than quietly showing a subset. */}
      {codes && codes.length >= LIST_LIMIT && (
        <p className="mb-3 text-xs text-muted">
          {t("capNotice", { count: LIST_LIMIT })}
        </p>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-base border border-border bg-raised py-16 text-center">
          <Ticket className="mx-auto mb-3 h-8 w-8 text-dark-gray" />
          <p className="text-sm text-muted">{t("empty")}</p>
          {!hasSession && (
            <button
              onClick={() => promptLogin("/codes")}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:text-gold-strong"
            >
              <LogIn className="h-3.5 w-3.5" />
              {t("loginToAdd")}
            </button>
          )}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-base border border-border bg-raised py-16 text-center text-sm text-muted">
          {t("noResults")}
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {visible.map((c) => {
              const copied = copiedId === c.id;
              const mine = !!userId && c.created_by === userId;
              return (
                <m.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="rounded-base border border-border bg-raised px-4 py-3 transition-colors hover:border-gold/40"
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span
                        data-status={c.status}
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_BADGE[c.status]}`}
                      >
                        {t(`status.${c.status}`)}
                      </span>
                      <code className="min-w-0 truncate font-mono text-sm font-semibold text-foreground">
                        {c.code}
                      </code>
                    </div>

                    <div className="flex items-center gap-x-4 gap-y-0.5 text-xs text-muted">
                      <span className="whitespace-nowrap">
                        <span className="text-dark-gray">
                          {t("fields.startDate")}:{" "}
                        </span>
                        {c.start_date
                          ? formatDate(c.start_date, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : t("immediate")}
                      </span>
                      <span className="whitespace-nowrap">
                        <span className="text-dark-gray">
                          {t("fields.expireDate")}:{" "}
                        </span>
                        {c.expire_date
                          ? formatDate(c.expire_date, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : t("noExpiry")}
                      </span>
                    </div>

                    <div className="ml-auto flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => copy(c)}
                        title={t("copy")}
                        aria-label={t("copy")}
                        className={`inline-flex items-center gap-1.5 rounded-base border px-3 py-1.5 text-xs font-medium transition-colors ${
                          copied
                            ? "border-[var(--border-success)] text-[var(--fg-success)]"
                            : "border-border text-muted hover:border-gold/40 hover:text-foreground"
                        }`}
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        {copied ? t("copied") : t("copy")}
                      </button>
                      {mine && (
                        <>
                          <button
                            onClick={() => startEdit(c)}
                            title={tc("edit")}
                            aria-label={tc("edit")}
                            className="inline-flex items-center rounded-base border border-border p-1.5 text-muted transition-colors hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setPendingDelete(c)}
                            title={tc("delete")}
                            aria-label={tc("delete")}
                            className="inline-flex items-center rounded-base border border-[var(--border-danger)] p-1.5 text-[var(--fg-danger)] transition-colors hover:bg-[var(--danger-soft)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {c.description && (
                    <p className="mt-2 whitespace-pre-wrap break-words border-t border-border/60 pt-2 text-xs text-muted">
                      {c.description}
                    </p>
                  )}
                </m.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t("deleteTitle")}
        description={t("deleteConfirm", { code: pendingDelete?.code ?? "" })}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        danger
        loading={deleteMut.isPending}
        onConfirm={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
      />
    </main>
  );
}
