'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LoginForm } from '@/components/login-form';

/**
 * Sign-in dialog raised when a guest picks a members-only nav item, so they can
 * authenticate without losing the page they were on. `next` is the destination
 * they asked for; the form takes them there once signed in.
 */
export function LoginModal({
  open,
  onOpenChange,
  next,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  next: string;
}) {
  const t = useTranslations('login');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  return (
    // Closing unmounts the form, which resets it to sign-in; drop our mirrored
    // copy of the mode with it so the title can't drift on reopen.
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setMode('signin');
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[100] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-base border border-border bg-surface p-6 shadow-sm outline-none sm:p-8">
          {/* The form renders the visible heading; this is the accessible name
              Radix requires, kept on the same mode so it can't contradict it. */}
          <Dialog.Title className="sr-only">
            {mode === 'signin' ? t('signIn') : t('createAccount')}
          </Dialog.Title>
          {/* Radix autofocuses this on open because it is the first tabbable
              child, so the ring must be focus-visible — plain focus: would draw
              it on every mouse-opened dialog, where it reads as stuck hover. */}
          <Dialog.Close
            aria-label={t('close')}
            className="absolute right-3 top-3 rounded-base p-1.5 text-muted outline-none transition-colors hover:bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>
          <LoginForm
            next={next}
            onSignedIn={() => onOpenChange(false)}
            onModeChange={setMode}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
