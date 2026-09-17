package com.pmo.backend.service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.pmo.backend.domain.Documento;
import com.pmo.backend.dto.DocumentoDto;
import com.pmo.backend.repository.DocumentoRepository;

/** Puerto de useDocumentacion.ts (subida a Storage + registro en la tabla documentos). */
@Service
public class DocumentoService {

    private static final Pattern STANDARD_CATEGORY = Pattern.compile("^D(0[1-9]|1[0-1])$");

    private final DocumentoRepository documentoRepository;
    private final StorageService storageService;
    private final ObjectMapper objectMapper;

    public DocumentoService(DocumentoRepository documentoRepository, StorageService storageService, ObjectMapper objectMapper) {
        this.documentoRepository = documentoRepository;
        this.storageService = storageService;
        this.objectMapper = objectMapper;
    }

    public List<DocumentoDto> list(UUID projectId) {
        return documentoRepository.findByProyectoId(projectId).stream().map(this::toDto).toList();
    }

    @Transactional
    public DocumentoDto upload(UUID projectId, MultipartFile file, String category, String customCategory) {
        try {
            String resolvedCategory = "D16".equals(category) ? customCategory : category;
            String safeName = FileNameSanitizer.sanitize(file.getOriginalFilename() != null ? file.getOriginalFilename() : "documento.pdf");
            String storagePath = "proyectos/" + projectId + "/" + System.currentTimeMillis() + "_" + safeName;

            storageService.upload(storagePath, file.getBytes(), file.getContentType());
            String signedUrl = storageService.createSignedUrl(storagePath, 3600);

            ObjectNode metadatos = objectMapper.createObjectNode();
            metadatos.put("size_kb", Math.round(file.getSize() / 1024.0));
            metadatos.put("original_name", file.getOriginalFilename());

            Documento documento = Documento.builder()
                    .proyectoId(projectId)
                    .storagePath(signedUrl != null ? signedUrl : storagePath)
                    .categoria(resolvedCategory)
                    .nombrePersonalizado(file.getOriginalFilename())
                    .metadatos(metadatos)
                    .createdAt(OffsetDateTime.now())
                    .build();

            return toDto(documentoRepository.save(documento));
        } catch (java.io.IOException e) {
            throw new IllegalStateException("Error leyendo el archivo subido: " + e.getMessage(), e);
        }
    }

    @Transactional
    public DocumentoDto updateCategory(UUID documentoId, String category, String customCategory) {
        Documento documento = documentoRepository.findById(documentoId)
                .orElseThrow(() -> new IllegalArgumentException("Documento no encontrado: " + documentoId));
        documento.setCategoria("D16".equals(category) ? customCategory : category);
        return toDto(documentoRepository.save(documento));
    }

    @Transactional
    public void delete(UUID documentoId) {
        Documento documento = documentoRepository.findById(documentoId).orElse(null);
        if (documento == null) return;
        if (documento.getStoragePath() != null) {
            String rawPath = extractRawStoragePath(documento.getStoragePath());
            if (rawPath != null) storageService.remove(List.of(rawPath));
        }
        documentoRepository.deleteById(documentoId);
    }

    private String extractRawStoragePath(String storagePath) {
        java.util.regex.Matcher matcher = Pattern.compile("documentos-pmo/(.+?)(?:\\?token=|$)").matcher(storagePath);
        if (matcher.find()) {
            return java.net.URLDecoder.decode(matcher.group(1), java.nio.charset.StandardCharsets.UTF_8);
        }
        return null;
    }

    private DocumentoDto toDto(Documento d) {
        boolean isStandard = d.getCategoria() != null && STANDARD_CATEGORY.matcher(d.getCategoria()).matches();
        long sizeBytes = 0L;
        if (d.getMetadatos() != null && d.getMetadatos().hasNonNull("size_kb")) {
            sizeBytes = d.getMetadatos().get("size_kb").asLong() * 1024;
        }
        return new DocumentoDto(
                d.getId().toString(),
                d.getNombrePersonalizado() != null ? d.getNombrePersonalizado() : "Documento",
                sizeBytes,
                "application/pdf",
                isStandard ? d.getCategoria() : "D16",
                isStandard ? "" : d.getCategoria(),
                d.getStoragePath()
        );
    }
}
