# PMO Backend (Spring Boot)

Backend de negocio de la plataforma PMO. Reemplaza la logica que hoy vive en las Edge
Functions de Supabase (`supabase/functions/*`) y en llamadas directas a la base de datos
desde el frontend (`supabase.from(...)`).

## Arquitectura

Supabase (self-hosted) queda reducido a **infraestructura generica**, no a "el backend":

- **Postgres**: sigue siendo la base de datos. Este servicio se conecta por JDBC directo
  (`SPRING_DATASOURCE_URL`), no via PostgREST.
- **GoTrue (Supabase Auth)**: se mantiene como proveedor de identidad. El frontend sigue
  usando `supabase-js` solo para login/logout/sesion; este backend valida el JWT que GoTrue
  firma contra su JWKS (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json` — GoTrue firma los
  tokens de sesion con una signing key asimetrica propia del proyecto, no con un secreto
  compartido) y carga el rol de aplicacion desde `profiles`.
- **Supabase Storage**: se mantiene como almacen de archivos (bucket `documentos-pmo`). Este
  backend sube/firma/borra archivos via la Service Role Key; el frontend deja de hablar con
  Storage directamente.

Toda la logica de negocio (fases del proyecto, orquestacion de IA, calculo deterministico de
idoneidad, creacion de usuarios, etc.) vive ahora en Java, en este proyecto.

## Requisitos

- Java 21
- Maven (o usa cualquier IDE con soporte Maven)
- Postgres accesible (el de tu proyecto Supabase self-hosted)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`

## Variables de entorno

| Variable | Descripcion |
|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://<host>:<port>/<db>` del Postgres de Supabase |
| `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD` | credenciales de Postgres |
| `SUPABASE_URL` | URL base del proyecto self-hosted (GoTrue Admin API, JWKS y Storage API) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key (crear usuarios, subir/firmar/borrar archivos) |
| `SUPABASE_STORAGE_BUCKET` | por defecto `documentos-pmo` |
| `GEMINI_API_KEY` | key de Google AI Studio/Gemini — unico proveedor de IA, ver seccion abajo |
| `APP_CORS_ALLOWED_ORIGINS` | origen(es) del frontend, ej. `http://localhost:5173` |

## IA: Gemini como unico proveedor

Todas las llamadas a IA pasan por la API de [Google Gemini](https://ai.google.dev)
(`service/ai/GeminiClient.java`), no por OpenAI/Anthropic/OpenRouter. Un modelo se identifica
con su nombre directo de Gemini (ej. `gemini-pro-latest`, `gemini-flash-latest`), sin prefijo
de vendor.

- **`AiFallbackService`** intenta en orden: el modelo explicito de la fase
  (`configuracion_agentes.modelo`, si esta seteado) → el modelo global (`ai_model_settings.selected_model`)
  → el modelo de respaldo (`ai_model_settings.openai_model`, reutilizado como `fallback_model`).
- El campo de modelo en el panel de admin es **texto libre**, no una lista cerrada — cualquier
  nombre de modelo valido de Gemini funciona.
- **Requiere migracion de base de datos** antes de usarse: `supabase/migrations/202605200001_openrouter_ai_model_settings.sql`
  quita los `CHECK constraints` que la tabla `ai_model_settings` tenia (restringian esas columnas
  a los 5 nombres fijos del enum viejo de OpenAI/Anthropic). Sin esa migracion, guardar un
  modelo nuevo falla con una violacion de constraint. Aplicala con `supabase db push` o
  pegandola en el SQL editor de tu proyecto.
- Los defaults (`AiModelDefaults.DEFAULT_MODEL` / `DEFAULT_FALLBACK_MODEL`) son un punto de
  partida razonable, no una garantia — verifica que existan en el catalogo actual de Gemini
  (https://ai.google.dev/gemini-api/docs/models) antes de confiar en ellos en produccion.

## Ejecutar

```bash
cd backend
mvn spring-boot:run
```

o generar el jar:

```bash
mvn -DskipTests package
java -jar target/backend-0.1.0.jar
```

## Antes de apuntar esto a produccion

1. **Valida el esquema real.** El repo no tenia (fuera de `ai_model_settings`) migraciones
   SQL versionadas para `profiles`, `proyectos`, `empresas`, `documentos`, `entrevistas`,
   `encuestas_links`, `encuestas_respuestas`, `banco_preguntas` ni `configuracion_agentes`:
   se crearon directamente en el dashboard de Supabase. Las entidades JPA en
   `src/main/java/com/pmo/backend/domain` se reconstruyeron leyendo cada `.select()`/`.insert()`
   del frontend y de las Edge Functions, no un `pg_dump`. `spring.jpa.hibernate.ddl-auto=validate`
   (ver `application.yml`) hara que el arranque falle si algo no calza exactamente contra tu
   base real — es la forma de detectar cualquier diferencia antes de usarlo en serio.
2. **Rewire del frontend — hecho.** El frontend (`src/app/**`) ya llama a este backend
   (`src/app/lib/api.ts`) en vez de `supabase.from(...)`/`supabase.functions.invoke(...)`.
   Solo quedan 3 archivos que siguen usando `supabase.storage` directo para refrescar signed
   URLs de descarga (lectura, no escritura) — se dejo asi a proposito, tratando Storage como
   infraestructura generica igual que Auth.
3. **Fase 7 simplificada.** El original divide la generacion de la guia metodologica en 9
   sub-llamadas (`index.ts` lineas 141-223 y 1002-1394) para evitar cortes por limite de
   tokens. Este puerto usa una sola llamada (mismo prompt, mismas instrucciones). Si en
   la practica la guia sale truncada, ese split es el siguiente punto a portar
   (`PmoAgentService`, metodo `runAgent`, fase 7).
4. **Artefactos sin portar.** `supabase/functions/pmo-agent-artefactos/index.ts` (607 lineas)
   no se porto en esta pasada; `ArtefactosController` devuelve `501 Not Implemented` con
   un mensaje explicito. Sigue el mismo patron que `PmoAgentService` para portarlo.
5. **Realtime.** Las pantallas de encuestas (`useIdoneidad`/`useMadurez`/`AppContext`) usaban
   Supabase Realtime + polling de respaldo cada 5-15s. Este backend no implementa un
   equivalente (SSE/WebSocket); el polling del frontend sigue siendo el mecanismo valido si
   se conecta al nuevo endpoint `GET /api/projects/{id}/encuestas/{tipo}/respuestas`.

## Mapa Edge Function -> Spring Boot

| Original (Supabase) | Nuevo |
|---|---|
| `supabase/functions/create-user` | `AdminUserController` / `AdminUserService` (`POST /api/admin/users`) |
| `supabase/functions/pmo-agent` (fases 1-6,7,9) | `PmoAgentController` / `PmoAgentService` (`POST /api/projects/{id}/phases/{n}/run`) |
| `supabase/functions/pmo-agent-artefactos` | `ArtefactosController` — **TODO**, ver arriba |
| `supabase.from('profiles')` (useAdmin.ts) | `AdminUserController` |
| `supabase.from('ai_model_settings')` | `AiModelSettingsController` |
| `supabase.from('banco_preguntas')` | `BancoPreguntaController` |
| `supabase.from('proyectos')`/`fases_estado` (AppContext.tsx) | `ProyectoController` / `ProyectoService` |
| `supabase.from('documentos')` + Storage (useDocumentacion.ts) | `DocumentoController` / `DocumentoService` |
| `supabase.from('entrevistas')` + Storage (useEntrevistas.ts) | `EntrevistaController` / `EntrevistaService` |
| `supabase.from('encuestas_links'/'encuestas_respuestas')` | `EncuestaController` / `EncuestaService` |
| `useEncuestaExterna.ts` (toma publica por token) | `PublicSurveyController` (`/api/public/encuestas/**`, sin auth) |
| `useCancelAgent.ts` | `ProyectoController#cancelAgent` |
