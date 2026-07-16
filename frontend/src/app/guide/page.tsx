'use client';

import { useTranslations } from 'next-intl';
import * as Accordion from '@radix-ui/react-accordion';
import {
  BookOpen,
  LogIn,
  Users,
  Swords,
  ScrollText,
  LayoutDashboard,
  Sparkles,
  Layers,
  Heart,
  LifeBuoy,
  Settings,
  ChevronDown,
} from 'lucide-react';

const SECTIONS = [
  { key: 'gettingStarted', icon: LogIn },
  { key: 'characters', icon: Users },
  { key: 'grind', icon: Swords },
  { key: 'sessions', icon: ScrollText },
  { key: 'dashboard', icon: LayoutDashboard },
  { key: 'skills', icon: Sparkles },
  { key: 'skillCards', icon: Layers },
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

          {/* Collapsible sections */}
          <Accordion.Root
            type="multiple"
            defaultValue={['gettingStarted']}
            className="flex flex-col gap-3"
          >
            {SECTIONS.map(({ key, icon: Icon }, i) => {
              const steps = t.raw(`sections.${key}.steps`) as string[];
              return (
                <Accordion.Item
                  key={key}
                  value={key}
                  className="overflow-hidden rounded-base bg-surface outline outline-1 outline-[rgba(255,255,255,0.08)]"
                >
                  <Accordion.Header>
                    <Accordion.Trigger className="group flex w-full items-center gap-3 p-5 text-left outline-none transition-colors hover:bg-raised">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base bg-gold-soft text-xs font-bold text-gold">
                        {i + 1}
                      </span>
                      <Icon className="h-4 w-4 shrink-0 text-gold" />
                      <h2 className="flex-1 text-base font-semibold text-foreground">
                        {t(`sections.${key}.title`)}
                      </h2>
                      <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="accordion-content overflow-hidden">
                    <ol className="flex flex-col gap-3 px-5 pb-5 pt-1">
                      {steps.map((step, si) => (
                        <li key={si} className="flex gap-3 text-sm text-muted">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-medium text-foreground tabular-nums">
                            {si + 1}
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </Accordion.Content>
                </Accordion.Item>
              );
            })}
          </Accordion.Root>

          <p className="mt-10 text-center text-xs text-muted">{t('footer')}</p>
        </div>
      </section>
    </main>
  );
}
