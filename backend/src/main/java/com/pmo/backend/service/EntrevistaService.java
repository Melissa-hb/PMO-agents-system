package com.pmo.backend.service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.pmo.backend.domain.Entrevista;
import com.pmo.backend.dto.EntrevistaDto;
import com.pmo.backend.repository.EntrevistaRepository;

/** Puerto de useEntrevistas.ts (tabla entrevistas + adjuntos en Storage). */
@Service
public class EntrevistaService {

    private static final Pattern STORAGE_PATH_PATTERN = Pattern.compile("documentos-pmo/(.+?)(?:\\?token=|$)");

    private final EntrevistaRepository repository;
    private final StorageService storageService;

    public EntrevistaService(EntrevistaRepository repository, StorageService storageService) {
        this.repository = repository;
        this.storageService = storageService;
    }

    public List<EntrevistaDto> list(UUID projectId) {
        return repository.findByProyectoIdOrderByCreatedAtAsc(projectId).stream().map(this::toDto).toList();
    }

    @Transactional
    public EntrevistaDto save(UUID projectId, UUID entrevistaId, String nombre, String cargo, String area,
                               String notas, MultipartFile file, boolean removeFile) {
        Entrevista entrevista = entrevistaId != null
                ? repository.findById(entrevistaId).orElseThrow(() -> new IllegalArgumentException("Entrevista no encontrada: " + entrevistaId))
                : Entrevista.builder().proyectoId(projectId).createdAt(OffsetDateTime.now()).build();

        entrevista.setNombre(nombre);
        entrevista.setCargo(cargo);
        entrevista.setArea(area);
        entrevista.setNotas(notas);

        if (removeFile) {
            removeExistingFile(entrevista.getStoragePath());
            entrevista.setStoragePath(null);
            entrevista.setFileName(null);
        } else if (file != null && !file.isEmpty()) {
            removeExistingFile(entrevista.getStoragePath());
            try {
                String safeName = FileNameSanitizer.sanitize(file.getOriginalFilename());
                String path = "entrevistas/" + projectId + "/" + System.currentTimeMillis() + "_" + safeName;
                storageService.upload(path, file.getBytes(), file.getContentType());
                String signedUrl = storageService.createSignedUrl(path, 3600);
                entrevista.setStoragePath(signedUrl != null ? signedUrl : path);
                entrevista.setFileName(file.getOriginalFilename());
            } catch (java.io.IOException e) {
                throw new IllegalStateException("Error leyendo el archivo de la entrevista: " + e.getMessage(), e);
            }
        }

        return toDto(repository.save(entrevista));
    }

    @Transactional
    public void delete(UUID entrevistaId) {
        Entrevista entrevista = repository.findById(entrevistaId).orElse(null);
        if (entrevista == null) return;
        removeExistingFile(entrevista.getStoragePath());
        repository.deleteById(entrevistaId);
    }

    private void removeExistingFile(String storagePath) {
        if (storagePath == null) return;
        Matcher matcher = STORAGE_PATH_PATTERN.matcher(storagePath);
        if (matcher.find()) {
            String rawPath = java.net.URLDecoder.decode(matcher.group(1), java.nio.charset.StandardCharsets.UTF_8);
            storageService.remove(List.of(rawPath));
        }
    }

    private EntrevistaDto toDto(Entrevista e) {
        return new EntrevistaDto(
                e.getId().toString(), e.getNombre(), e.getCargo(), e.getArea() != null ? e.getArea() : "",
                e.getNotas() != null ? e.getNotas() : "", e.getFileName(), e.getStoragePath(),
                e.getCreatedAt() != null ? e.getCreatedAt().toString() : null
        );
    }
}
