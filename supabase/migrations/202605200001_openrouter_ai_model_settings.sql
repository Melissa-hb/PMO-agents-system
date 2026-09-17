-- Migra ai_model_settings para servir modelos via OpenRouter en vez del enum fijo de
-- OpenAI/Anthropic. OpenRouter identifica un modelo con un slug libre "vendor/modelo"
-- (ej. "anthropic/claude-opus-5"), asi que las columnas selected_model / openai_model dejan
-- de ser un enum cerrado y pasan a ser texto libre.
--
-- Se reutilizan las columnas existentes en vez de crear nuevas:
--   selected_model -> slug de OpenRouter del modelo primario
--   openai_model   -> slug de OpenRouter del modelo de respaldo (fallback)
--   anthropic_model, high_model, low_model -> quedan sin usar (no se eliminan por seguridad)
--
-- Defaults elegidos por el equipo para agentes (ver ranking en la conversacion del proyecto):
--   principal: anthropic/claude-opus-5 (razonamiento/planificacion para agentes complejos)
--   respaldo:  openai/gpt-5.6-luna (agente general + codigo, proveedor distinto para resiliencia)

alter table public.ai_model_settings
  drop constraint if exists ai_model_settings_provider_check,
  drop constraint if exists ai_model_settings_selected_model_check,
  drop constraint if exists ai_model_settings_openai_model_check,
  drop constraint if exists ai_model_settings_anthropic_model_check,
  drop constraint if exists ai_model_settings_mode_check;

update public.ai_model_settings
set
  selected_model = 'anthropic/claude-opus-5',
  openai_model = 'openai/gpt-5.6-luna',
  provider = 'anthropic',
  updated_at = now()
where id = 'global';

alter table public.ai_model_settings
  alter column selected_model set default 'anthropic/claude-opus-5',
  alter column openai_model set default 'openai/gpt-5.6-luna';
