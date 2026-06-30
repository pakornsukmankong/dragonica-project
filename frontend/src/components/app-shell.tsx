'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Swords,
  Users,
  ScrollText,
  Shield,
  Settings,
  LogOut,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import type { User } from '@supabase/supabase-js';

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  admin?: boolean;
};

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/grind', label: 'Grind', icon: Swords },
  { href: '/characters', label: 'Characters', icon: Users },
  { href: '/sessions', label: 'Sessions', icon: ScrollText },
  { href: '/admin', label: 'Admin', icon: Shield, admin: true },
  { href: '/settings', label: 'Settings', icon: Settings },
];

// Routes that render full-bleed without the app chrome.
const BARE_ROUTES = ['/', '/login'];

function useAuthNav() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();
        setIsAdmin(profile?.role === 'admin');
      }
      setIsLoading(false);
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

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2.5 px-4 h-16 border-b border-border group"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-base bg-gold-soft text-gold shadow-gold">
        <Swords className="h-4 w-4" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-sm font-bold tracking-tight text-foreground">
          Dragonica
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-gold-dim">
          Grind Tracker
        </span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, isLoading } = useAuthNav();

  // Display name (falls back to email when unset). Shared cache with Settings.
  const { data: me } = useQuery<{ username: string | null; email: string }>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me'),
    enabled: !!user,
  });
  const displayName = me?.username?.trim() || user?.email || '';

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (BARE_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  const items = NAV.filter((i) => !i.admin || isAdmin);

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {items.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
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
            {label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen lg:pl-60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-surface/95 backdrop-blur-sm lg:flex">
        <Brand />
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <NavLinks />
        </nav>
        <div className="border-t border-border p-3">
          {isLoading ? (
            <div className="h-9 animate-pulse rounded-base bg-raised" />
          ) : user ? (
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
                Logout
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="block rounded-base bg-[var(--blue)] px-3 py-2 text-center text-xs font-semibold text-[#1b1407] shadow-button hover:opacity-90"
            >
              Sign In
            </Link>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur-sm lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-base bg-gold-soft text-gold">
            <Swords className="h-4 w-4" />
          </span>
          <span className="text-sm font-bold text-foreground">Dragonica</span>
        </Link>
        {user && (
          <button
            onClick={handleLogout}
            className="rounded-base border border-border p-1.5 text-muted hover:text-[var(--fg-danger)]"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </header>

      {/* Mobile horizontal nav */}
      <nav className="sticky top-14 z-30 flex gap-1 overflow-x-auto border-b border-border bg-surface/95 px-2 py-2 backdrop-blur-sm lg:hidden">
        <NavLinks />
      </nav>

      {children}
    </div>
  );
}
