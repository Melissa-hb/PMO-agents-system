package com.pmo.backend.web;

import java.util.Map;
import java.util.UUID;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;

import com.pmo.backend.service.ArtefactosService;

/** Puerto de la Edge Function `pmo-agent-artefactos` (fase_numero=8). */
@RestController
@RequestMapping("/api/projects/{projectId}/artefactos")
public class ArtefactosController {

    private final ArtefactosService artefactosService;

    public ArtefactosController(ArtefactosService artefactosService) {
        this.artefactosService = artefactosService;
    }

    @PostMapping("/consolidar")
    public Map<String, Object> consolidar(@PathVariable UUID projectId) {
        JsonNode data = artefactosService.consolidar(projectId);
        return Map.of("success", true, "data", data);
    }
}
