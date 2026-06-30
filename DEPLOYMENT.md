# Deployment

Two independent apps. Deploy them separately.

## Backend (NestJS API)

A `Dockerfile` is provided (`backend/Dockerfile`) — suitable for **Railway**,
**Render**, **Fly.io**, or any container host.

```bash
cd backend
docker build -t dragonica-api .
docker run -p 3001:3001 --env-file .env dragonica-api
```

Required environment variables (set in the host's dashboard, not committed):

| Var | Notes |
|-----|-------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | **backend only** — bypasses RLS |
| `SUPABASE_JWT_SECRET` | from Supabase API settings |
| `FRONTEND_URL` | deployed frontend origin (for CORS) |
| `PORT` | defaults to `3001` |

On Railway/Render: point the service at `backend/`, it auto-detects the
Dockerfile. Set the start command to the image default (`node dist/main`).

## Frontend (Next.js)

### Option A — Vercel (recommended, zero-config)

Import the repo, set the root directory to `frontend/`. Vercel ignores the
Dockerfile and builds natively. Add the env vars below in the project settings.

### Option B — Docker (standalone output)

`next.config.ts` sets `output: 'standalone'`, so `frontend/Dockerfile`
produces a small self-contained image. `NEXT_PUBLIC_*` values are **baked in at
build time** — pass them as build args:

```bash
cd frontend
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  --build-arg NEXT_PUBLIC_API_URL=https://your-api.example.com/api \
  -t dragonica-web .
docker run -p 3000:3000 dragonica-web
```

Frontend env vars:

| Var | Notes |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
| `NEXT_PUBLIC_API_URL` | deployed backend URL + `/api` |

## CI

`.github/workflows/ci.yml` runs on every push/PR to `master`:
- **backend**: `eslint` · `jest` · `nest build`
- **frontend**: `tsc --noEmit` · `next build`

## Database

Apply `backend/supabase/migrations/*.sql` in order via the Supabase SQL Editor
before first deploy. `users` is managed by Supabase Auth.
