'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import { m } from 'motion/react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

function LoginInner() {
  const t = useTranslations('login');
  const tn = useTranslations('nav');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isDiscordLoading, setIsDiscordLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Where to land after login (?next=/skills/build/xyz). Internal paths only —
  // anything else would be an open redirect.
  const rawNext = searchParams.get('next');
  const next =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    if (mode === 'signup' && password !== confirmPassword) {
      setError(t('passwordMismatch'));
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    if (mode === 'signup') {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }

      // When email confirmation is enabled, no session is returned yet.
      if (!data.session) {
        setMessage(t('confirmEmail'));
        setMode('signin');
        setIsLoading(false);
        return;
      }

      router.push(next);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setIsLoading(false);
      return;
    }

    router.push(next);
  };

  const handleOAuthLogin = async (
    provider: 'google' | 'discord',
    setLoading: (v: boolean) => void,
  ) => {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => handleOAuthLogin('google', setIsGoogleLoading);
  const handleDiscordLogin = () =>
    handleOAuthLogin('discord', setIsDiscordLoading);

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
          <h2 className="text-base font-semibold text-foreground mb-2">
            {mode === 'signin' ? t('signIn') : t('createAccount')}
          </h2>
          <p className="text-xs text-muted mb-8">
            {mode === 'signin' ? t('signInSubtitle') : t('signUpSubtitle')}
          </p>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
            className="w-full flex items-center justify-center gap-3 rounded-base border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-raised focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {isGoogleLoading ? t('redirecting') : t('continueWithGoogle')}
          </button>

          {/* Discord OAuth */}
          <button
            type="button"
            onClick={handleDiscordLogin}
            disabled={isDiscordLoading}
            className="mt-3 w-full flex items-center justify-center gap-3 rounded-base border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-raised focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#5865F2"
                d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a.074.074 0 0 0-.079.037c-.34.607-.718 1.4-.984 2.023a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.998-2.023.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C1.29 7.92.646 11.383.965 14.803a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-8.605-3.549-12.152a.06.06 0 0 0-.031-.028ZM8.02 12.72c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.332-.955 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.332-.946 2.418-2.157 2.418Z"
              />
            </svg>
            {isDiscordLoading ? t('redirecting') : t('continueWithDiscord')}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted">{t('or')}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {message && (
            <div className="mb-4 rounded-base bg-[var(--success-soft)] border border-[var(--border-success)] px-3 py-2 text-xs text-[var(--fg-success)]">
              {message}
            </div>
          )}

          {/* Email/Password form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-xs font-medium text-foreground"
              >
                {t('email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-base border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20"
                placeholder="you@example.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs font-medium text-foreground"
              >
                {t('password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'signup' ? 6 : undefined}
                className="w-full rounded-base border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20"
                placeholder="••••••••"
              />
              {mode === 'signup' && (
                <span className="text-[11px] text-muted">{t('passwordHint')}</span>
              )}
            </div>

            {mode === 'signup' && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="text-xs font-medium text-foreground"
                >
                  {t('confirmPassword')}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  aria-invalid={
                    confirmPassword.length > 0 && confirmPassword !== password
                  }
                  className="w-full rounded-base border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20 aria-[invalid=true]:border-[var(--border-danger)]"
                  placeholder="••••••••"
                />
                {confirmPassword.length > 0 && confirmPassword !== password && (
                  <span className="text-[11px] text-[var(--fg-danger)]">
                    {t('passwordMismatch')}
                  </span>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-base bg-[var(--danger-soft)] border border-[var(--border-danger)] px-3 py-2 text-xs text-[var(--fg-danger)]">
                {error}
              </div>
            )}

            <m.button
              type="submit"
              whileTap={{ scale: 0.97 }}
              disabled={
                isLoading ||
                (mode === 'signup' &&
                  (!confirmPassword || confirmPassword !== password))
              }
              className="w-full rounded-base px-4 py-2.5 text-sm font-medium text-[#1b1407] bg-[var(--blue)] shadow-button transition-colors duration-150 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading
                ? mode === 'signin'
                  ? t('signingIn')
                  : t('creatingAccount')
                : mode === 'signin'
                  ? t('signIn')
                  : t('createAccount')}
            </m.button>
          </form>

          {/* Mode toggle */}
          <p className="mt-6 text-center text-xs text-muted">
            {mode === 'signin' ? t('noAccount') : t('haveAccount')}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
                setMessage(null);
                setConfirmPassword('');
              }}
              className="font-semibold text-gold hover:underline"
            >
              {mode === 'signin' ? t('signUpLink') : t('signInLink')}
            </button>
          </p>
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
