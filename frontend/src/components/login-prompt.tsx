'use client';

import { createContext, useContext } from 'react';

/**
 * Opens the sign-in modal the AppShell owns, landing the guest on `next` once
 * they are in. Lets any control that needs an account — a members-only nav
 * item, liking a build, joining its discussion — ask for one without
 * navigating the reader off the page they are already reading.
 */
const LoginPromptContext = createContext<((next: string) => void) | null>(null);

export const LoginPromptProvider = LoginPromptContext.Provider;

export function useLoginPrompt() {
  const promptLogin = useContext(LoginPromptContext);
  if (!promptLogin) {
    // Only the bare routes ('/', '/login') render outside the shell, and
    // neither has anything to gate — so this is a wiring mistake, not a state
    // a reader can reach.
    throw new Error('useLoginPrompt must be used inside the AppShell');
  }
  return promptLogin;
}
