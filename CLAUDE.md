# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**Dragonica Grind Tracker** (dgn-grind.dev) — track grinding sessions, gold, and item drops across Dragonica, plus a public game database (items, monsters, guides) and a skill simulator with shareable community builds. Monorepo with two independent apps:

```
dragonica-project/
├── frontend/   # Next.js 15 (App Router) + TypeScript + TailwindCSS
└── backend/    # NestJS 11 + Supabase JS client
```

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Frontend | Next.js 15 (App Router, Turbopack), React 19, TypeScript, TailwindCSS 3, TanStack Query, React Hook Form, Zod, next-intl, Motion, Radix primitives |
| Backend  | NestJS 11, Supabase JS client, class-validator, nestjs-i18n, jose (JWT), helmet, @nestjs/throttler |
| Database | Supabase PostgreSQL (RLS enabled, but see Architecture Notes) |
| Auth     | Supabase Auth (JWT) — email/password + Google & Discord OAuth |
| Payments | Provider abstraction in `backend/src/payment/` — `omise` / `beam` / `stripe` / `manual`, selected by the `PAYMENT_PROVIDER` env flag (default `omise`; **production runs `stripe`** with PromptPay + card) |

## Commands

Each app has its own `package.json` — `cd` into the app first.

**Frontend** (`frontend/`)
```bash
npm run dev       # next dev --turbopack (http://localhost:3000)
npm run build
npm run start
npm run lint
npm run test:e2e  # Playwright (specs in e2e/, API mocked)
```

**Backend** (`backend/`)
```bash
npm run start:dev   # nest start --watch  (http://localhost:3001/api)
npm run build
npm run start:prod
npm run test        # jest (*.spec.ts next to source)
npm run lint        # eslint --fix
npm run format      # prettier
npm run db:types    # regenerate Supabase types → src/supabase/types/database.types.ts
```

Node.js **v22+** required (`.nvmrc`, `engines`).

## Architecture Notes

- **Backend** uses the Supabase **service role key**, which **bypasses RLS** — RLS policies exist on the tables, but they do not protect backend queries. Every user-scoped query must filter by the authenticated user (`.eq('user_id', user.sub)`); follow the existing `findOneByUser` ownership-check pattern before update/delete. **Frontend** uses the **anon key** via the Supabase Auth client only for auth/session — all data goes through the NestJS API (`lib/api.ts` injects the Bearer token).
- Every protected endpoint requires `Authorization: Bearer <supabase_access_token>`; `JwtAuthGuard` verifies the JWT against Supabase's remote JWKS and attaches the request user (`user.sub` = user id). `AdminGuard` additionally checks `profiles.role === 'admin'`. Public (no-JWT) endpoints: health check, payment webhooks, site visit counters, YouTube channel stats, and the read side of skill-simulator community builds.
- Backend modules are feature-scoped under `backend/src/` (auth, character, session, dashboard, admin, ticket, donation, payment, beam, omise, stripe, skill, stats, youtube, health), each with its own `dto/`. `main.ts` sets helmet, a global ValidationPipe (`whitelist` + `forbidNonWhitelisted`), a global exception filter, a global rate limit (100 req/min via ThrottlerGuard), prefix `api`, and `rawBody: true` (needed to verify webhook signatures).
- CORS: `FRONTEND_URL` may be a **comma-separated allow-list**; `ALLOW_VERCEL_PREVIEWS=true` also accepts `*.vercel.app` preview deploys.
- **Donations**: amounts stored in **satang** (฿1 = 100). Status is set only by the backend after re-fetching the charge from the gateway — never trusted from the client or a raw webhook payload. Webhooks per provider: `omise` (verify by re-fetch), `beam` (`X-Beam-Signature` over the raw body), `stripe` (`Stripe-Signature`, endpoint-specific `STRIPE_WEBHOOK_SECRET`). `manual` mode renders a PromptPay QR (`qrcode` pkg) and an admin confirms/rejects after checking the bank statement.
- Frontend routes live under `frontend/src/app/` (App Router); shared code in `components/`, `hooks/`, `lib/` (incl. `lib/supabase/`), `types/`. `middleware.ts` cookie-gates the protected routes (`/dashboard`, `/characters`, `/sessions`, `/grind`, `/admin`, `/support`, `/tickets`, `/settings`) without a network call — real protection is the API's JWT check.
- **Public game-database pages** (`/items`, `/monsters`, `/skills`, `/guide`) are SEO-facing (sitemap.ts, robots.ts, OG images) and read **static JSON from `frontend/public/data/`**, not the API. The skill simulator's community builds (like/comment/share) do use the API (`/api/skills/*`).
- **i18n**: frontend uses next-intl (`frontend/messages/{en,th}.json`); backend uses nestjs-i18n (`backend/src/i18n/{en,th}/`). Keep both locales in sync when adding strings.
- Database schema/migrations live in `backend/supabase/migrations/` (`001`–`008`, applied in order via the Supabase SQL Editor). These are a **consolidated baseline** (2026-07) equivalent to the original migrations 001–028, which production has already applied — they are for fresh setups only; new schema changes go in new numbered files on top. Tables: `profiles` (incl. `role`), `classes`, `characters`, `dungeons`, `items` (incl. `game_item_id`, `icon`), `sessions`, `session_drops`, `donations` (incl. `provider`, `hide_amount`, `hide_from_wall`), `tickets`, `ticket_messages`, `site_counters`, `skill_classes`, `skills`, `skill_builds`, `skill_build_likes`, `skill_build_comments`.

