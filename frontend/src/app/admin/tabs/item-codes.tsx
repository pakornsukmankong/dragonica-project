"use client";

import { Fragment, useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Pagination } from "@/components/pagination";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DatePicker } from "@/components/date-picker";
import { statusOf, type CodeStatus } from "@/lib/item-code-status";
import { useToast } from "@/components/toast";
import { useDateFormatter } from "@/lib/i18n";
import { ITEMS_PER_PAGE } from "./shared";

type AdminItemCode = {
  id: string;
  code: string;
  description: string | null;
  start_date: string | null;
  expire_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  profiles: { username: string | null } | null;
};

type AdminItemCodeList = {
  codes: AdminItemCode[];
  total: number;
  page: number;
  pageSize: number;
};

// Same three states as the public page (see @/lib/item-code-status).
const STATUS_BADGE: Record<CodeStatus, string> = {
  active:
    "border-[var(--border-success)] bg-[var(--success-soft)] text-[var(--fg-success)]",
  scheduled:
    "border-[var(--border-warning)] bg-[var(--warning-soft)] text-[var(--fg-warning)]",
  expired:
    "border-[var(--border-danger)] bg-[var(--danger-soft)] text-[var(--fg-danger)]",
};

const STATUS_LABEL: Record<CodeStatus, string> = {
  active: "codeActive",
  scheduled: "codeScheduled",
  expired: "codeExpired",
};

// Start/expire are day-level: date-only pickers, time fixed at local midnight.
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toIsoMidnight(date: string): string | undefined {
  return date ? new Date(`${date}T00:00`).toISOString() : undefined;
}

export function ItemCodesTab() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const formatDate = useDateFormatter();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // committed search (Enter/submit)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editExpire, setEditExpire] = useState("");
  const [pendingDelete, setPendingDelete] = useState<AdminItemCode | null>(
    null,
  );

  const { data, isLoading } = useQuery<AdminItemCodeList>({
    queryKey: ["admin", "item-codes", query, page],
    queryFn: () => {
      const p = new URLSearchParams();
      if (query) p.set("search", query);
      p.set("page", String(page));
      return api.get(`/admin/item-codes?${p.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "item-codes"] });
    // the public /codes list reads the same rows
    queryClient.invalidateQueries({ queryKey: ["item-codes"] });
  };

  const updateMut = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/admin/item-codes/${id}`, {
        code: editCode.trim(),
        description: editDesc.trim() || undefined,
        startDate: toIsoMidnight(editStart),
        expireDate: toIsoMidnight(editExpire),
      }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      toast({ title: t("codeUpdated"), variant: "success" });
    },
    onError: (e) =>
      toast({
        title: t("codeUpdateError"),
        description: (e as Error).message,
        variant: "error",
      }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/item-codes/${id}`),
    onSuccess: () => {
      setPendingDelete(null);
      invalidate();
      toast({ title: t("codeDeleted"), variant: "success" });
    },
    onError: (e) =>
      toast({
        title: t("codeDeleteError"),
        description: (e as Error).message,
        variant: "error",
      }),
  });

  const paged = data?.codes ?? [];
  const pageCount = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / (data?.pageSize ?? ITEMS_PER_PAGE)),
  );

  const startEdit = (c: AdminItemCode) => {
    setEditingId(c.id);
    setEditCode(c.code);
    setEditDesc(c.description ?? "");
    setEditStart(toDateInput(c.start_date));
    setEditExpire(toDateInput(c.expire_date));
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-5">
        <p className="text-[11px] uppercase tracking-wider text-muted mb-2">
          {t("codesTotal")}
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
            placeholder={t("codeSearchPlaceholder")}
            className="mb-4 w-full max-w-sm rounded-base border border-border bg-raised px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
          />
        </form>
        {isLoading ? (
          <p className="text-xs text-muted">{tc("loading")}</p>
        ) : paged.length === 0 ? (
          <p className="text-xs text-muted">{t("codesNone")}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t("colCode")}
                    </th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t("colStatus")}
                    </th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t("colAuthor")}
                    </th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t("colStart")}
                    </th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t("colExpire")}
                    </th>
                    <th className="pb-3 text-right text-xs font-medium text-muted"></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((c) => {
                    const editing = editingId === c.id;
                    const status = statusOf(c);
                    return (
                      <Fragment key={c.id}>
                        <tr className="border-b border-[rgba(255,255,255,0.05)] align-top">
                          <td className="py-3 pr-3">
                            <code className="font-mono text-sm font-semibold text-foreground">
                              {c.code}
                            </code>
                            {c.description && (
                              <p className="mt-0.5 max-w-[240px] truncate text-xs text-muted">
                                {c.description}
                              </p>
                            )}
                          </td>
                          <td className="py-3 pr-3">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_BADGE[status]}`}
                            >
                              {t(STATUS_LABEL[status])}
                            </span>
                          </td>
                          <td className="py-3 pr-3 text-sm text-foreground">
                            {c.profiles?.username || "—"}
                          </td>
                          <td className="py-3 pr-3 text-xs text-muted">
                            {c.start_date
                              ? formatDate(c.start_date, {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </td>
                          <td className="py-3 pr-3 text-xs text-muted">
                            {c.expire_date
                              ? formatDate(c.expire_date, {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </td>
                          <td className="py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() =>
                                  editing ? setEditingId(null) : startEdit(c)
                                }
                                title={tc("edit")}
                                className={`inline-flex items-center rounded-base border border-border p-1.5 transition-colors ${
                                  editing
                                    ? "text-gold"
                                    : "text-muted hover:text-foreground"
                                }`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setPendingDelete(c)}
                                title={tc("delete")}
                                className="inline-flex items-center rounded-base border border-[var(--border-danger)] p-1.5 text-[var(--fg-danger)] transition-colors hover:bg-[var(--danger-soft)]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {editing && (
                          <tr>
                            <td colSpan={6} className="pb-4">
                              <div className="flex flex-wrap items-end gap-3 rounded-base border border-border bg-raised p-4">
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] text-muted">
                                    {t("colCode")}
                                  </span>
                                  <input
                                    value={editCode}
                                    onChange={(e) =>
                                      setEditCode(e.target.value)
                                    }
                                    maxLength={100}
                                    className="w-56 rounded-base border border-border bg-surface px-3 py-2 text-sm uppercase text-foreground outline-none focus:border-gold/50"
                                  />
                                </label>
                                <label className="flex min-w-[240px] flex-1 flex-col gap-1">
                                  <span className="text-[11px] text-muted">
                                    {t("colDescription")}
                                  </span>
                                  <input
                                    value={editDesc}
                                    onChange={(e) =>
                                      setEditDesc(e.target.value)
                                    }
                                    maxLength={300}
                                    className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
                                  />
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] text-muted">
                                    {t("colStart")}
                                  </span>
                                  <DatePicker
                                    value={editStart}
                                    onChange={(v) => {
                                      setEditStart(v);
                                      if (editExpire && v && editExpire < v)
                                        setEditExpire("");
                                    }}
                                  />
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] text-muted">
                                    {t("colExpire")}
                                  </span>
                                  <DatePicker
                                    value={editExpire}
                                    min={editStart || undefined}
                                    onChange={setEditExpire}
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
                                    onClick={() => updateMut.mutate(c.id)}
                                    disabled={
                                      updateMut.isPending || !editCode.trim()
                                    }
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
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t("deleteCodeTitle")}
        description={t("deleteCodeDesc", { code: pendingDelete?.code ?? "" })}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        danger
        loading={deleteMut.isPending}
        onConfirm={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
      />
    </div>
  );
}
