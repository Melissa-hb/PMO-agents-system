package com.pmo.backend.web;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pmo.backend.dto.EncuestaRespuestaDto;
import com.pmo.backend.service.EncuestaService;

@RestController
@RequestMapping("/api/projects/{projectId}/encuestas/{tipoEncuesta}")
public class EncuestaController {

    private final EncuestaService encuestaService;

    public EncuestaController(EncuestaService encuestaService) {
        this.encuestaService = encuestaService;
    }

    @GetMapping("/link")
    public Map<String, String> getActiveLink(@PathVariable UUID projectId, @PathVariable String tipoEncuesta) {
        return java.util.Collections.singletonMap("token", encuestaService.getActiveLinkToken(projectId, tipoEncuesta));
    }

    @PostMapping("/link")
    public Map<String, String> generateLink(@PathVariable UUID projectId, @PathVariable String tipoEncuesta) {
        return java.util.Collections.singletonMap("token", encuestaService.generateLink(projectId, tipoEncuesta));
    }

    @PostMapping("/link/deactivate")
    public void deactivateLink(@PathVariable UUID projectId, @PathVariable String tipoEncuesta) {
        encuestaService.deactivateActiveLinks(projectId, tipoEncuesta);
    }

    @GetMapping("/respuestas")
    public List<EncuestaRespuestaDto> respuestas(@PathVariable UUID projectId, @PathVariable String tipoEncuesta) {
        return encuestaService.listRespuestas(projectId, tipoEncuesta);
    }
}
