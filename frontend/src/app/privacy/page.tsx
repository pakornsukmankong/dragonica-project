import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';

// Order the policy reads in. Each key maps to a `privacy.sections.<key>`
// entry in the message files ({ title, body: string[] }).
const SECTIONS = [
  'intro',
  'dataCollected',
  'cookies',
  'advertising',
  'payments',
  'sharing',
  'retention',
  'rights',
  'children',
  'changes',
  'contact',
] as const;

// Opt-out destinations named in the advertising section. Kept in code rather
// than in the message files so both locales point at the same URLs.
const OPT_OUT_LINKS = [
  { key: 'googleAds', href: 'https://myadcenter.google.com/' },
  { key: 'aboutAds', href: 'https://optout.aboutads.info/' },
  { key: 'gaOptOut', href: 'https://tools.google.com/dlpage/gaoptout' },
];

export default function PrivacyPage() {
  const t = useTranslations('privacy');

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
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl laptop:text-2xl font-medium text-foreground">
                {t('title')}
              </h1>
              <p className="text-sm text-muted mt-1">
                {t('lastUpdated', { date: t('lastUpdatedDate') })}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {SECTIONS.map((key) => {
              const body = t.raw(`sections.${key}.body`) as string[];
              return (
                <section
                  key={key}
                  className="rounded-base bg-surface p-5 outline outline-1 outline-[rgba(255,255,255,0.08)]"
                >
                  <h2 className="mb-3 text-base font-semibold text-foreground">
                    {t(`sections.${key}.title`)}
                  </h2>
                  <div className="flex flex-col gap-3">
                    {body.map((paragraph, i) => (
                      <p
                        key={i}
                        className="text-sm leading-relaxed text-muted"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  {/* The opt-out controls belong with the ad disclosure — a
                      policy that only names the tracking is half a policy. */}
                  {key === 'advertising' && (
                    <ul className="mt-4 flex flex-col gap-2">
                      {OPT_OUT_LINKS.map((link) => (
                        <li key={link.key}>
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-gold underline underline-offset-2 transition-opacity hover:opacity-80"
                          >
                            {t(`optOut.${link.key}`)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
