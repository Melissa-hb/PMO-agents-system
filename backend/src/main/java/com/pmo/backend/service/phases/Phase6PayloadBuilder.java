package com.pmo.backend.service.phases;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.pmo.backend.domain.FaseEstado;
import com.pmo.backend.repository.FaseEstadoRepository;

/** Puerto de phases/phase6.ts (Agente 6 - Diseno de la guia). */
@Component
public class Phase6PayloadBuilder implements PhasePayloadBuilder {

    private final FaseEstadoRepository faseEstadoRepository;
    private final ObjectMapper objectMapper;

    public Phase6PayloadBuilder(FaseEstadoRepository faseEstadoRepository, ObjectMapper objectMapper) {
        this.faseEstadoRepository = faseEstadoRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public int phaseNumber() {
        return 6;
    }

    @Override
    public PhasePayloadResult build(PhasePayloadContext ctx) {
        List<FaseEstado> prevFases = faseEstadoRepository.findByProyectoIdAndNumeroFaseIn(ctx.projectId(), List.of(4, 5));
        Map<Integer, JsonNode> faseMap = prevFases.stream()
                .collect(Collectors.toMap(f -> f.getNumeroFase(), f -> PhaseJsonUtils.unwrapPhaseOutput(f.getDatosConsolidados())));

        ObjectNode metadata = ctx.baseMetadata().deepCopy();
        metadata.put("agent_id", "agente-6");

        ObjectNode payload = objectMapper.createObjectNode();
        payload.set("approved_phase4_diagnosis", nullSafe(faseMap.get(4)));
        payload.set("approved_phase5_diagnosis", nullSafe(faseMap.get(5)));

        return new PhasePayloadResult(metadata, payload, ctx.comments(), List.of());
    }

    private JsonNode nullSafe(JsonNode value) {
        return value != null ? value : objectMapper.nullNode();
    }
}
