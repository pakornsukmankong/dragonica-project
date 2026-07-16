'use client';

import { Suspense } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoginForm } from '@/components/login-form';

function LoginInner() {
  const t = useTranslations('login');
  const tn = useTranslations('nav');
  const searchParams = useSearchParams();

  // Where to land after login (?next=/skills/build/xyz). Internal paths only —
  // anything else would be an open redirect.
  const rawNext = searchParams.get('next');
  const next =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : '/dashboard';

  return (
    <main className="min-h-screen bg-root flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        {/* Brand */}
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/logo.png"
            alt={`${tn('brand')} ${tn('brandSubtitle')}`}
            width={866}
            height={288}
            priority
            className="mb-3 h-auto w-full max-w-[260px]"
          />
          <p className="text-xs uppercase tracking-[0.2em] text-gold-dim">
            {t('brandSubtitle')}
          </p>
        </div>

        <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-8 laptop:p-10">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}

// useSearchParams needs a Suspense boundary during prerender.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
