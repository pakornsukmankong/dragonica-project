import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, LifeBuoy, Mail } from 'lucide-react';

// lucide-react dropped its brand icons, so Discord and YouTube are inlined —
// the same marks the site footer uses.
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M20.317 4.369A19.79 19.79 0 0 0 15.434 3c-.211.375-.457.88-.626 1.28a18.28 18.28 0 0 0-5.615 0A12.6 12.6 0 0 0 8.56 3a19.74 19.74 0 0 0-4.886 1.372C.554 9.02-.32 13.556.113 18.028a19.9 19.9 0 0 0 6.004 3.03c.484-.66.916-1.362 1.288-2.101a12.9 12.9 0 0 1-2.028-.973c.17-.124.336-.254.497-.388a14.2 14.2 0 0 0 12.252 0c.163.135.33.265.497.388-.647.382-1.328.708-2.03.974.372.738.803 1.44 1.287 2.1a19.85 19.85 0 0 0 6.008-3.03c.507-5.184-.867-9.679-3.571-13.66ZM8.02 15.278c-1.183 0-2.157-1.086-2.157-2.42 0-1.332.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.156 2.42 0 1.334-.955 2.42-2.156 2.42Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.42 0-1.332.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.156 2.42 0 1.334-.946 2.42-2.156 2.42Z" />
    </svg>
  );
}

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M23.5 6.507a3.02 3.02 0 0 0-2.122-2.136C19.505 3.867 12 3.867 12 3.867s-7.505 0-9.378.504A3.02 3.02 0 0 0 .5 6.507C0 8.392 0 12.325 0 12.325s0 3.933.5 5.818a3.02 3.02 0 0 0 2.122 2.136c1.873.504 9.378.504 9.378.504s7.505 0 9.378-.504a3.02 3.02 0 0 0 2.122-2.136c.5-1.885.5-5.818.5-5.818s0-3.933-.5-5.818ZM9.545 15.9V8.75l6.273 3.575L9.545 15.9Z" />
    </svg>
  );
}

// Each method maps to a `contact.methods.<key>` entry ({ title, body, cta }).
// `href` is kept in code so both locales point at the same destination;
// `internal` routes stay in-app (a <Link>), the rest open in a new tab.
const METHODS: {
  key: string;
  href: string;
  internal?: boolean;
  Icon: (props: { className?: string }) => ReactNode;
}[] = [
  {
    key: 'discord',
    href: 'https://discord.gg/sYCfyYAcdG',
    Icon: DiscordIcon,
  },
  {
    key: 'youtube',
    href: 'https://www.youtube.com/channel/UC2HoBQZT88jlscMBsWzg8KA',
    Icon: YoutubeIcon,
  },
  { key: 'support', href: '/support', internal: true, Icon: LifeBuoy },
];

export default function ContactPage() {
  const t = useTranslations('contact');

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
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl laptop:text-2xl font-medium text-foreground">
                {t('title')}
              </h1>
              <p className="text-sm text-muted mt-1">{t('lead')}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {METHODS.map(({ key, href, internal, Icon }) => {
              const cta = (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gold transition-opacity hover:opacity-80">
                  {t(`methods.${key}.cta`)}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              );
              return (
                <section
                  key={key}
                  className="rounded-base bg-surface p-5 outline outline-1 outline-[rgba(255,255,255,0.08)]"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-base bg-gold-soft text-gold">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold text-foreground">
                        {t(`methods.${key}.title`)}
                      </h2>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        {t(`methods.${key}.body`)}
                      </p>
                      <div className="mt-3">
                        {internal ? (
                          <Link href={href}>{cta}</Link>
                        ) : (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {cta}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
