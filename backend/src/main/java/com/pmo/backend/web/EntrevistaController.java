package com.pmo.backend.web;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.pmo.backend.dto.EntrevistaDto;
import com.pmo.backend.service.EntrevistaService;

@RestController
@RequestMapping("/api/projects/{projectId}/entrevistas")
public class EntrevistaController {

    private final EntrevistaService entrevistaService;

    public EntrevistaController(EntrevistaService entrevistaService) {
        this.entrevistaService = entrevistaService;
    }

    @GetMapping
    public List<EntrevistaDto> list(@PathVariable UUID projectId) {
        return entrevistaService.list(projectId);
    }

    @PostMapping
    public EntrevistaDto create(
            @PathVariable UUID projectId,
            @RequestParam String nombre,
            @RequestParam String cargo,
            @RequestParam(required = false, defaultValue = "") String area,
            @RequestParam(required = false, defaultValue = "") String notas,
            @RequestParam(value = "file", required = false) MultipartFile file
    ) {
        return entrevistaService.save(projectId, null, nombre, cargo, area, notas, file, false);
    }

    @PutMapping("/{entrevistaId}")
    public EntrevistaDto update(
            @PathVariable UUID projectId,
            @PathVariable UUID entrevistaId,
            @RequestParam String nombre,
            @RequestParam String cargo,
            @RequestParam(required = false, defaultValue = "") String area,
            @RequestParam(required = false, defaultValue = "") String notas,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "removeFile", required = false, defaultValue = "false") boolean removeFile
    ) {
        return entrevistaService.save(projectId, entrevistaId, nombre, cargo, area, notas, file, removeFile);
    }

    @DeleteMapping("/{entrevistaId}")
    public void delete(@PathVariable UUID projectId, @PathVariable UUID entrevistaId) {
        entrevistaService.delete(entrevistaId);
    }
}
