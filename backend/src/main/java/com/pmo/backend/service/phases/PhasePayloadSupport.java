package com.pmo.backend.service.phases;

import java.util.UUID;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.pmo.backend.domain.Proyecto;
import com.pmo.backend.repository.ProyectoRepository;
import com.pmo.backend.service.StorageService;

@Component
public class PhasePayloadSupport {

    private final ProyectoRepository proyectoRepository;
    private final StorageService storageService;
    private final ObjectMapper objectMapper;

    public PhasePayloadSupport(ProyectoRepository proyectoRepository, StorageService storageService, ObjectMapper objectMapper) {
        this.proyectoRepository = proyectoRepository;
        this.storageService = storageService;
        this.objectMapper = objectMapper;
    }

    public static String fileTypeFromPath(String path) {
        if (path == null) return "application/pdf";
        String withoutQuery = path.split("\\?")[0];
        String ext = withoutQuery.contains(".") ? withoutQuery.substring(withoutQuery.lastIndexOf('.') + 1).toLowerCase() : "";
        return "csv".equals(ext) ? "text/csv" : "application/pdf";
    }

    public String ensureFreshUrl(String url) {
        return storageService.ensureFreshUrl(url);
    }

    public ObjectNode organizationContext(UUID projectId) {
        ObjectNode node = objectMapper.createObjectNode();
        Proyecto proyecto = proyectoRepository.findById(projectId).orElse(null);
        if (proyecto == null) {
            node.putNull("company_name");
            node.putNull("project_name");
            node.putNull("size");
            node.putNull("mission");
            node.putNull("vision");
            return node;
        }
        node.put("company_name", proyecto.getEmpresa() != null ? proyecto.getEmpresa().getNombre() : null);
        node.put("project_name", proyecto.getNombreProyecto());
        node.put("size", proyecto.getTamano());
        node.put("mission", proyecto.getMision());
        node.put("vision", proyecto.getVision());
        return node;
    }
}
