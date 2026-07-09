'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Whether a Supabase session exists locally (cookie/storage — no network
 * round trip). Use to gate queries that would just 401 for guests.
 */
export function useHasSession(): { hasSession: boolean; isLoading: boolean } {
  const [hasSession, setHasSession] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setIsLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { hasSession, isLoading };
}
