-- ================================================================
-- EduClass · Supabase Schema
-- Pegá esto completo en: Supabase Dashboard → SQL Editor → Run
-- ================================================================

-- ── Extensiones ──────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Tabla: students ──────────────────────────────────────────────
-- Los alumnos NO usan Supabase Auth. Se identifican solo con PIN.
create table if not exists public.students (
  id          uuid primary key default uuid_generate_v4(),
  first_name  text not null,
  last_name   text not null,
  grade       text not null,
  level       text not null,
  pin         text not null unique check (char_length(pin) = 4),
  created_at  timestamptz default now()
);

-- ── Tabla: practices ─────────────────────────────────────────────
create table if not exists public.practices (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  subject     text not null,
  description text,
  -- questions se guarda como JSONB: array de { id, text, type, options?, correctOption?, points }
  questions   jsonb not null default '[]',
  -- assigned_to: array de UUIDs de alumnos
  assigned_to uuid[] not null default '{}',
  due_date    date,
  is_active   boolean not null default true,
  created_at  timestamptz default now()
);

-- ── Tabla: submissions ───────────────────────────────────────────
create table if not exists public.submissions (
  id                uuid primary key default uuid_generate_v4(),
  practice_id       uuid not null references public.practices(id) on delete cascade,
  student_id        uuid not null references public.students(id) on delete cascade,
  -- answers: array de { questionId, value }
  answers           jsonb not null default '[]',
  submitted_at      timestamptz default now(),
  score             integer,
  reviewed          boolean not null default false,
  teacher_note      text,
  anti_cheat_flags  text[] not null default '{}',
  -- Un alumno solo puede entregar una vez por práctica
  unique (practice_id, student_id)
);

-- ── Índices ───────────────────────────────────────────────────────
create index if not exists idx_submissions_student  on public.submissions(student_id);
create index if not exists idx_submissions_practice on public.submissions(practice_id);
create index if not exists idx_students_pin         on public.students(pin);

-- ── Row Level Security ───────────────────────────────────────────
-- IMPORTANTE: La profe usa Supabase Auth (email/password).
-- Los alumnos NO tienen cuenta de Auth — acceden con service_role
-- a través de Edge Functions o anon key con políticas abiertas
-- controladas desde la app.
-- Para simplificar el deploy inicial, usamos anon key con RLS permisivo
-- y el control de acceso lo maneja la lógica de la app.

alter table public.students    enable row level security;
alter table public.practices   enable row level security;
alter table public.submissions enable row level security;

-- Políticas: acceso total para usuarios autenticados (la profe)
create policy "Teacher full access - students"
  on public.students for all
  to authenticated
  using (true)
  with check (true);

create policy "Teacher full access - practices"
  on public.practices for all
  to authenticated
  using (true)
  with check (true);

create policy "Teacher full access - submissions"
  on public.submissions for all
  to authenticated
  using (true)
  with check (true);

-- Políticas: acceso de lectura anónimo (alumnos con PIN)
-- La app valida el PIN antes de mostrar datos. El alumno anónimo
-- puede leer students/practices/submissions, e insertar submissions.
create policy "Anon read students"
  on public.students for select
  to anon
  using (true);

create policy "Anon read practices"
  on public.practices for select
  to anon
  using (true);

create policy "Anon read submissions"
  on public.submissions for select
  to anon
  using (true);

create policy "Anon insert submissions"
  on public.submissions for insert
  to anon
  with check (true);

-- ================================================================
-- FIN DEL SCHEMA
-- ================================================================
-- Después de correr esto:
-- 1. Ve a Authentication → Users → Invite user
--    (o usa "Sign up" con email/password para crear la cuenta de la profe)
-- 2. Copia la URL y anon key desde Settings → API
-- 3. Pegálas en el archivo .env de la app
-- ================================================================
