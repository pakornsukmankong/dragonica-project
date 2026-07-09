'use client';

import { useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Loader2, MessageSquare, Send, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useDateFormatter } from '@/lib/i18n';
import type { BuildComment } from '@/types';

/**
 * Comment thread under a shared skill build. Anyone can read; posting needs a
 * login (the parent passes the current user); authors can delete their own,
 * admins can delete anyone's (the backend enforces both).
 */
export function BuildComments({
  slug,
  me,
}: {
  slug: string;
  me?: { id: string; username: string | null; role?: string } | null;
}) {
  const t = useTranslations('skills');
  const formatDate = useDateFormatter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [body, setBody] = useState('');
  const [pendingDelete, setPendingDelete] = useState<BuildComment | null>(null);

  const { data: comments, isLoading } = useQuery<BuildComment[]>({
    queryKey: ['skills', 'build', slug, 'comments'],
    queryFn: () => api.get(`/skills/builds/${slug}/comments`),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ['skills', 'build', slug, 'comments'],
    });
    // comment_count lives on the build row
    queryClient.invalidateQueries({ queryKey: ['skills', 'build', slug] });
  };

  const postMut = useMutation({
    mutationFn: () =>
      api.post(`/skills/builds/${slug}/comments`, { body: body.trim() }),
    onSuccess: () => {
      setBody('');
      invalidate();
      toast({ title: t('commentPosted'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('commentError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/skills/comments/${id}`),
    onSuccess: () => {
      setPendingDelete(null);
      invalidate();
      toast({ title: t('commentDeleted'), variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: t('commentError'),
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  return (
    <section className="mt-10">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
        <MessageSquare className="h-4 w-4" />
        {t('comments')}
        {comments && comments.length > 0 && (
          <span className="text-gold">{comments.length}</span>
        )}
      </h2>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </div>
      ) : !comments || comments.length === 0 ? (
        <p className="rounded-base border border-border bg-raised px-4 py-6 text-center text-sm text-muted">
          {t('noComments')}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* initial={false}: only new/removed comments animate, not page load */}
          <AnimatePresence initial={false}>
          {comments.map((c) => (
            <m.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="rounded-base border border-border bg-raised px-4 py-3"
            >
              <div className="mb-1 flex items-center gap-2 text-[11px] text-muted">
                <span className="font-medium text-gold">
                  {c.profiles?.username ?? 'Anonymous'}
                </span>
                <span>
                  {formatDate(c.created_at, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {(me?.id === c.author_id || me?.role === 'admin') && (
                  <m.button
                    onClick={() => setPendingDelete(c)}
                    title={t('delete')}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.85 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                    className="ml-auto text-muted transition-colors hover:text-[var(--fg-danger)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </m.button>
                )}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                {c.body}
              </p>
            </m.div>
          ))}
          </AnimatePresence>
        </div>
      )}

      {me ? (
        <form
          className="mt-4 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) postMut.mutate();
          }}
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('commentPlaceholder')}
            maxLength={1000}
            rows={2}
            className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
          />
          <m.button
            type="submit"
            disabled={postMut.isPending || !body.trim()}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className="flex items-center gap-1.5 self-end rounded-base bg-gold px-4 py-2 text-sm font-semibold text-[#1b1407] shadow-button transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {postMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {t('postComment')}
          </m.button>
        </form>
      ) : (
        <p className="mt-4 text-xs text-muted">{t('loginToComment')}</p>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('deleteCommentTitle')}
        description={t('deleteCommentConfirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        danger
        loading={deleteMut.isPending}
        onConfirm={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
      />
    </section>
  );
}
