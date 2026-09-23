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

        // El cruce es intencional: el prompt del Asistente 4 numera las fuentes distinto que la app.
        // phase1_diagnosis = encuesta de idoneidad (fase 3 de la app), phase2_diagnosis = entrevistas
        // (fase 2) y phase3_diagnosis = diagnostico documental (fase 1). Ver la "Nota sobre las
        // fuentes" en configuracion_agentes.prompt_sistema (fase_numero = 4).
        ObjectNode payload = objectMapper.createObjectNode();
        // Solo se envian los campos que declara el esquema de entrada del prompt del Asistente 4
        // (el resto de cada diagnostico, ~85 % del tamaño, no lo usa y solo sumaba tokens).
        payload.set("phase1_diagnosis", pick(faseMap.get(3),
                "suitability_score", "suitability_level", "summary", "observations", "insumos_para_agente_4"));
        payload.set("phase2_diagnosis", pick(faseMap.get(2),
                "summary", "key_findings", "insumos_para_agente_4"));
        payload.set("phase3_diagnosis", pick(faseMap.get(1),
                "summary", "key_insights", "missing_documents", "insumos_para_agente_4"));

        return new PhasePayloadResult(metadata, payload, ctx.comments(), List.of());
    }

    private JsonNode pick(JsonNode diagnosis, String... fields) {
        if (diagnosis == null || !diagnosis.isObject()) return objectMapper.nullNode();
        ObjectNode compact = objectMapper.createObjectNode();
        for (String field : fields) {
            if (diagnosis.has(field)) compact.set(field, diagnosis.get(field));
        }
        return compact;
    }
}
