-- Crea el bucket de Storage que usa el backend (StorageService/SupabaseProperties.storage.bucket)
-- para subir/firmar/borrar documentos de la Fase 1 (useDocumentacion.ts / DocumentoService.java).
-- Los buckets no quedaban versionados en ningun lado: se habian creado a mano en el dashboard
-- del entorno original, por eso una instancia self-hosted nueva (`supabase start` / `db reset`)
-- arranca sin el y la subida de documentos falla con 400 "Bucket not found".
insert into storage.buckets (id, name, public)
values ('documentos-pmo', 'documentos-pmo', false)
on conflict (id) do nothing;
