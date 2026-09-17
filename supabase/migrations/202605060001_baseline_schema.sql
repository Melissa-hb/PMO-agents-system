-- Esquema base de la plataforma PMO. Estas tablas nunca quedaron versionadas en migraciones:
-- se crearon a mano en el dashboard de Supabase del entorno original. Se reconstruyeron aqui
-- leyendo cada `.select()`/`.insert()` del frontend y de las Edge Functions, y luego se
-- corrigieron contra el `information_schema.columns` real exportado del proyecto Cloud
-- original (ver backend/README.md, seccion "Antes de apuntar esto a produccion").
--
-- Debe ejecutarse ANTES de 202605070001_ai_model_settings.sql (que crea una policy
-- referenciando public.profiles), de ahi el timestamp anterior.

create extension if not exists pgcrypto;

-- ── enums ─────────────────────────────────────────────────────────────────────────────────
-- Valores confirmados por uso real en frontend/backend (ver grep de estado_visual/role).
do $$ begin
  create type public.estado_fase as enum ('bloqueado', 'disponible', 'procesando', 'completado', 'error');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.user_role as enum ('admin', 'auditor', 'usuario_externo');
exception when duplicate_object then null;
end $$;

-- ── profiles ──────────────────────────────────────────────────────────────────────────────
-- id coincide con auth.users.id (GoTrue). Rol de aplicacion: 'admin' | 'auditor' | 'usuario_externo'.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role public.user_role default 'usuario_externo'::public.user_role,
  empresa_id uuid,
  active boolean default true,
  updated_at timestamptz default now()
);

-- ── empresas ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tamano text,
  mision_vision text,
  created_at timestamptz default now()
);

alter table public.profiles
  add constraint profiles_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete set null;

-- ── proyectos ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.proyectos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete set null,
  auditor_id uuid references public.profiles(id) on delete set null,
  nombre_proyecto text not null,
  tamano text,
  mision text,
  vision text,
  fase_actual integer default 1,
  fecha_inicio date,
  fecha_cierre timestamptz,
  survey_token uuid default gen_random_uuid(),
  created_at timestamptz default now(),
  is_deleted boolean default false
);

-- ── fases_estado ──────────────────────────────────────────────────────────────────────────
-- (proyecto_id, numero_fase) es la clave natural usada por todo el flujo de agentes
-- (upsert con onConflict: "proyecto_id,numero_fase").
create table if not exists public.fases_estado (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  numero_fase integer,
  estado_visual public.estado_fase default 'bloqueado'::public.estado_fase,
  datos_consolidados jsonb,
  updated_at timestamptz default now(),
  unique (proyecto_id, numero_fase)
);

-- ── documentos (Fase 1) ───────────────────────────────────────────────────────────────────
create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  storage_path text not null,
  categoria text not null,
  nombre_personalizado text,
  metadatos jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ── entrevistas (Fase 2) ──────────────────────────────────────────────────────────────────
create table if not exists public.entrevistas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  nombre text not null,
  cargo text not null,
  area text,
  notas text not null,
  storage_path text,
  file_name text,
  created_at timestamptz default timezone('utc'::text, now())
);

-- ── banco_preguntas (catalogo de encuestas) ──────────────────────────────────────────────
create table if not exists public.banco_preguntas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  categoria text not null,
  texto_pregunta text not null,
  tipo text default 'likert_10'::text,
  created_at timestamptz default timezone('utc'::text, now()),
  tipo_encuesta text default 'Idoneidad'::text
);

-- ── encuestas_links (Fase 3 idoneidad / Fase 5 madurez) ──────────────────────────────────
create table if not exists public.encuestas_links (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  activo boolean default true,
  created_at timestamptz default timezone('utc'::text, now()),
  tipo_encuesta text default 'idoneidad'::text
);
create unique index if not exists encuestas_links_token_key on public.encuestas_links(token);

-- ── encuestas_respuestas ──────────────────────────────────────────────────────────────────
create table if not exists public.encuestas_respuestas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  link_id uuid references public.encuestas_links(id) on delete set null,
  nombre_encuestado text not null,
  cargo_encuestado text not null,
  area_encuestado text,
  respuestas jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()),
  tipo_encuesta text default 'idoneidad'::text
);

-- ── respuestas_encuesta (tabla legada/paralela; sin uso confirmado en el codigo actual) ──
create table if not exists public.respuestas_encuesta (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  pregunta_id uuid references public.banco_preguntas(id) on delete set null,
  usuario_id uuid references public.profiles(id) on delete set null,
  valor integer not null,
  created_at timestamptz default now()
);

-- ── configuracion_agentes (prompts de sistema por fase) ──────────────────────────────────
create table if not exists public.configuracion_agentes (
  id uuid primary key default gen_random_uuid(),
  fase_numero integer not null unique,
  nombre_fase text not null,
  prompt_sistema text not null,
  modelo text default 'gemini-flash-lite-latest'::text,
  temperatura numeric default 0.2,
  updated_at timestamptz default timezone('utc'::text, now())
);

comment on table public.configuracion_agentes is
  'Prompts de sistema por fase (fase_numero 1-11, incluye splits 6/11 y 7/10). Deben cargarse '
  'manualmente: el prompt real de cada Agente no vivia en el codigo, vivia como dato en esta '
  'tabla en el entorno original.';

-- ── iteraciones_agente (tabla legada/paralela; sin uso confirmado en el codigo actual) ───
create table if not exists public.iteraciones_agente (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  fase_numero integer,
  input_toon jsonb not null,
  output_toon jsonb not null,
  comentario_auditor jsonb,
  numero_iteracion integer default 1,
  estado_aprobacion boolean default false,
  created_at timestamptz default now()
);
