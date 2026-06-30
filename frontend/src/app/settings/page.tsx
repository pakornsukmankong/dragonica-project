'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import type { User } from '@supabase/supabase-js';

interface MeProfile {
  id: string;
  email: string;
  username: string | null;
  avatarUrl: string | null;
}

function DisplayNameForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [ready, setReady] = useState(false);

  const { data: me } = useQuery<MeProfile>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me'),
  });

  useEffect(() => {
    if (me && !ready) {
      setDisplayName(me.username ?? '');
      setReady(true);
    }
  }, [me, ready]);

  const saveMutation = useMutation({
    mutationFn: (username: string) => api.patch('/auth/me', { username }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast({ title: 'Display name updated', variant: 'success' });
    },
    onError: (e) =>
      toast({
        title: 'Could not update display name',
        description: (e as Error).message,
        variant: 'error',
      }),
  });

  return (
    <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6 mb-6">
      <h2 className="text-sm font-medium text-foreground mb-1">Display Name</h2>
      <p className="text-xs text-muted mb-4">
        Shown across the app. Leave it empty to use your email instead.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id="display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={30}
          placeholder="Your display name"
          className="flex-1 rounded-base border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20"
        />
        <button
          onClick={() => saveMutation.mutate(displayName.trim())}
          disabled={saveMutation.isPending || displayName === (me?.username ?? '')}
          className="shrink-0 rounded-base px-5 py-2.5 text-sm font-medium text-[#1b1407] bg-[var(--blue)] shadow-button transition-colors duration-150 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setIsLoading(false);
    });
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-root flex items-center justify-center">
        <p className="text-sm text-muted">Loading...</p>
      </div>
    );
  }

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
        <div className="relative z-10 mx-auto max-w-[600px] px-4 sm:px-7">
          <div className="mb-10">
            <h1 className="text-xl laptop:text-2xl font-medium text-foreground">
              Settings
            </h1>
            <p className="text-sm text-muted mt-2">
              Manage your account
            </p>
          </div>

          {/* Display name */}
          <DisplayNameForm />

          {/* Account info (read-only) */}
          <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6 mb-6">
            <h2 className="text-sm font-medium text-foreground mb-4">Account Info</h2>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center py-2 border-b border-[rgba(255,255,255,0.05)]">
                <span className="text-xs text-muted">Email</span>
                <span className="text-sm text-foreground">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[rgba(255,255,255,0.05)]">
                <span className="text-xs text-muted">Provider</span>
                <span className="text-sm text-foreground capitalize">
                  {user?.app_metadata?.provider ?? 'email'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[rgba(255,255,255,0.05)]">
                <span className="text-xs text-muted">Created</span>
                <span className="text-sm text-foreground">
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-muted">Last Sign In</span>
                <span className="text-sm text-foreground">
                  {user?.last_sign_in_at
                    ? new Date(user.last_sign_in_at).toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-surface rounded-base outline outline-1 outline-[rgba(255,255,255,0.08)] p-6 mb-6">
            <h2 className="text-sm font-medium text-foreground mb-4">Account</h2>
            <div className="flex flex-col gap-4">
              <button
                onClick={handleSignOut}
                className="w-full rounded-base px-4 py-2.5 text-sm font-medium text-foreground border border-border hover:bg-raised transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2"
              >
                Sign Out
              </button>

              {!isDeleting ? (
                <button
                  onClick={() => setIsDeleting(true)}
                  className="w-full rounded-base px-4 py-2.5 text-sm font-medium text-[var(--fg-danger)] border border-[var(--border-danger)] hover:bg-[var(--danger-soft)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:ring-offset-2"
                >
                  Delete Account
                </button>
              ) : (
                <div className="rounded-base bg-[var(--danger-soft)] border border-[var(--border-danger)] p-4">
                  <p className="text-xs text-[var(--fg-danger)] mb-3">
                    Are you sure? This will permanently delete your account and all data.
                    This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsDeleting(false)}
                      className="rounded-base px-4 py-2 text-xs font-medium text-foreground border border-border hover:bg-raised transition-colors duration-150"
                    >
                      Cancel
                    </button>
                    <button
                      className="rounded-base px-4 py-2 text-xs font-medium text-white bg-[var(--danger)] transition-colors duration-150 hover:opacity-90"
                    >
                      Confirm Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* App Info */}
          <div className="text-center">
            <p className="text-xs text-muted">
              Dragonica Grind Tracker v0.1.0
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
