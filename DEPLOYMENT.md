# Deployment

Two independent apps deployed separately: **backend → Railway**, **frontend →
Vercel**, both backed by a **Supabase** project. Requires **Node 22+**.

## Deploy order

The frontend needs the backend URL and the backend needs the frontend URL
(for CORS), so deploy in this order:

1. Prepare **Supabase** (migrations, storage bucket, auth) — below.
2. Deploy **backend → Railway**, generate its public domain.
3. Deploy **frontend → Vercel** with `NEXT_PUBLIC_API_URL` = `<railway-domain>/api`.
4. Set the backend's `FRONTEND_URL` to the Vercel domain and redeploy.
5. Update Supabase Auth **Site URL** + **Redirect URLs**, the **Omise webhook**,
   and the OAuth providers' redirect URIs.

---

## 1. Supabase

- **Migrations** — apply `backend/supabase/migrations/*.sql` in order
  (`001` → `009`) via the SQL Editor. Choose "Run and enable RLS" when prompted.
  `users` is managed by Supabase Auth.
- **Storage bucket** — create a **public** bucket named **`assets`** (used for
  dungeon/item images, ticket screenshots). Public buckets are world-readable;
  add an insert policy so signed-in users can upload:

  ```sql
  create policy "authenticated can upload to assets"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'assets');
  ```

- **Auth → URL Configuration**
  - **Site URL**: your Vercel production URL (e.g. `https://your-app.vercel.app`).
  - **Redirect URLs**: add `https://your-app.vercel.app/**` (and any custom
    domain). Keep `http://localhost:3000/**` for local dev.
- **Auth → Providers** — enable **Google** and **Discord**, paste their
  production client id/secret. Each provider's own redirect URI must be
  `https://<project-ref>.supabase.co/auth/v1/callback` (this never changes).
- **Admin user** — after signing in once, grant yourself admin:

  ```sql
  update profiles set role = 'admin' where id = '<your-user-uuid>';
  ```

---

## 2. Backend → Railway

`backend/Dockerfile` (Node 22) and `backend/railway.json` are provided.

1. New project → deploy from the repo → set the service **Root Directory** to
   **`backend`**. Railway reads `railway.json` and builds the Dockerfile.
2. **Generate a domain** — this is your API host. The API is served under
   `/api`, and the healthcheck (`/api/health`, wired in `railway.json`) is used
   to gate deploys.
3. **Do not set `PORT`** — Railway injects it; the app reads `process.env.PORT`.
4. Set the environment variables:

| Var | Notes |
|-----|-------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | **backend only** — bypasses RLS |
| `SUPABASE_JWT_SECRET` | from Supabase API settings |
| `FRONTEND_URL` | Vercel origin(s) for CORS — comma-separated allow-list |
| `ALLOW_VERCEL_PREVIEWS` | `true` to also allow `*.vercel.app` preview deploys |
| `OMISE_PUBLIC_KEY` / `OMISE_SECRET_KEY` | Omise keys (test or live) |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key (optional) |
| `YOUTUBE_CHANNEL_ID` | defaults to the app's channel if unset |

Local Docker equivalent:

```bash
cd backend
docker build -t dragonica-api .
docker run -p 3001:3001 --env-file .env dragonica-api
```

---

## 3. Frontend → Vercel

`frontend/vercel.json` pins the Next.js framework and build/install commands.

1. Import the repo → set **Root Directory** to **`frontend`**.
2. **Node version**: the app requires Node 22 (`engines` in `package.json`);
   Vercel honours it, but confirm the project's Node.js version is **22.x** in
   Settings if a build picks an older default.
3. Set the environment variables **before the first build** — `NEXT_PUBLIC_*`
   values are baked in at build time:

| Var | Notes |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
| `NEXT_PUBLIC_API_URL` | backend URL **+ `/api`**, e.g. `https://api.up.railway.app/api` |

### Docker alternative (standalone output)

`next.config.ts` sets `output: 'standalone'`, so `frontend/Dockerfile` builds a
small self-contained image. `NEXT_PUBLIC_*` values must be passed as build args:

```bash
cd frontend
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  --build-arg NEXT_PUBLIC_API_URL=https://your-api.example.com/api \
  -t dragonica-web .
docker run -p 3000:3000 dragonica-web
```

---

## 4. Omise (donations)

- Use **test keys** to demo; switch to **live keys** after business verification.
- Set the webhook (Omise Dashboard → Webhooks) to
  `https://<railway-domain>/api/donations/omise/webhook`.

## CORS

`FRONTEND_URL` is a comma-separated allow-list. Requests with no `Origin`
header (server-to-server, the Omise webhook) are always allowed. Vercel
**preview** deploys use random `*.vercel.app` URLs — set
`ALLOW_VERCEL_PREVIEWS=true` on the backend to let them call the API, or keep it
`false` to restrict access to the production origin(s) only.

## CI

`.github/workflows/ci.yml` runs on every push/PR to `master`:
- **backend**: `eslint` · `jest` · `nest build`
- **frontend**: `tsc --noEmit` · `next build`
