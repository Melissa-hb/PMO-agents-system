package com.pmo.backend.service.phases;

import java.util.List;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.pmo.backend.domain.FaseEstado;
import com.pmo.backend.repository.FaseEstadoRepository;

/**
 * Puerto de phases/phase9.ts (Agente 3.1, se dispara automaticamente al completar la fase 1).
 * Solo envia el diagnostico documental de la fase 1: su prompt trabaja exclusivamente sobre
 * agent3_diagnosis, asi que reenviar los PDF (que la fase 1 ya proceso) duplicaba el costo en tokens.
 */
@Component
public class Phase9PayloadBuilder implements PhasePayloadBuilder {

    private final FaseEstadoRepository faseEstadoRepository;
    private final ObjectMapper objectMapper;

    public Phase9PayloadBuilder(FaseEstadoRepository faseEstadoRepository, ObjectMapper objectMapper) {
        this.faseEstadoRepository = faseEstadoRepository;
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

        ObjectNode metadata = ctx.baseMetadata().deepCopy();
        metadata.put("phase", "3.1");
        metadata.put("agent_id", "agente-3-1");

        ObjectNode payload = objectMapper.createObjectNode();
        payload.set("agent3_diagnosis", agent3Diagnosis);

        return new PhasePayloadResult(metadata, payload, ctx.comments(), List.of());
    }
}
