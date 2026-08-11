import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Info } from 'lucide-react';

// Order the sections read in. Each key maps to an `about.sections.<key>`
// entry in the message files ({ title, body: string[] }).
const SECTIONS = ['intro', 'features', 'community', 'disclaimer'] as const;

// Community destinations named in the community section. Kept in code rather
// than in the message files so both locales point at the same URLs. These match
// the links in the site footer.
const COMMUNITY_LINKS = [
  { key: 'discord', href: 'https://discord.gg/sYCfyYAcdG' },
  {
    key: 'youtube',
    href: 'https://www.youtube.com/channel/UC2HoBQZT88jlscMBsWzg8KA',
  },
];

export default function AboutPage() {
  const t = useTranslations('about');
  const tc = useTranslations('contact');

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
              <Info className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl laptop:text-2xl font-medium text-foreground">
                {t('title')}
              </h1>
              <p className="text-sm text-muted mt-1">{t('lead')}</p>
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

                  {/* The community section names Discord and YouTube — give the
                      reader the actual links rather than just describing them. */}
                  {key === 'community' && (
                    <ul className="mt-4 flex flex-col gap-2">
                      {COMMUNITY_LINKS.map((link) => (
                        <li key={link.key}>
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-gold underline underline-offset-2 transition-opacity hover:opacity-80"
                          >
                            {tc(`methods.${link.key}.cta`)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>

          {/* A clear path onward — the reviewer-friendly pages a first-time
              visitor is most likely to want next. */}
          <p className="mt-6 text-sm text-muted">
            <Link
              href="/contact"
              className="text-gold underline underline-offset-2 transition-opacity hover:opacity-80"
            >
              {tc('title')}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
