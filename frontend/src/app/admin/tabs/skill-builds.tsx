'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Pagination } from '@/components/pagination';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { useDateFormatter } from '@/lib/i18n';
import {
  Trash2,
  Pencil,
  Check,
  Eye,
  EyeOff,
  Heart,
  MessageSquare,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { Select } from '@/components/select';
import type { AdminSkillBuild, BuildComment } from '@/types';
import { ITEMS_PER_PAGE } from './shared';

export function SkillBuildsTab() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const formatDate = useDateFormatter();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVisibility, setEditVisibility] = useState<'public' | 'unlisted'>(
    'unlisted',
  );
  const [pendingDelete, setPendingDelete] = useState<AdminSkillBuild | null>(
    null,
  );

  const { data: builds, isLoading } = useQuery<AdminSkillBuild[]>({
    queryKey: ['admin', 'skill-builds'],
    queryFn: () => api.get('/admin/skill-builds'),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'skill-builds'] });
    // the public gallery and share pages read the same rows
    queryClient.invalidateQueries({ queryKey: ['skills', 'community'] });
    queryClient.invalidateQueries({ queryKey: ['skills', 'build'] });
  };

  const updateMut = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/admin/skill-builds/${id}`, {
        name: editName.trim() || undefined,
        description: editDescription,
        visibility: editVisibility,
      }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      toast({ title: t('buildUpdated'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('buildUpdateError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/skill-builds/${id}`),
    onSuccess: () => {
      setPendingDelete(null);
      invalidate();
      toast({ title: t('buildDeleted'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('buildDeleteError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const list = (builds ?? []).filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      (b.profiles?.username ?? '').toLowerCase().includes(q)
    );
  });
  const pageCount = Math.max(1, Math.ceil(list.length / ITEMS_PER_PAGE));
  const paged = list.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const startEdit = (b: AdminSkillBuild) => {
    setEditingId(b.id);
    setEditName(b.name);
    setEditDescription(b.description ?? '');
    setEditVisibility(b.visibility);
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted mb-2">
            {t('buildsTotal')}
          </p>
          <p className="text-2xl font-bold text-gold tabular-nums">
            {(builds ?? []).length}
          </p>
        </div>
        <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted mb-2">
            {t('buildsPublic')}
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {(builds ?? []).filter((b) => b.visibility === 'public').length}
          </p>
        </div>
      </div>

      <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6">
        <input
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder={t('buildSearchPlaceholder')}
          className="mb-4 w-full max-w-sm rounded-base border border-border bg-raised px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
        />
        {isLoading ? (
          <p className="text-xs text-muted">{tc('loading')}</p>
        ) : list.length === 0 ? (
          <p className="text-xs text-muted">{t('buildsNone')}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t('colBuild')}
                    </th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t('colAuthor')}
                    </th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t('colVisibility')}
                    </th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t('colStats')}
                    </th>
                    <th className="pb-3 pr-3 text-xs font-medium text-muted">
                      {t('colCreated')}
                    </th>
                    <th className="pb-3 text-right text-xs font-medium text-muted"></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((b) => {
                    const expanded = expandedId === b.id;
                    const editing = editingId === b.id;
                    return (
                      <Fragment key={b.id}>
                        <tr className="border-b border-[rgba(255,255,255,0.05)] align-top">
                          <td className="py-3 pr-3">
                            <p className="max-w-[240px] truncate text-sm font-medium text-foreground">
                              {b.name}
                            </p>
                            <p className="text-xs text-muted">
                              {b.skill_classes?.name ?? `#${b.class_id}`} · Lv{' '}
                              {b.char_level}
                            </p>
                          </td>
                          <td className="py-3 pr-3 text-sm text-foreground">
                            {b.profiles?.username || '—'}
                          </td>
                          <td className="py-3 pr-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-medium ${
                                b.visibility === 'public'
                                  ? 'bg-gold-soft text-gold'
                                  : 'bg-raised text-muted'
                              }`}
                            >
                              {b.visibility === 'public' ? (
                                <Globe className="h-3 w-3" />
                              ) : (
                                <EyeOff className="h-3 w-3" />
                              )}
                              {b.visibility === 'public'
                                ? t('visPublic')
                                : t('visUnlisted')}
                            </span>
                          </td>
                          <td className="py-3 pr-3">
                            <span className="inline-flex items-center gap-3 text-xs text-muted">
                              <span className="inline-flex items-center gap-1">
                                <Heart className="h-3 w-3" />
                                <span className="tabular-nums">
                                  {b.like_count}
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                <span className="tabular-nums">
                                  {b.view_count}
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                <span className="tabular-nums">
                                  {b.comment_count}
                                </span>
                              </span>
                            </span>
                          </td>
                          <td className="py-3 pr-3 text-xs text-muted">
                            {formatDate(b.created_at, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Link
                                href={`/skills/build/${b.share_slug}`}
                                target="_blank"
                                title={t('openBuild')}
                                className="inline-flex items-center rounded-base border border-border p-1.5 text-muted transition-colors hover:text-foreground"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                              <button
                                onClick={() =>
                                  setExpandedId(expanded ? null : b.id)
                                }
                                title={t('viewBuildComments')}
                                className={`inline-flex items-center gap-1 rounded-base border border-border px-2 py-1.5 text-xs transition-colors ${
                                  expanded
                                    ? 'text-gold'
                                    : 'text-muted hover:text-foreground'
                                }`}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                <span className="tabular-nums">
                                  {b.comment_count}
                                </span>
                              </button>
                              <button
                                onClick={() =>
                                  editing ? setEditingId(null) : startEdit(b)
                                }
                                title={tc('edit')}
                                className={`inline-flex items-center rounded-base border border-border p-1.5 transition-colors ${
                                  editing
                                    ? 'text-gold'
                                    : 'text-muted hover:text-foreground'
                                }`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setPendingDelete(b)}
                                title={tc('delete')}
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
                              <div className="space-y-2 rounded-base border border-border bg-raised p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    value={editName}
                                    onChange={(e) =>
                                      setEditName(e.target.value)
                                    }
                                    maxLength={60}
                                    className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50 sm:w-64"
                                  />
                                  <Select
                                    value={editVisibility}
                                    onChange={(v) =>
                                      setEditVisibility(
                                        v as 'public' | 'unlisted',
                                      )
                                    }
                                    options={[
                                      { value: 'public', label: t('visPublic') },
                                      {
                                        value: 'unlisted',
                                        label: t('visUnlisted'),
                                      },
                                    ]}
                                    className="w-52"
                                  />
                                  <div className="ml-auto flex items-center gap-2">
                                    <button
                                      onClick={() => setEditingId(null)}
                                      className="rounded-base border border-border px-3 py-2 text-xs text-muted transition-colors hover:text-foreground"
                                    >
                                      {tc('cancel')}
                                    </button>
                                    <button
                                      onClick={() => updateMut.mutate(b.id)}
                                      disabled={
                                        updateMut.isPending || !editName.trim()
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-base bg-gold px-4 py-2 text-xs font-semibold text-[#1b1407] shadow-button transition-opacity hover:opacity-90 disabled:opacity-40"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                      {updateMut.isPending
                                        ? tc('saving')
                                        : tc('save')}
                                    </button>
                                  </div>
                                </div>
                                <textarea
                                  value={editDescription}
                                  onChange={(e) =>
                                    setEditDescription(e.target.value)
                                  }
                                  maxLength={2000}
                                  rows={2}
                                  className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                        {expanded && (
                          <tr>
                            <td colSpan={6} className="pb-4">
                              <AdminBuildComments buildId={b.id} />
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
        title={t('deleteBuildTitle')}
        description={t('deleteBuildDesc', { name: pendingDelete?.name ?? '' })}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        danger
        loading={deleteMut.isPending}
        onConfirm={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
      />
    </div>
  );
}

// Comment list under an expanded build row, with per-comment delete (the
// shared DELETE /skills/comments/:id lets admins remove anyone's comment).
function AdminBuildComments({ buildId }: { buildId: string }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const formatDate = useDateFormatter();
  const [pendingDelete, setPendingDelete] = useState<BuildComment | null>(null);

  const { data: comments, isLoading } = useQuery<BuildComment[]>({
    queryKey: ['admin', 'skill-builds', buildId, 'comments'],
    queryFn: () => api.get(`/admin/skill-builds/${buildId}/comments`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/skills/comments/${id}`),
    onSuccess: () => {
      setPendingDelete(null);
      queryClient.invalidateQueries({
        queryKey: ['admin', 'skill-builds', buildId, 'comments'],
      });
      // comment_count on the build row changed
      queryClient.invalidateQueries({ queryKey: ['admin', 'skill-builds'] });
      toast({ title: t('buildCommentDeleted'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('buildCommentDeleteError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  return (
    <div className="rounded-base border border-border bg-raised p-4">
      {isLoading ? (
        <p className="text-xs text-muted">{tc('loading')}</p>
      ) : !comments || comments.length === 0 ? (
        <p className="text-xs text-muted">{t('buildCommentsNone')}</p>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div
              key={c.id}
              className="flex items-start justify-between gap-3 rounded-base bg-surface px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-[11px] text-muted">
                  <span className="font-medium text-gold">
                    {c.profiles?.username ?? 'Anonymous'}
                  </span>{' '}
                  ·{' '}
                  {formatDate(c.created_at, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                  {c.body}
                </p>
              </div>
              <button
                onClick={() => setPendingDelete(c)}
                title={tc('delete')}
                className="shrink-0 rounded-base border border-[var(--border-danger)] p-1.5 text-[var(--fg-danger)] transition-colors hover:bg-[var(--danger-soft)]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('deleteBuildCommentTitle')}
        description={t('deleteBuildCommentDesc')}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        danger
        loading={deleteMut.isPending}
        onConfirm={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
      />
    </div>
  );
}
