'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { ToastProvider } from '@/components/toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* reducedMotion="user" honours prefers-reduced-motion app-wide.
          LazyMotion(domAnimation) loads only ~15KB of features (animation +
          gestures + AnimatePresence); `strict` forbids the heavy `motion.*`
          import so we always use the lightweight `m.*` components. */}
      <MotionConfig reducedMotion="user">
        <LazyMotion features={domAnimation} strict>
          <ToastProvider>{children}</ToastProvider>
        </LazyMotion>
      </MotionConfig>
    </QueryClientProvider>
  );
}
