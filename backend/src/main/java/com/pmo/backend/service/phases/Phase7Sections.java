package com.pmo.backend.service.phases;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Utilidades del ajuste parcial de la Fase 7: leer las secciones solicitadas de la guia actual
 * y fusionar en ella las secciones revisadas por la IA. Las secciones se identifican por
 * {@code section_id} dentro de {@code guide_content} (que puede estar en la raiz del resultado o
 * dentro de {@code diagnosis}; se actualizan ambas copias).
 */
public final class Phase7Sections {

    private Phase7Sections() {
    }

    /** section_id pedidos en comments.target_sections (vacio = regeneracion completa). */
    public static Set<String> targetSections(JsonNode comments) {
        Set<String> ids = new LinkedHashSet<>();
        JsonNode targets = comments != null && comments.isObject() ? comments.get("target_sections") : null;
        if (targets != null && targets.isArray()) {
            targets.forEach(t -> {
                if (t.isTextual() && !t.asText().isBlank()) ids.add(t.asText().trim());
            });
        }
        return ids;
    }

    /** Guia vigente (_current) a partir del wrapper versionado guardado en fases_estado. */
    public static JsonNode currentGuide(JsonNode storedWrapper) {
        return storedWrapper != null && storedWrapper.hasNonNull("_current") ? storedWrapper.get("_current") : null;
    }

    public static ArrayNode guideContent(JsonNode guide) {
        if (guide == null) return null;
        if (guide.path("guide_content").isArray()) return (ArrayNode) guide.get("guide_content");
        if (guide.path("diagnosis").path("guide_content").isArray()) return (ArrayNode) guide.get("diagnosis").get("guide_content");
        return null;
    }

    /**
     * Devuelve una copia de {@code current} con las secciones de {@code revised} (solo las que
     * esten en {@code targets}) reemplazadas por section_id, o null si la IA no devolvio ninguna.
     */
    public static ObjectNode merge(JsonNode current, JsonNode revised, Set<String> targets) {
        ArrayNode revisedSections = guideContent(revised);
        if (current == null || !current.isObject() || revisedSections == null) return null;

        Map<String, JsonNode> byId = new LinkedHashMap<>();
        for (JsonNode section : revisedSections) {
            String id = section.path("section_id").asText("");
            if (targets.contains(id)) byId.put(id, section);
        }
        if (byId.isEmpty()) return null;

        ObjectNode merged = ((ObjectNode) current).deepCopy();
        replaceSections(merged.get("guide_content"), byId);
        replaceSections(merged.path("diagnosis").get("guide_content"), byId);
        return merged;
    }

    private static void replaceSections(JsonNode array, Map<String, JsonNode> byId) {
        if (array == null || !array.isArray()) return;
        ArrayNode sections = (ArrayNode) array;
        for (int i = 0; i < sections.size(); i++) {
            JsonNode replacement = byId.get(sections.get(i).path("section_id").asText(""));
            if (replacement != null) sections.set(i, replacement.deepCopy());
        }
    }
}
