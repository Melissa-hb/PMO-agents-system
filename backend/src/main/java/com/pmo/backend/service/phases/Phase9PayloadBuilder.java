package com.pmo.backend.service.phases;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.pmo.backend.domain.Documento;
import com.pmo.backend.domain.FaseEstado;
import com.pmo.backend.repository.DocumentoRepository;
import com.pmo.backend.repository.FaseEstadoRepository;

/** Puerto de phases/phase9.ts (Agente 3.1, se dispara automaticamente al completar la fase 1). */
@Component
public class Phase9PayloadBuilder implements PhasePayloadBuilder {

    private final FaseEstadoRepository faseEstadoRepository;
    private final DocumentoRepository documentoRepository;
    private final PhasePayloadSupport support;
    private final ObjectMapper objectMapper;

    public Phase9PayloadBuilder(FaseEstadoRepository faseEstadoRepository, DocumentoRepository documentoRepository,
                                 PhasePayloadSupport support, ObjectMapper objectMapper) {
        this.faseEstadoRepository = faseEstadoRepository;
        this.documentoRepository = documentoRepository;
        this.support = support;
        this.objectMapper = objectMapper;
    }

    @Override
    public int phaseNumber() {
        return 9;
    }

    @Override
    public PhasePayloadResult build(PhasePayloadContext ctx) {
        JsonNode fase1Datos = faseEstadoRepository.findByProyectoIdAndNumeroFase(ctx.projectId(), 1)
                .map(FaseEstado::getDatosConsolidados).orElse(null);
        JsonNode agent3Diagnosis = fase1Datos != null && fase1Datos.hasNonNull("diagnosis") ? fase1Datos.get("diagnosis")
                : fase1Datos != null ? fase1Datos : objectMapper.nullNode();

        List<Documento> docs = documentoRepository.findByProyectoId(ctx.projectId());
        List<FileRef> fileUrls = new ArrayList<>();
        for (Documento d : docs) {
            if (d.getStoragePath() != null && !d.getStoragePath().isBlank()) {
                String freshUrl = support.ensureFreshUrl(d.getStoragePath());
                fileUrls.add(new FileRef(freshUrl, PhasePayloadSupport.fileTypeFromPath(d.getStoragePath()), null));
            }
        }

        ObjectNode metadata = ctx.baseMetadata().deepCopy();
        metadata.put("phase", "3.1");
        metadata.put("agent_id", "agente-3-1");

        ObjectNode payload = objectMapper.createObjectNode();
        payload.set("agent3_diagnosis", agent3Diagnosis);

        return new PhasePayloadResult(metadata, payload, ctx.comments(), fileUrls);
    }
}
