-- Ajuste de costos de IA:
-- 1) Fases con un modelo que no es de Gemini (restos de OpenAI, p. ej. "gpt-5.4-mini" en la fase 6)
--    fallaban con 404 y el backend escalaba al modelo global (Gemini Pro, el mas caro). Se igualan
--    al modelo del resto de fases.
-- 2) El modelo global (segundo intento cuando falla el de la fase) pasa de Pro a Flash, y el de
--    respaldo a Flash-Lite, para que un error temporal no dispare la ejecucion en Pro.

update public.configuracion_agentes
set modelo = 'gemini-flash-lite-latest'
where modelo is not null and modelo not ilike 'gemini%';

update public.ai_model_settings
set
  selected_model = 'gemini-flash-latest',
  openai_model = 'gemini-flash-lite-latest',
  provider = 'gemini',
  updated_at = now()
where id = 'global';

alter table public.ai_model_settings
  alter column selected_model set default 'gemini-flash-latest',
  alter column openai_model set default 'gemini-flash-lite-latest';
