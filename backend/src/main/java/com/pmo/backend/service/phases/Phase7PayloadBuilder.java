package com.pmo.backend.service.phases;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
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

    // TreeMap: orden fijo de las guias para que el prefijo del prompt sea identico en cada
    // llamada (Map.of cambia su orden de iteracion entre reinicios de la JVM y romperia la cache).
    private static final Map<String, String> REFERENCE_GUIDE_URLS = new TreeMap<>(Map.of(
            "agile_practice_guide", "https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/Guias_Fase_7/AgilePG_A72.md",
            "pmbok_8", "https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/Guias_Fase_7/PMBOK8_A72.md",
            "scrum_guide", "https://iubexbqhmlerfkjrkoro.supabase.co/storage/v1/object/public/Guias_Fase_7/ScrumGuide_A72.md"
    ));

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

        JsonNode commentsNode = consultantComments != null ? objectMapper.valueToTree(consultantComments) : objectMapper.nullNode();

        // Ajuste parcial: el consultor eligio capitulos concretos. Solo se envian esas secciones, el
        // indice de la guia y el diagnostico de la Fase 6 (sin las guias de referencia ni las fases
        // 4 y 5): la salida pasa de la guia completa a unas pocas secciones.
        Set<String> targets = Phase7Sections.targetSections(ctx.comments());
        ArrayNode currentSections = Phase7Sections.guideContent(Phase7Sections.currentGuide(
                ctx.comments() != null ? ctx.comments().get("current_guide_for_revision") : null));
        if (!targets.isEmpty() && currentSections != null) {
            ArrayNode outline = objectMapper.createArrayNode();
            ArrayNode toRevise = objectMapper.createArrayNode();
            for (JsonNode section : currentSections) {
                String id = section.path("section_id").asText("");
                ObjectNode entry = outline.addObject();
                entry.put("section_id", id);
                entry.set("section_title", section.path("section_title"));
                if (targets.contains(id)) toRevise.add(section);
            }
            if (!toRevise.isEmpty()) {
                metadata.put("revision_mode", "partial");
                metadata.set("target_sections", objectMapper.valueToTree(targets));
                ObjectNode partial = objectMapper.createObjectNode();
                partial.set("project_context", projectContext);
                partial.set("guide_outline", outline);
                partial.set("sections_to_revise", toRevise);
                partial.set("approved_phase6_diagnosis", nullSafe(faseMap.get(6)));
                partial.put("comments", consultantComments);
                return new PhasePayloadResult(metadata, partial, commentsNode, List.of());
            }
        }

        ObjectNode payload = objectMapper.createObjectNode();
        payload.set("project_context", projectContext);
        payload.set("approved_phase4_diagnosis", nullSafe(faseMap.get(4)));
        payload.set("approved_phase5_diagnosis", nullSafe(faseMap.get(5)));
        payload.set("approved_phase6_diagnosis", nullSafe(faseMap.get(6)));
        // El contenido de las guias va como contexto fijo antes del JSON (ver staticContext);
        // en el JSON solo queda la referencia a cada una.
        Map<String, String> guides = loadReferenceGuides();
        ObjectNode guideRefs = objectMapper.createObjectNode();
        guides.forEach((name, markdown) -> {
            ObjectNode ref = guideRefs.putObject(name);
            ref.put("name", name);
            ref.put("url", REFERENCE_GUIDE_URLS.get(name));
            ref.put("format", "markdown");
            ref.put("characters", markdown.length());
            ref.put("content", "Ver la sección GUÍAS DE REFERENCIA (" + name + ") incluida antes del JSON de entrada.");
        });
        payload.set("reference_guides", guideRefs);
        payload.set("business_rules", objectMapper.createObjectNode());
        payload.put("comments", consultantComments);

        return new PhasePayloadResult(metadata, payload, commentsNode, List.of(), referenceGuidesContext(guides));
    }

    private String referenceGuidesContext(Map<String, String> guides) {
        StringBuilder sb = new StringBuilder("GUÍAS DE REFERENCIA (contenido completo de payload.reference_guides):\n");
        guides.forEach((name, markdown) -> sb.append("\n--- INICIO GUÍA: ").append(name).append(" ---\n")
                .append(markdown).append("\n--- FIN GUÍA: ").append(name).append(" ---\n"));
        return sb.toString();
    }

    private Map<String, String> loadReferenceGuides() {
        Map<String, String> guides = new TreeMap<>();
        WebClient client = webClientBuilder.build();
        for (Map.Entry<String, String> entry : REFERENCE_GUIDE_URLS.entrySet()) {
            try {
                String markdown = client.get().uri(entry.getValue()).retrieve().bodyToMono(String.class)
                        .block(Duration.ofSeconds(30));
                markdown = markdown != null ? markdown.replace("\r\n", "\n").trim() : "";
                guides.put(entry.getKey(), markdown);
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
