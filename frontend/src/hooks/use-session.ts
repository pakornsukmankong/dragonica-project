'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Whether a Supabase session exists locally (cookie/storage — no network
 * round trip). Use to gate queries that would just 401 for guests. `userId` is
 * the signed-in user's id, for showing owner-only controls (the backend still
 * enforces ownership on every mutation).
 */
export function useHasSession(): {
  hasSession: boolean;
  userId: string | null;
  isLoading: boolean;
} {
  const [hasSession, setHasSession] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setUserId(session?.user.id ?? null);
      setIsLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      setUserId(session?.user.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { hasSession, userId, isLoading };
}
