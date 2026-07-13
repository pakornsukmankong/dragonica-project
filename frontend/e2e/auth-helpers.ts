import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Auth: protected pages sit behind the middleware, which reads the Supabase
// session from the auth cookie locally (no network call — see
// src/middleware.ts). A well-formed cookie with an unexpired (unsigned) JWT is
// enough to route through; API calls are mocked per-spec with page.route.
// ---------------------------------------------------------------------------

// Cookie name is sb-<project-ref>-auth-token. CI exports the env var; local
// runs fall back to parsing frontend/.env like `next dev` does.
export function supabaseRef(): string {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)?.[1];
  }
  const ref = url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!ref) throw new Error('Cannot determine Supabase project ref');
  return ref;
}

const b64url = (s: string) =>
  Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function fakeSessionCookie() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jwt = [
    b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    b64url(JSON.stringify({ sub: 'e2e-user', role: 'authenticated', exp })),
    'e2e-signature',
  ].join('.');
  const session = {
    access_token: jwt,
    refresh_token: 'e2e-refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    user: {
      id: 'e2e-user',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'e2e@example.com',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  };
  // @supabase/ssr v0.5 stores the session as base64url JSON with this prefix.
  return `base64-${b64url(JSON.stringify(session))}`;
}
