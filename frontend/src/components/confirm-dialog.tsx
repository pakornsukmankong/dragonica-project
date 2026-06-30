'use client';

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import type { ReactNode } from 'react';

/**
 * Accessible confirmation modal built on @radix-ui/react-alert-dialog
 * (focus trap, Escape, scroll lock, a11y roles). Controlled via `open`.
 * The confirm action does not auto-close — the parent closes it (e.g. on
 * mutation success) so async work can keep the dialog open while pending.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  danger = false,
  loading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-[2px]" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[100] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-base border border-border bg-surface p-6 shadow-sm outline-none">
          <AlertDialog.Title className="text-base font-semibold text-foreground">
            {title}
          </AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="mt-2 text-sm text-muted">
              {description}
            </AlertDialog.Description>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Cancel className="rounded-base border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-raised focus:outline-none">
              {cancelLabel}
            </AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
              disabled={loading}
              className={`rounded-base px-4 py-2 text-sm font-medium shadow-button transition-colors hover:opacity-90 focus:outline-none disabled:opacity-50 ${
                danger
                  ? 'bg-[var(--danger)] text-white'
                  : 'bg-[var(--blue)] text-[#1b1407]'
              }`}
            >
              {loading ? 'Working…' : confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
