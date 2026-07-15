# Dragonica Grind Tracker

Track your grinding sessions, gold, and item drops across Dragonica.

> Updates are announced automatically in our Discord `#patch-notes` channel whenever a change ships to production.

## Project Structure

```
dragonica-project/
├── frontend/          # Next.js 15 + TailwindCSS + Paper Design System
├── backend/           # NestJS + Supabase Client
└── .kiro/             # AI steering and skills
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, TailwindCSS, TanStack Query, React Hook Form, Zod |
| Backend | NestJS, Supabase JS Client |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (JWT) |
| Design | Paper Design System |

---

## Prerequisites

- Node.js v22+ (see `.nvmrc` — run `nvm use`)
- npm
- Supabase account ([supabase.com](https://supabase.com))

---

## Setup

### 1. Create Supabase Project

1. ไปที่ [supabase.com](https://supabase.com) แล้วสร้าง project ใหม่
2. รอให้ project พร้อมใช้งาน
3. จดค่าเหล่านี้จาก **Settings → API**:
   - `Project URL` (เช่น `https://xxxxx.supabase.co`)
   - `anon public` key
   - `service_role` key (ใช้ฝั่ง backend เท่านั้น)
   - `JWT Secret` (อยู่ใน Settings → API → JWT Settings)

### 2. Setup Google Login (OAuth)

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com)
2. สร้าง Project (หรือเลือก project ที่มีอยู่)
3. ไปที่ **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. เลือก Application type: **Web application**
5. ตั้งค่า:
   - **Authorized JavaScript origins:** `http://localhost:3000`
   - **Authorized redirect URIs:** `https://<your-project>.supabase.co/auth/v1/callback`
6. Copy **Client ID** และ **Client Secret**

จากนั้นใน Supabase Dashboard:

1. ไปที่ **Authentication → Providers → Google**
2. Enable Google provider
3. ใส่ Client ID และ Client Secret ที่ได้จาก Google Cloud Console
4. กด Save

> **หมายเหตุ:** Redirect URL ของ Supabase จะแสดงอยู่ในหน้า Provider settings (`https://<project>.supabase.co/auth/v1/callback`) ให้นำไปใส่ใน Google Cloud Console ให้ตรงกัน

### 3. Run Database Migrations

1. ไปที่ Supabase Dashboard → **SQL Editor**
2. สร้าง New Query
3. Copy เนื้อหาจากไฟล์ใน `backend/supabase/migrations/` ไปวางแล้วกด **Run** ทีละไฟล์ **เรียงตามลำดับ** (`001` → `008`) — จะสร้าง tables, indexes, RLS policies, seed data, และ triggers ทั้งหมด

### 4. Setup Backend

```bash
cd backend

# Install dependencies
npm install

# สร้างไฟล์ .env
cp .env.example .env
```

แก้ไข `backend/.env` ใส่ค่าจาก Supabase:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
FRONTEND_URL=http://localhost:3000
PORT=3001
```

รัน backend:

```bash
npm run start:dev
```

API จะรันที่ `http://localhost:3001/api`

### 5. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# สร้างไฟล์ .env
cp .env.example .env
```

แก้ไข `frontend/.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

รัน frontend:

```bash
npm run dev
```

เปิดที่ `http://localhost:3000`

---

## API Endpoints

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/me` | Get current user profile |

### Characters

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/characters` | List all characters |
| GET | `/api/characters/:id` | Get character by ID |
| POST | `/api/characters` | Create character |
| PATCH | `/api/characters/:id` | Update character |
| DELETE | `/api/characters/:id` | Delete character |

### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/:id` | Get session by ID |
| POST | `/api/sessions` | Create session |
| PATCH | `/api/sessions/:id` | Update session |
| DELETE | `/api/sessions/:id` | Delete session |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/summary` | Get dashboard summary |

---

## Authentication Flow

### Email/Password

```
User Login → Supabase Auth → Access Token → Frontend (Bearer) → NestJS Guard → Verify JWT → Request User
```

### Google OAuth

```
User clicks "Continue with Google" → Supabase redirects to Google → User authorizes → Google redirects to Supabase callback → Supabase redirects to /auth/callback → Exchange code for session → Redirect to /dashboard
```

ทุก endpoint (ยกเว้น public) ต้องส่ง Header:

```
Authorization: Bearer <supabase_access_token>
```

---

## Development Notes

- Backend ใช้ Supabase service role key เพื่อ bypass RLS (admin access)
- Frontend ใช้ anon key ผ่าน Supabase Auth client
- Database types สามารถ generate ใหม่ได้ด้วย `supabase gen types typescript --local`
- Tables มี Row Level Security (RLS) เปิดอยู่ — user เห็นเฉพาะ data ของตัวเอง
