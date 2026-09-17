package com.pmo.backend.service.phases;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.pmo.backend.domain.FaseEstado;
import com.pmo.backend.domain.Proyecto;
import com.pmo.backend.repository.FaseEstadoRepository;
import com.pmo.backend.repository.ProyectoRepository;

/**
 * Puerto de phases/phase7.ts (Asistente fundamentos de guia). Nota: esta implementacion usa
 * el flujo generico de una sola llamada a la IA (ver PmoAgentService), NO el flujo dividido en
 * 9 sub-partes (7.1A..7.2F) del index.ts original (lineas 1002-1394). Esa version dividida existia
 * para evitar cortes por limite de tokens en guias muy largas; si en produccion la guia sale
 * truncada, ese es el siguiente punto a portar.
 */
@Component
public class Phase7PayloadBuilder implements PhasePayloadBuilder {

    private static final Map<String, String> REFERENCE_GUIDE_URLS = Map.of(
            "agile_practice_guide", "https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/Guias_Fase_7/AgilePG_A72.md",
            "pmbok_8", "https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/Guias_Fase_7/PMBOK8_A72.md",
            "scrum_guide", "https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/Guias_Fase_7/ScrumGuide_A72.md"
    );

    private final ProyectoRepository proyectoRepository;
    private final FaseEstadoRepository faseEstadoRepository;
    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    public Phase7PayloadBuilder(ProyectoRepository proyectoRepository, FaseEstadoRepository faseEstadoRepository,
                                 WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.proyectoRepository = proyectoRepository;
        this.faseEstadoRepository = faseEstadoRepository;
        this.webClientBuilder = webClientBuilder;
        this.objectMapper = objectMapper;
    }

    @Override
    public int phaseNumber() {
        return 7;
    }

    @Override
    public PhasePayloadResult build(PhasePayloadContext ctx) {
        Proyecto proyecto = proyectoRepository.findById(ctx.projectId()).orElse(null);

        List<FaseEstado> prevFases = faseEstadoRepository.findByProyectoIdAndNumeroFaseIn(ctx.projectId(), List.of(4, 5, 6));
        Map<Integer, JsonNode> faseMap = prevFases.stream()
                .collect(Collectors.toMap(f -> f.getNumeroFase(), f -> PhaseJsonUtils.unwrapPhaseOutput(f.getDatosConsolidados())));

        String consultantComments = normalizeConsultantComments(ctx.comments());

        ObjectNode metadata = ctx.baseMetadata().deepCopy();
        metadata.put("agent_id", "asistente-fundamentos-guia");

        ObjectNode projectContext = objectMapper.createObjectNode();
        projectContext.put("project_id", ctx.projectId().toString());
        projectContext.put("project_name", proyecto != null ? proyecto.getNombreProyecto() : null);
        projectContext.put("company_name", proyecto != null && proyecto.getEmpresa() != null ? proyecto.getEmpresa().getNombre() : null);
        projectContext.put("start_date", proyecto != null && proyecto.getFechaInicio() != null ? proyecto.getFechaInicio().toString() : null);

        ObjectNode payload = objectMapper.createObjectNode();
        payload.set("project_context", projectContext);
        payload.set("approved_phase4_diagnosis", nullSafe(faseMap.get(4)));
        payload.set("approved_phase5_diagnosis", nullSafe(faseMap.get(5)));
        payload.set("approved_phase6_diagnosis", nullSafe(faseMap.get(6)));
        payload.set("reference_guides", loadReferenceGuides());
        payload.set("business_rules", objectMapper.createObjectNode());
        payload.put("comments", consultantComments);

        JsonNode commentsNode = consultantComments != null ? objectMapper.valueToTree(consultantComments) : objectMapper.nullNode();
        return new PhasePayloadResult(metadata, payload, commentsNode, List.of());
    }

    private ObjectNode loadReferenceGuides() {
        ObjectNode guides = objectMapper.createObjectNode();
        WebClient client = webClientBuilder.build();
        for (Map.Entry<String, String> entry : REFERENCE_GUIDE_URLS.entrySet()) {
            try {
                String markdown = client.get().uri(entry.getValue()).retrieve().bodyToMono(String.class)
                        .block(Duration.ofSeconds(30));
                markdown = markdown != null ? markdown.replace("\r\n", "\n").trim() : "";
                ObjectNode guide = objectMapper.createObjectNode();
                guide.put("name", entry.getKey());
                guide.put("url", entry.getValue());
                guide.put("format", "markdown");
                guide.put("characters", markdown.length());
                guide.put("content", markdown);
                guides.set(entry.getKey(), guide);
            } catch (Exception e) {
                throw new IllegalStateException("No se pudo cargar la guia de referencia " + entry.getKey() + ": " + e.getMessage(), e);
            }
        }
        return guides;
    }

    private String normalizeConsultantComments(JsonNode comments) {
        if (comments == null || comments.isNull()) return null;
        if (comments.isTextual() && !comments.asText().isBlank()) return comments.asText().trim();
        if (comments.isObject()) {
            for (String field : new String[]{"comentario_consultor", "comments", "comment"}) {
                JsonNode v = comments.get(field);
                if (v != null && v.isTextual() && !v.asText().isBlank()) return v.asText().trim();
            }
        }
        return null;
    }

    private JsonNode nullSafe(JsonNode value) {
        return value != null ? value : objectMapper.nullNode();
    }
}
