'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Swords,
  Users,
  ScrollText,
  Shield,
  Settings,
  Heart,
  LifeBuoy,
  BookOpen,
  Sparkles,
  Gem,
  Skull,
  Layers,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { LoginModal } from '@/components/login-modal';
import { LoginPromptProvider } from '@/components/login-prompt';
import { api } from '@/lib/api';
import type { User } from '@supabase/supabase-js';

type NavItem = {
  href: string;
  key: string;
  icon: typeof LayoutDashboard;
  admin?: boolean;
  // Middleware bounces guests off these to /login, so they are hidden from the
  // nav rather than offered as links that go nowhere. Keep in sync with the
  // protected-route list in middleware.ts.
  auth?: boolean;
};

const NAV: NavItem[] = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard, auth: true },
  { href: '/grind', key: 'grind', icon: Swords, auth: true },
  { href: '/characters', key: 'characters', icon: Users, auth: true },
  { href: '/sessions', key: 'sessions', icon: ScrollText, auth: true },
  { href: '/skills', key: 'skills', icon: Sparkles },
  { href: '/items', key: 'items', icon: Gem },
  { href: '/monsters', key: 'monsters', icon: Skull },
  { href: '/skill-cards', key: 'skillCards', icon: Layers },
  { href: '/admin', key: 'admin', icon: Shield, admin: true, auth: true },
  { href: '/guide', key: 'guide', icon: BookOpen },
  { href: '/support', key: 'support', icon: Heart },
  { href: '/tickets', key: 'tickets', icon: LifeBuoy, auth: true },
  { href: '/settings', key: 'settings', icon: Settings, auth: true },
];

// Routes that render full-bleed without the app chrome.
const BARE_ROUTES = ['/', '/login'];

// Signing out while on one of these would be bounced to /login anyway, so we go
// there ourselves; anywhere else the guest can keep reading the page.
const PROTECTED_ROUTES = NAV.filter((i) => i.auth).map((i) => i.href);

