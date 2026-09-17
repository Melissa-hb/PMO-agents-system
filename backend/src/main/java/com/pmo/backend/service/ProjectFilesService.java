package com.pmo.backend.service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.databind.JsonNode;

import com.pmo.backend.dto.ProjectFileDto;

/**
 * Sube/lista/borra archivos sueltos bajo `proyectos/{projectId}/` en el bucket de Storage, sin
 * tabla propia en Postgres. Puerto de las subidas offline de useIdoneidad.ts (prefijo "f3_") y
 * useMadurez.ts (prefijo "f5_predictiva_" / "f5_agil_"), que en el original llamaban directo a
 * `supabase.storage.from('documentos-pmo')`.
 */
@Service
public class ProjectFilesService {

    private final StorageService storageService;

    public ProjectFilesService(StorageService storageService) {
        this.storageService = storageService;
    }

    public ProjectFileDto upload(UUID projectId, MultipartFile file, String prefix) {
        try {
            String safeName = FileNameSanitizer.sanitize(file.getOriginalFilename());
            String fileName = (prefix != null ? prefix : "") + System.currentTimeMillis() + "_" + safeName;
            String path = "proyectos/" + projectId + "/" + fileName;
            storageService.upload(path, file.getBytes(), file.getContentType());
            String url = storageService.createSignedUrl(path, 3600);
            return new ProjectFileDto(fileName, url);
        } catch (IOException e) {
            throw new IllegalStateException("Error leyendo el archivo: " + e.getMessage(), e);
        }
    }

    public List<ProjectFileDto> list(UUID projectId, String prefix) {
        JsonNode files = storageService.list("proyectos/" + projectId);
        List<ProjectFileDto> result = new ArrayList<>();
        if (files == null || !files.isArray()) return result;
        for (JsonNode file : files) {
            String name = file.path("name").asText("");
            if (prefix != null && !prefix.isBlank() && !name.startsWith(prefix)) continue;
            String url = storageService.createSignedUrl("proyectos/" + projectId + "/" + name, 3600);
            result.add(new ProjectFileDto(name, url));
        }
        return result;
    }

    public void delete(UUID projectId, String fileName) {
        storageService.remove(List.of("proyectos/" + projectId + "/" + fileName));
    }
}
