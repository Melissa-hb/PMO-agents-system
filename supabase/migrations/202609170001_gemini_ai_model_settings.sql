-- Migra ai_model_settings para servir modelos via Google Gemini en vez de OpenRouter.
-- La migracion 202605200001_openrouter_ai_model_settings.sql que debia quitar los
-- CHECK constraints del enum viejo nunca se aplico contra esta base (seguian activos),
-- asi que se repite aqui junto con el cambio de proveedor.
--
-- Gemini identifica un modelo por su nombre directo (ej. "gemini-pro-latest"), sin
-- prefijo de vendor:
--   selected_model -> nombre de modelo de Gemini primario
--   openai_model   -> nombre de modelo de Gemini de respaldo (fallback)
--   anthropic_model, high_model, low_model -> siguen sin usarse

alter table public.ai_model_settings
  drop constraint if exists ai_model_settings_provider_check,
  drop constraint if exists ai_model_settings_selected_model_check,
  drop constraint if exists ai_model_settings_openai_model_check,
  drop constraint if exists ai_model_settings_anthropic_model_check,
  drop constraint if exists ai_model_settings_mode_check;

update public.ai_model_settings
set
  selected_model = 'gemini-pro-latest',
  openai_model = 'gemini-flash-latest',
  provider = 'gemini',
  updated_at = now()
where id = 'global';

alter table public.ai_model_settings
  alter column selected_model set default 'gemini-pro-latest',
  alter column openai_model set default 'gemini-flash-latest';