## Deployment

- Frontend: **Vercel** → `https://dgn-grind.dev` (DNS on Cloudflare, Vercel records must stay **DNS only** / gray cloud).
- Backend: **Railway** → `https://api.dgn-grind.dev/api` (Cloudflare-proxied is fine; SSL mode Full (Strict)).
- After changing `NEXT_PUBLIC_*` vars on Vercel you must redeploy (they are baked at build time). `FRONTEND_URL` on Railway controls CORS. Payment webhooks must point at the `api.` domain for the **active** provider (production: Stripe).

## Conventions

- Match the existing style of the file you are editing (naming, comment density, imports).
- Backend ↔ DB is snake_case; DTOs are camelCase and mapped to snake_case in services. Validate all input with DTOs + class-validator; run `npm run format`/`lint` before committing.
- Frontend: prefer Server Components; validate forms with Zod + React Hook Form; fetch server data with TanStack Query.
- Do not commit secrets — `.env` files are gitignored (see `README.md` for required vars). The service role key and all payment secret keys are backend-only.

## Skills

Use these installed skills (`.claude/skills/`) for the matching work:

- **frontend-developer** — building/refactoring React 19 + Next.js 15 UI components, client state, responsive layouts, accessibility, and frontend performance. Use for any work under `frontend/`.
- **nextjs-best-practices** — Next.js App Router patterns: Server Components, data fetching, routing. Consult when structuring routes, choosing server vs. client components, or reviewing data-fetching in `frontend/src/app/`.
- **backend-architect** — designing or extending backend services/APIs: service boundaries, REST design, resilience, and observability. Use when adding modules or endpoints under `backend/src/`.
- **database-architect** — schema design, data modeling, and migration planning. Use when designing new tables or altering schema in `backend/supabase/migrations/`.
- **supabase-postgres-best-practices** — Postgres performance and best practices from Supabase. Consult when writing/optimizing queries, indexes, RLS policies, or migrations.
- **frontend-design** — aesthetic direction, typography, and distinctive visual design. Use when building new UI or reshaping the look of existing screens (avoid templated defaults).
- **ui-ux-pro-max** — UI/UX design intelligence: styles, color palettes, font pairings, UX guidelines, and chart types. Use for design planning/review of pages, dashboards, and components.
