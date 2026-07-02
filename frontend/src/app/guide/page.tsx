'use client';

import { useTranslations } from 'next-intl';
import {
  BookOpen,
  LogIn,
  Users,
  Swords,
  ScrollText,
  LayoutDashboard,
  Heart,
  LifeBuoy,
  Settings,
} from 'lucide-react';

const SECTIONS = [
  { key: 'gettingStarted', icon: LogIn },
  { key: 'characters', icon: Users },
  { key: 'grind', icon: Swords },
  { key: 'sessions', icon: ScrollText },
  { key: 'dashboard', icon: LayoutDashboard },
  { key: 'support', icon: Heart },
  { key: 'tickets', icon: LifeBuoy },
  { key: 'settings', icon: Settings },
] as const;

export default function GuidePage() {
  const t = useTranslations('guide');

  return (
    <main className="min-h-screen bg-root">
      <section className="relative overflow-hidden py-[60px] laptop:py-[90px]">
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: 'url(/texture.png)',
            backgroundRepeat: 'repeat',
            opacity: 0.05,
            mixBlendMode: 'multiply',
          }}
        />
        <div className="relative z-10 mx-auto max-w-[820px] px-4 sm:px-7">
          {/* Header */}
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-base bg-gold-soft text-gold shadow-gold">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl laptop:text-2xl font-medium text-foreground">
                {t('title')}
              </h1>
              <p className="text-sm text-muted mt-1">{t('subtitle')}</p>
            </div>
          </div>

          {/* Table of contents */}
          <nav className="mb-10 flex flex-wrap gap-2">
            {SECTIONS.map(({ key }, i) => (
              <a
                key={key}
                href={`#${key}`}
                className="rounded-base bg-raised px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-gold"
              >
                {i + 1}. {t(`sections.${key}.title`)}
              </a>
            ))}
          </nav>

          {/* Sections */}
          <div className="flex flex-col gap-6">
            {SECTIONS.map(({ key, icon: Icon }, i) => {
              const steps = t.raw(`sections.${key}.steps`) as string[];
              return (
                <div
                  key={key}
                  id={key}
                  className="scroll-mt-24 bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base bg-gold-soft text-xs font-bold text-gold">
                      {i + 1}
                    </span>
                    <Icon className="h-4 w-4 shrink-0 text-gold" />
                    <h2 className="text-base font-semibold text-foreground">
                      {t(`sections.${key}.title`)}
                    </h2>
                  </div>
                  <ol className="flex flex-col gap-3">
                    {steps.map((step, si) => (
                      <li key={si} className="flex gap-3 text-sm text-muted">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-medium text-foreground tabular-nums">
                          {si + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>

          <p className="mt-10 text-center text-xs text-muted">{t('footer')}</p>
        </div>
      </section>
    </main>
  );
}
