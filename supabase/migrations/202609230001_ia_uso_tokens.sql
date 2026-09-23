-- Registro del consumo de tokens de cada llamada exitosa a Gemini (usageMetadata), para medir
-- el costo real por fase y comparar el efecto de las optimizaciones de payload.
create table if not exists public.ia_uso_tokens (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  fase_numero integer not null,
  modelo text,
  prompt_tokens integer,     -- tokens de entrada (incluye los cacheados)
  cached_tokens integer,     -- parte de la entrada servida desde la cache de Gemini (con descuento)
  output_tokens integer,     -- tokens de la respuesta
  thoughts_tokens integer,   -- tokens de razonamiento interno del modelo (se cobran como salida)
  total_tokens integer,
  duracion_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists ia_uso_tokens_proyecto_fase_idx on public.ia_uso_tokens (proyecto_id, fase_numero);
create index if not exists ia_uso_tokens_created_at_idx on public.ia_uso_tokens (created_at);

-- Solo la usa el backend (rol postgres, que no pasa por RLS); con RLS activo y sin policies no
-- queda expuesta a traves de la API publica de Supabase.
alter table public.ia_uso_tokens enable row level security;

-- Resumen por fase: fase 9 = Agente 3.1 (preguntas de entrevista), fase 8 = artefactos.
-- security_invoker: la vista respeta el RLS de la tabla (sin esto se ejecutaria con los
-- permisos del dueño y expondria los datos por la API).
create or replace view public.ia_uso_tokens_por_fase with (security_invoker = true) as
select
  fase_numero,
  count(*)                               as llamadas,
  round(avg(prompt_tokens))              as entrada_promedio,
  round(avg(cached_tokens))              as cacheados_promedio,
  round(avg(output_tokens))              as salida_promedio,
  round(avg(thoughts_tokens))            as razonamiento_promedio,
  sum(total_tokens)                      as total_tokens,
  max(created_at)                        as ultima_llamada
from public.ia_uso_tokens
group by fase_numero
order by fase_numero;
