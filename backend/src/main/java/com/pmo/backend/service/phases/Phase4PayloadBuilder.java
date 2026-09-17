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

/** Puerto de phases/phase4.ts (Asistente 4 - Clasificacion PMO). */
@Component
public class Phase4PayloadBuilder implements PhasePayloadBuilder {

    private final FaseEstadoRepository faseEstadoRepository;
    private final ObjectMapper objectMapper;

    public Phase4PayloadBuilder(FaseEstadoRepository faseEstadoRepository, ObjectMapper objectMapper) {
        this.faseEstadoRepository = faseEstadoRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public int phaseNumber() {
        return 4;
    }

    @Override
    public PhasePayloadResult build(PhasePayloadContext ctx) {
        List<FaseEstado> prevFases = faseEstadoRepository.findByProyectoIdAndNumeroFaseIn(ctx.projectId(), List.of(1, 2, 3));
        Map<Integer, JsonNode> faseMap = prevFases.stream()
                .collect(Collectors.toMap(f -> f.getNumeroFase(), f -> PhaseJsonUtils.usableDiagnosis(f.getDatosConsolidados())));

        ObjectNode metadata = ctx.baseMetadata().deepCopy();
        metadata.put("agent_id", "asistente-4");

        ObjectNode payload = objectMapper.createObjectNode();
        payload.set("phase1_diagnosis", nullSafe(faseMap.get(3)));
        payload.set("phase2_diagnosis", nullSafe(faseMap.get(2)));
        payload.set("phase3_diagnosis", nullSafe(faseMap.get(1)));

        return new PhasePayloadResult(metadata, payload, ctx.comments(), List.of());
    }

    private JsonNode nullSafe(JsonNode value) {
        return value != null ? value : objectMapper.nullNode();
    }
}