function useAuthNav() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // getSession() reads the token from local storage (no network round-trip),
    // unlike getUser() which revalidates against the Supabase Auth server on
    // every page load. The middleware already gate-keeps protected routes, so
    // for nav display (name + admin toggle) the local session is enough and
    // makes the sidebar appear without waiting on a network call.
    // The nav is gated on `user`, so settle that from the local session first
    // and let the (networked) admin lookup resolve on its own — otherwise the
    // member links would wait on the profiles round-trip before appearing.
    supabase.auth.getSession().then(({ data }) => {
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);
      setIsLoading(false);
      if (currentUser) {
        supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .single()
          .then(({ data: profile }) => setIsAdmin(profile?.role === 'admin'));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setIsAdmin(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, isAdmin, isLoading };
}

function NavLinks({
  items,
  pathname,
  t,
  badgeFor,
  onNavigate,
  interceptAuth,
}: {
  items: NavItem[];
  pathname: string;
  t: ReturnType<typeof useTranslations<'nav'>>;
  badgeFor: (key: string) => number;
  onNavigate?: () => void;
  /** Returns true when the click was handled (guest sent to the login modal). */
  interceptAuth?: (item: NavItem) => boolean;
}) {
  return (
    <>
      {items.map((item) => {
        const { href, key, icon: Icon } = item;
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            onClick={(e) => {
              if (interceptAuth?.(item)) e.preventDefault();
              onNavigate?.();
            }}
            className={`group relative flex items-center gap-3 rounded-base px-3 py-2 text-sm font-medium transition-colors duration-150 ${
              active
                ? 'bg-gold-soft text-gold'
                : 'text-muted hover:text-foreground hover:bg-raised'
            }`}
          >
            {active && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-gold" />
            )}
            <Icon
              className={`h-[18px] w-[18px] shrink-0 ${
                active
                  ? 'text-gold'
                  : 'text-dark-gray group-hover:text-foreground'
              }`}
            />
            {t(key)}
            {badgeFor(key) > 0 && (
              <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--danger)] px-1.5 text-[10px] font-bold text-white">
                {badgeFor(key)}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );
}

function Brand() {
  const t = useTranslations('nav');
  return (
    <Link
      href="/dashboard"
      className="flex items-center justify-center px-4 h-16 border-b border-border group"
    >
      <Image
        src="/logo.png"
        alt={t('brand')}
        width={866}
        height={288}
        priority
        className="h-9 w-auto object-contain transition-transform duration-150 group-hover:scale-[1.03]"
      />
    </Link>
  );
}

function UserFooter({
  isLoading,
  user,
  displayName,
  handleLogout,
  onSignIn,
  t,
}: {
  isLoading: boolean;
  user: User | null;
  displayName: string;
  handleLogout: () => void;
  onSignIn: () => void;
  t: ReturnType<typeof useTranslations<'nav'>>;
}) {
  if (isLoading) {
    return <div className="h-9 animate-pulse rounded-base bg-raised" />;
  }
  if (user) {
    return (
      <div className="space-y-2">
        <div
          className="truncate px-2 text-xs font-medium text-foreground"
          title={user.email ?? ''}
        >
          {displayName}
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-base border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-[var(--border-danger)] hover:text-[var(--fg-danger)]"
        >
          <LogOut className="h-3.5 w-3.5" />
          {t('logout')}
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onSignIn}
      className="block w-full rounded-base bg-[var(--blue)] px-3 py-2 text-center text-xs font-semibold text-[#1b1407] shadow-button hover:opacity-90"
    >
      {t('signIn')}
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('nav');
  const { user, isAdmin, isLoading } = useAuthNav();
  const [menuOpen, setMenuOpen] = useState(false);
  // Set to the members-only href a guest just picked; drives the login modal.
  const [loginNext, setLoginNext] = useState<string | null>(null);

  // Handed to the tree so anything gated on an account can raise the same
  // modal. Declared up here because the bare-route return below is conditional
  // and hooks are not. useCallback keeps consumers off a new identity per
  // render.
  const promptLogin = useCallback((next: string) => setLoginNext(next), []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open so the page behind it stays put.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  // Display name (falls back to email when unset). Shared cache with Settings.
  const { data: me } = useQuery<{ username: string | null; email: string }>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me'),
    enabled: !!user,
  });
  const displayName = me?.username?.trim() || user?.email || '';

  // Unread notification counts for the nav badges.
  const { data: ticketUnread } = useQuery<{ count: number }>({
    queryKey: ['tickets', 'unread'],
    queryFn: () => api.get('/tickets/unread-count'),
    enabled: !!user,
    refetchInterval: 30000,
  });
  const { data: adminUnread } = useQuery<{ count: number }>({
    queryKey: ['admin', 'tickets', 'unread'],
    queryFn: () => api.get('/admin/tickets/unread-count'),
    enabled: isAdmin,
    refetchInterval: 30000,
  });
  const badgeFor = (key: string) =>
    key === 'tickets'
      ? (ticketUnread?.count ?? 0)
      : key === 'admin'
        ? (adminUnread?.count ?? 0)
        : 0;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
      router.push('/login');
    } else {
      router.refresh();
    }
  };

  if (BARE_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  // Guests still see every members-only entry — the point is to advertise what
  // an account gets you — but picking one opens the login modal instead of
  // navigating into a middleware bounce. While the session is still resolving,
  // let the click through rather than flash the modal at a signed-in user.
  const items = NAV.filter((i) => !i.admin || isAdmin);

  const interceptAuth = (item: NavItem) => {
    if (!item.auth || user || isLoading) return false;
    setLoginNext(item.href);
    return true;
  };

  // The footer button names no destination, so signing in through it keeps the
  // guest where they already were rather than shipping them off to /dashboard.
  const openSignIn = () => setLoginNext(pathname);

  return (
    <div className="min-h-screen lg:pl-60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-surface/95 backdrop-blur-sm lg:flex">
        <Brand />
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <NavLinks
            items={items}
            pathname={pathname}
            t={t}
            badgeFor={badgeFor}
            interceptAuth={interceptAuth}
          />
        </nav>
        <div className="space-y-2 border-t border-border p-3">
          <UserFooter
            isLoading={isLoading}
            user={user}
            displayName={displayName}
            handleLogout={handleLogout}
            onSignIn={openSignIn}
            t={t}
          />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-2 backdrop-blur-sm lg:hidden">
        <button
          onClick={() => setMenuOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-base text-muted hover:bg-raised hover:text-foreground"
          aria-label={t('openMenu')}
          aria-expanded={menuOpen}
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="flex items-center">
          <Image
            src="/logo.png"
            alt={t('brand')}
            width={866}
            height={288}
            priority
            className="h-8 w-auto object-contain"
          />
        </Link>
        {user ? (
          <button
            onClick={handleLogout}
            className="flex h-10 w-10 items-center justify-center rounded-base text-muted hover:text-[var(--fg-danger)]"
            aria-label={t('logout')}
          >
            <LogOut className="h-4 w-4" />
          </button>
        ) : (
          <span className="h-10 w-10" />
        )}
      </header>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${
          menuOpen ? '' : 'pointer-events-none'
        }`}
        aria-hidden={!menuOpen}
      >
        {/* Backdrop */}
        <div
          onClick={() => setMenuOpen(false)}
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
            menuOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {/* Panel */}
        <aside
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-border bg-surface shadow-card transition-transform duration-200 ease-out ${
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-16 items-center justify-between border-b border-border pl-4 pr-2">
            <Image
              src="/logo.png"
              alt={t('brand')}
              width={866}
              height={288}
              priority
              className="h-8 w-auto object-contain"
            />
            <button
              onClick={() => setMenuOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-base text-muted hover:bg-raised hover:text-foreground"
              aria-label={t('closeMenu')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            <NavLinks
              items={items}
              pathname={pathname}
              t={t}
              badgeFor={badgeFor}
              onNavigate={() => setMenuOpen(false)}
              interceptAuth={interceptAuth}
            />
          </nav>
          <div className="space-y-2 border-t border-border p-3">
            <UserFooter
              isLoading={isLoading}
              user={user}
              displayName={displayName}
              handleLogout={handleLogout}
              onSignIn={() => {
                setMenuOpen(false);
                openSignIn();
              }}
              t={t}
            />
          </div>
        </aside>
      </div>

      <LoginModal
        open={loginNext !== null}
        onOpenChange={(open) => !open && setLoginNext(null)}
        next={loginNext ?? '/dashboard'}
      />

      {/* Only the page needs the prompt — the nav gates itself through
          interceptAuth, which already has setLoginNext in scope. */}
      <LoginPromptProvider value={promptLogin}>{children}</LoginPromptProvider>
    </div>
  );
}
