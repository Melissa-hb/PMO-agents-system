package com.pmo.backend.web;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.pmo.backend.dto.DocumentoDto;
import com.pmo.backend.service.DocumentoService;

@RestController
@RequestMapping("/api/projects/{projectId}/documentos")
public class DocumentoController {

    private final DocumentoService documentoService;

    public DocumentoController(DocumentoService documentoService) {
        this.documentoService = documentoService;
    }

    @GetMapping
    public List<DocumentoDto> list(@PathVariable UUID projectId) {
        return documentoService.list(projectId);
    }

    @PostMapping
    public DocumentoDto upload(
            @PathVariable UUID projectId,
            @RequestParam("file") MultipartFile file,
            @RequestParam("category") String category,
            @RequestParam(value = "customCategory", required = false, defaultValue = "") String customCategory
    ) {
        return documentoService.upload(projectId, file, category, customCategory);
    }

    public record UpdateCategoryRequest(String category, String customCategory) {
    }

    @PutMapping("/{documentoId}")
    public DocumentoDto updateCategory(@PathVariable UUID projectId, @PathVariable UUID documentoId,
                                        @RequestBody UpdateCategoryRequest request) {
        return documentoService.updateCategory(documentoId, request.category(), request.customCategory());
    }

    @DeleteMapping("/{documentoId}")
    public void delete(@PathVariable UUID projectId, @PathVariable UUID documentoId) {
        documentoService.delete(documentoId);
    }
}
