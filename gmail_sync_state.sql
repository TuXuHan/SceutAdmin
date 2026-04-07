create table if not exists public.gmail_sync_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.gmail_sync_state disable row level security;
