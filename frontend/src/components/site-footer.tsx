import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

// Links grouped the way the site is actually built: a public game database,
// a tracker you log into, and the places to get help. The grouping is the
// structure — it tells a first-time visitor what this site is.
const GROUPS = [
  {
    key: 'database',
    links: [
      // nav.items is "Game Database" — the group heading already says that, so
      // the link gets its own shorter label.
      { href: '/items', key: 'footerItems' },
      { href: '/skills', key: 'skills' },
      { href: '/skill-cards', key: 'skillCards' },
      { href: '/codes', key: 'codes' },
    ],
  },
  {
    key: 'tracker',
    links: [
      { href: '/dashboard', key: 'dashboard' },
      { href: '/grind', key: 'grind' },
      { href: '/sessions', key: 'sessions' },
      { href: '/characters', key: 'characters' },
    ],
  },
  {
    key: 'help',
    links: [
      { href: '/guide', key: 'guide' },
      { href: '/support', key: 'support' },
      { href: '/tickets', key: 'tickets' },
      { href: '/privacy', key: 'privacyLink' },
    ],
  },
] as const;

const DISCORD_URL = 'https://discord.gg/sYCfyYAcdG';
const YOUTUBE_URL = 'https://www.youtube.com/channel/UC2HoBQZT88jlscMBsWzg8KA';

/**
 * Landing-page footer. Only `/` renders it — the in-app routes end on their own
 * content and already carry the same links in the sidebar, so a second copy
 * down there is noise. `children` is the slot for the visitor counter.
 */
export function SiteFooter({ children }: { children?: ReactNode }) {
  const t = useTranslations('nav');

  return (
    <footer className="relative mt-16 border-t border-border bg-surface/40">
      {/* The one gold moment: a lit seam along the top edge, the way the
          game's own panels catch light. */}
      <div
        aria-hidden
        className="absolute inset-x-0 -top-px h-px bg-[linear-gradient(90deg,transparent,rgba(224,165,60,0.55),transparent)]"
      />

      <div className="mx-auto max-w-container px-4 py-12 text-left sm:px-7">
        <div className="grid gap-x-8 gap-y-10 md:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]">
          {/* Brand */}
          <div>
            <Link href="/" className="inline-block">
              <Image
                src="/logo.png"
                alt={t('brand')}
                width={866}
                height={288}
                className="h-9 w-auto object-contain opacity-75 transition-opacity duration-150 hover:opacity-100"
              />
            </Link>
            <p className="mt-4 max-w-[36ch] text-xs leading-relaxed text-muted">
              {t('footerTagline')}
            </p>
            <div className="mt-5 flex items-center gap-2">
              <SocialLink href={DISCORD_URL} label={t('footerDiscord')}>
                <DiscordIcon />
              </SocialLink>
              <SocialLink href={YOUTUBE_URL} label={t('footerYouTube')}>
                <YouTubeIcon />
              </SocialLink>
            </div>
          </div>

          {/* Two columns on a phone, all three side by side from sm up. From md
              the wrapper dissolves so the groups sit in the outer grid next to
              the brand. */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 md:contents">
            {GROUPS.map((group) => (
              <nav key={group.key} aria-labelledby={`footer-${group.key}`}>
                <h2
                  id={`footer-${group.key}`}
                  className="text-[11px] uppercase tracking-[0.18em] text-gold-dim"
                >
                  {t(`footer${group.key.charAt(0).toUpperCase()}${group.key.slice(1)}` as 'footerDatabase')}
                </h2>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-[13px] text-muted transition-colors duration-150 hover:text-gold focus-visible:text-gold focus-visible:outline-none"
                      >
                        {t(link.key)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* Bottom bar: ownership on the left, the two disclosures on the
            right — four lines of fine print read better as two groups. The
            counter sits under the copyright because it is the same kind of
            line, and it renders nothing until its count arrives. */}
        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-6 text-[11px] leading-relaxed text-muted/70 md:flex-row md:items-end md:justify-between md:gap-8">
          <div className="space-y-1.5">
            <p>{t('footerNote', { year: new Date().getFullYear() })}</p>
            {children}
          </div>
          {/* Two lines of fine print, not two wrapped paragraphs: uncapped, and
              side by side with the copyright only from md — below that the row
              is too narrow to keep the analytics line unbroken. */}
          <div className="space-y-1 md:text-right">
            <p>{t('footerDisclaimer')}</p>
            <p>{t('footerAnalytics')}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-base border border-border text-muted transition-colors duration-150 hover:border-gold/40 hover:bg-gold-soft hover:text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
    >
      {children}
    </a>
  );
}

// lucide-react dropped its brand icons, so both marks are inlined.
function DiscordIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="h-4 w-4"
    >
      <path d="M20.317 4.369A19.79 19.79 0 0 0 15.434 3c-.211.375-.457.88-.626 1.28a18.28 18.28 0 0 0-5.615 0A12.6 12.6 0 0 0 8.56 3a19.74 19.74 0 0 0-4.886 1.372C.554 9.02-.32 13.556.113 18.028a19.9 19.9 0 0 0 6.004 3.03c.484-.66.916-1.362 1.288-2.101a12.9 12.9 0 0 1-2.028-.973c.17-.124.336-.254.497-.388a14.2 14.2 0 0 0 12.252 0c.163.135.33.265.497.388-.647.382-1.328.708-2.03.974.372.738.803 1.44 1.287 2.1a19.85 19.85 0 0 0 6.008-3.03c.507-5.184-.867-9.679-3.571-13.66ZM8.02 15.278c-1.183 0-2.157-1.086-2.157-2.42 0-1.332.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.156 2.42 0 1.334-.955 2.42-2.156 2.42Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.42 0-1.332.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.156 2.42 0 1.334-.946 2.42-2.156 2.42Z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="h-4 w-4"
    >
      <path d="M23.5 6.507a3.02 3.02 0 0 0-2.122-2.136C19.505 3.867 12 3.867 12 3.867s-7.505 0-9.378.504A3.02 3.02 0 0 0 .5 6.507C0 8.392 0 12.325 0 12.325s0 3.933.5 5.818a3.02 3.02 0 0 0 2.122 2.136c1.873.504 9.378.504 9.378.504s7.505 0 9.378-.504a3.02 3.02 0 0 0 2.122-2.136c.5-1.885.5-5.818.5-5.818s0-3.933-.5-5.818ZM9.545 15.9V8.75l6.273 3.575L9.545 15.9Z" />
    </svg>
  );
}
