# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**Dragonica Grind Tracker** — track grinding sessions, gold, and item drops across Dragonica. Monorepo with two independent apps:

```
dragonica-project/
├── frontend/   # Next.js 15 (App Router) + TypeScript + TailwindCSS
└── backend/    # NestJS 10 + Supabase JS client
```

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Frontend | Next.js 15 (App Router, Turbopack), React 19, TypeScript, TailwindCSS, TanStack Query, React Hook Form, Zod, next-intl |
| Backend  | NestJS 10, Supabase JS client, class-validator, nestjs-i18n, jose (JWT), helmet, throttler |
| Database | Supabase PostgreSQL (RLS enabled) |
| Auth     | Supabase Auth (JWT) — email/password + Google OAuth |
| Payments | Payment provider abstraction (Beam / Omise behind a flag) |

## Commands

Each app has its own `package.json` — `cd` into the app first.

**Frontend** (`frontend/`)
```bash
npm run dev      # next dev --turbopack (http://localhost:3000)
npm run build
npm run start
npm run lint
```

**Backend** (`backend/`)
```bash
npm run start:dev   # nest start --watch  (http://localhost:3001/api)
npm run build
npm run start:prod
npm run test        # jest
npm run lint        # eslint --fix
npm run format      # prettier
npm run db:types    # regenerate Supabase types → src/supabase/types/database.types.ts
```

Node.js **v22+** required (`.nvmrc`).

## Architecture Notes

- **Backend** uses the Supabase **service role key** to bypass RLS (admin access); **frontend** uses the **anon key** via the Supabase Auth client.
- Every protected endpoint requires `Authorization: Bearer <supabase_access_token>`; a NestJS guard verifies the JWT and attaches the request user.
- Backend modules are feature-scoped under `backend/src/` (auth, character, session, dashboard, admin, ticket, donation, payment, beam, omise, youtube, health), each with its own `dto/`.
- Frontend routes live under `frontend/src/app/` (App Router); shared code in `components/`, `hooks/`, `lib/` (incl. `lib/supabase/`), `types/`.
- **i18n**: frontend uses next-intl (`frontend/messages/{en,th}.json`); backend uses nestjs-i18n (`backend/src/i18n/{en,th}/`). Keep both locales in sync when adding strings.
- Database schema/migrations live in `backend/supabase/migrations/`. Tables have Row Level Security — users see only their own data.

## Conventions

- Match the existing style of the file you are editing (naming, comment density, imports).
- Backend: validate all input with DTOs + class-validator; run `npm run format`/`lint` before committing.
- Frontend: prefer Server Components; validate forms with Zod + React Hook Form; fetch server data with TanStack Query.
- Do not commit secrets — `.env` files are gitignored (see `README.md` for required vars).

## Skills

Use these installed skills (`.claude/skills/`) for the matching work:

- **frontend-developer** — building/refactoring React 19 + Next.js 15 UI components, client state, responsive layouts, accessibility, and frontend performance. Use for any work under `frontend/`.
- **nextjs-best-practices** — Next.js App Router patterns: Server Components, data fetching, routing. Consult when structuring routes, choosing server vs. client components, or reviewing data-fetching in `frontend/src/app/`.
- **backend-architect** — designing or extending backend services/APIs: service boundaries, REST design, resilience, and observability. Use when adding modules or endpoints under `backend/src/`.
- **database-architect** — schema design, data modeling, and migration planning. Use when designing new tables or altering schema in `backend/supabase/migrations/`.
- **supabase-postgres-best-practices** — Postgres performance and best practices from Supabase. Consult when writing/optimizing queries, indexes, RLS policies, or migrations.
- **frontend-design** — aesthetic direction, typography, and distinctive visual design. Use when building new UI or reshaping the look of existing screens (avoid templated defaults).
- **ui-ux-pro-max** — UI/UX design intelligence: styles, color palettes, font pairings, UX guidelines, and chart types. Use for design planning/review of pages, dashboards, and components.
