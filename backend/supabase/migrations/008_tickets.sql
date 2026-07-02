-- Support tickets: users report problems, admins reply and manage status.
-- A ticket is a conversation thread — each reply is a row in ticket_messages.
-- RLS is enabled (deny-by-default); the backend uses the service-role key and
-- enforces per-user ownership in application code, same as the other tables.
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  subject text not null,
  status text not null default 'open',   -- open | in_progress | resolved | closed
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  is_admin boolean not null default false,  -- true when written from the admin side
  body text not null,
  image_url text,                           -- optional screenshot (Supabase Storage)
  created_at timestamptz default now()
);

create index if not exists tickets_user_id_idx on tickets (user_id);
-- Admin queue: newest activity first, filterable by status.
create index if not exists tickets_status_idx on tickets (status, updated_at desc);
-- Thread messages in chronological order.
create index if not exists ticket_messages_ticket_id_idx on ticket_messages (ticket_id, created_at);
