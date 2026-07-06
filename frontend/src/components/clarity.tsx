'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { createClient } from '@/lib/supabase/client';

// Microsoft Clarity: heatmaps + session recordings. Loaded only when a project
// id is configured, so dev/preview builds don't pollute production analytics.
const PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

// Clarity exposes a global command queue: clarity(command, ...args). It's
// defined synchronously by the inline snippet, so calls made before the remote
// tag finishes loading are queued.
type ClarityFn = (command: string, ...args: unknown[]) => void;
declare global {
  interface Window {
    clarity?: ClarityFn;
  }
}

/**
 * Injects the Clarity tag and ties each recording to the signed-in user so
 * sessions can be searched by account (and admin sessions filtered out).
 * Renders nothing when NEXT_PUBLIC_CLARITY_PROJECT_ID is unset.
 */
export function Clarity() {
  useEffect(() => {
    if (!PROJECT_ID) return;
    const supabase = createClient();
    let cancelled = false;

    const identify = async (userId: string | undefined, email?: string) => {
      if (!userId) return;
      // The tag may still be loading on first paint; retry briefly until the
      // global command queue exists.
      for (let i = 0; i < 20 && !cancelled; i++) {
        if (typeof window.clarity === 'function') {
          window.clarity('identify', userId, undefined, undefined, email);
          const { data } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();
          window.clarity('set', 'userRole', data?.role ?? 'user');
          return;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    };

    supabase.auth.getUser().then(({ data }) => {
      void identify(data.user?.id, data.user?.email);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void identify(session?.user?.id, session?.user?.email);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (!PROJECT_ID) return null;

  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window,document,"clarity","script","${PROJECT_ID}");`}
    </Script>
  );
}
