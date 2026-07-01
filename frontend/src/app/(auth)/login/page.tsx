'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Swords } from 'lucide-react';

export default function LoginPage() {
  const t = useTranslations('login');
  const tn = useTranslations('nav');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

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

      router.push('/dashboard');
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

    router.push('/dashboard');
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setIsGoogleLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-root flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        {/* Brand */}
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-base bg-gold-soft text-gold shadow-gold">
            <Swords className="h-6 w-6" />
          </span>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {tn('brand')} <span className="text-gold">{tn('brandSubtitle')}</span>
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gold-dim">
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

            {error && (
              <div className="rounded-base bg-[var(--danger-soft)] border border-[var(--border-danger)] px-3 py-2 text-xs text-[var(--fg-danger)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-base px-4 py-2.5 text-sm font-medium text-[#1b1407] bg-[var(--blue)] shadow-button transition-colors duration-150 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading
                ? mode === 'signin'
                  ? t('signingIn')
                  : t('creatingAccount')
                : mode === 'signin'
                  ? t('signIn')
                  : t('createAccount')}
            </button>
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
