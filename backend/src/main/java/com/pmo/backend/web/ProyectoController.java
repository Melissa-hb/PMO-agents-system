package com.pmo.backend.web;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;

import com.pmo.backend.dto.CreateProjectRequest;
import com.pmo.backend.dto.EditProjectRequest;
import com.pmo.backend.dto.PhaseStateDto;
import com.pmo.backend.dto.ProjectDto;
import com.pmo.backend.security.CurrentUser;
import com.pmo.backend.service.ProyectoService;

@RestController
@RequestMapping("/api/projects")
public class ProyectoController {

    private final ProyectoService proyectoService;
    private final CurrentUser currentUser;

    public ProyectoController(ProyectoService proyectoService, CurrentUser currentUser) {
        this.proyectoService = proyectoService;
        this.currentUser = currentUser;
    }

    @GetMapping
    public List<ProjectDto> list() {
        return proyectoService.listProjects();
    }

    @PostMapping
    public ProjectDto create(@RequestBody CreateProjectRequest request) {
        return proyectoService.addProject(request, currentUser.id());
    }

    @PutMapping("/{id}")
    public ProjectDto edit(@PathVariable UUID id, @RequestBody EditProjectRequest request) {
        return proyectoService.editProject(id, request);
    }

    @PostMapping("/{id}/trash")
    public void moveToTrash(@PathVariable UUID id) {
        proyectoService.moveToTrash(id);
    }

    @PostMapping("/{id}/restore")
    public void restore(@PathVariable UUID id) {
        proyectoService.restoreProject(id);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) {
        proyectoService.deleteProject(id);
    }

    public record PhaseStatusRequest(String status) {
    }

    @PatchMapping("/{id}/phases/{phaseNumber}/status")
    public void updatePhaseStatus(@PathVariable UUID id, @PathVariable int phaseNumber, @RequestBody PhaseStatusRequest request) {
        proyectoService.updatePhaseStatus(id, phaseNumber, request.status());
    }

    @PostMapping("/{id}/phases/{phaseNumber}/reprocess")
    public void reprocessPhase(@PathVariable UUID id, @PathVariable int phaseNumber) {
        proyectoService.reprocessPhase(id, phaseNumber);
    }

    /** Cancela un agente en ejecucion: revierte 'procesando' a 'disponible' (useCancelAgent.ts). */
    @PostMapping("/{id}/phases/{phaseNumber}/cancel")
    public void cancelAgent(@PathVariable UUID id, @PathVariable int phaseNumber) {
        proyectoService.updatePhaseStatus(id, phaseNumber, "disponible");
    }

    // ── Acceso "crudo" a fases_estado, para componentes que hacian polling/escritura directa ──

    @GetMapping("/{id}/phases/{phaseNumber}/state")
    public PhaseStateDto getPhaseState(@PathVariable UUID id, @PathVariable int phaseNumber) {
        return PhaseStateDto.from(proyectoService.getPhaseStateRaw(id, phaseNumber));
    }

    @PutMapping("/{id}/phases/{phaseNumber}/state")
    public PhaseStateDto updatePhaseState(@PathVariable UUID id, @PathVariable int phaseNumber, @RequestBody JsonNode body) {
        boolean hasEstado = body.has("estadoVisual");
        boolean hasDatos = body.has("datosConsolidados");
        String estadoVisual = hasEstado ? body.get("estadoVisual").asText(null) : null;
        JsonNode datos = hasDatos ? body.get("datosConsolidados") : null;
        return PhaseStateDto.from(proyectoService.updatePhaseStateRaw(id, phaseNumber, hasEstado, estadoVisual, hasDatos, datos));
    }

    @PutMapping("/{id}/phases-after/{phaseNumber}/state")
    public void updatePhasesAfterState(@PathVariable UUID id, @PathVariable int phaseNumber, @RequestBody JsonNode body) {
        String estadoVisual = body.has("estadoVisual") ? body.get("estadoVisual").asText(null) : null;
        JsonNode datos = body.has("datosConsolidados") ? body.get("datosConsolidados") : null;
        proyectoService.updatePhasesAfterRaw(id, phaseNumber, estadoVisual, datos);
    }
}
