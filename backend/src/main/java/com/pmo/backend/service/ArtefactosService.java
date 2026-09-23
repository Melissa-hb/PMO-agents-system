package com.pmo.backend.service;

import java.text.Normalizer;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.pmo.backend.domain.ConfiguracionAgente;
import com.pmo.backend.domain.FaseEstado;
import com.pmo.backend.repository.ConfiguracionAgenteRepository;
import com.pmo.backend.repository.FaseEstadoRepository;
import com.pmo.backend.service.ai.AiFallbackService;
import com.pmo.backend.service.ai.AiGenerateResult;
import com.pmo.backend.service.ai.AiModelSettingsService;
import com.pmo.backend.service.ai.AiPart;
import com.pmo.backend.service.ai.GenerationConfig;
import com.pmo.backend.service.ai.NormalizedAiModelSettings;
import com.pmo.backend.service.ai.TokenUsageRecorder;

/**
 * Puerto Java de la Edge Function `pmo-agent-artefactos` (fase_numero=8, "Artefactos
 * (recomendados)"). A diferencia del resto de fases, esta no usa el envelope JSON generico de
 * PmoAgentService: el prompt de configuracion_agentes trae un placeholder literal
 * "${fase7Content}" que se sustituye por el contenido en texto plano de la Fase 7, y la IA
 * responde solo {artefactos_recomendados, otros_artefactos} (sin metadata/diagnosis).
 */
@Service
public class ArtefactosService {

    private static final int FASE_ORIGEN = 7;
    private static final int FASE_ARTEFACTOS = 8;

    /** Tope del extracto de la Fase 7 que se envia a la IA (~3K tokens en lugar de 40-100K). */
    private static final int MAX_EXTRACT_CHARS = 12_000;
    private static final int MAX_SNIPPETS_PER_ARTIFACT = 2;
    private static final int MAX_SNIPPET_CHARS = 280;

    private static final List<String> ACTIVE_ARTEFACTOS_MAESTROS = List.of(
            "Abastecimiento",
            "Acta de constitucion",
            "Acta de reunion",
            "Caso de negocio",
            "Control de entregables",
            "Cronograma",
            "Declaracion de alcance",
            "Enunciado del alcance",
            "Informe de avance",
            "Lecciones aprendidas",
            "Matriz de interesados",
            "Matriz de requisitos",
            "Plan de direccion de proyectos",
            "Presupuesto general",
            "Presupuesto por hito",
            "Registro de cambios",
            "Registro de incidencias",
            "Registro de riesgos"
    );

    private static final List<String> ACTIVE_ARTEFACTOS_BASE_RECOMENDADOS = List.of(
            "Acta de constitucion",
            "Caso de negocio",
            "Cronograma",
            "Enunciado del alcance",
            "Informe de avance",
            "Matriz de interesados",
            "Plan de direccion de proyectos",
            "Presupuesto general",
            "Registro de riesgos"
    );

    private static final Map<String, List<String>> ACTIVE_ARTIFACT_ALIASES = buildAliases();

    private static Map<String, List<String>> buildAliases() {
        Map<String, List<String>> aliases = new LinkedHashMap<>();
        aliases.put("Acta de constitucion", List.of("acta de constitucion", "acta de constitución del proyecto", "project charter", "charter", "documento de inicio"));
        aliases.put("Acta de reunion", List.of("acta de reunion", "acta de reunión", "minuta", "meeting minutes"));
        aliases.put("Declaracion de alcance", List.of("declaracion de alcance", "declaración de alcance", "declaracion del alcance", "scope statement"));
        aliases.put("Enunciado del alcance", List.of("enunciado de alcance", "enunciado del alcance", "scope statement", "gestion del alcance"));
        aliases.put("Registro de riesgos", List.of("matriz de riesgos", "registro de riesgos", "risk register", "gestion de riesgos", "analisis de riesgos"));
        aliases.put("Presupuesto general", List.of("formato de presupuesto", "presupuesto", "budget", "control de costos", "linea base de costos"));
        aliases.put("Presupuesto por hito", List.of("presupuesto por hito", "presupuesto por hitos", "costos por hito"));
        aliases.put("Matriz de interesados", List.of("matriz de stakeholders", "registro de interesados", "stakeholder register", "gestion de interesados"));
        aliases.put("Informe de avance", List.of("informe de avance e indicadores", "informe de avance", "informe de estado", "status report", "indicadores", "kpi", "metricas", "dashboard"));
        aliases.put("Registro de incidencias", List.of("formato de incidencias", "registro de incidencias", "issue log", "gestion de incidencias", "problemas", "impedimentos"));
        aliases.put("Control de entregables", List.of("formato de entregables y validacion", "validacion de entregables", "aceptacion de entregables", "control de entregables", "criterios de aceptacion"));
        aliases.put("Lecciones aprendidas", List.of("matriz de lecciones aprendidas", "lecciones aprendidas", "lessons learned", "retrospectiva", "mejora continua"));
        aliases.put("Registro de cambios", List.of("registro de cambios", "control de cambios", "solicitudes de cambio", "change log"));
        aliases.put("Matriz de requisitos", List.of("matriz de requisitos", "requirements matrix", "requisitos", "trazabilidad de requisitos"));
        aliases.put("Plan de direccion de proyectos", List.of("plan de direccion de proyectos", "plan de dirección de proyectos", "project management plan", "plan para la direccion"));
        return Map.copyOf(aliases);
    }

    private static final String DEFAULT_PROMPT_TEMPLATE = buildDefaultPromptTemplate();

    private static String buildDefaultPromptTemplate() {
        StringBuilder lista = new StringBuilder();
        for (int i = 0; i < ACTIVE_ARTEFACTOS_MAESTROS.size(); i++) {
            lista.append(i + 1).append(". ").append(ACTIVE_ARTEFACTOS_MAESTROS.get(i)).append("\n");
        }
        return "Eres un experto en gestión de proyectos y oficinas de proyectos (PMO).\n"
                + "Se te proporciona el documento aprobado de la Fase 7 (Guía Metodológica) de un proyecto de implementación de PMO.\n\n"
                + "Tu tarea es analizar ese documento y, tomando como base la siguiente lista EXACTA de artefactos disponibles, clasificarlos en dos categorías:\n\n"
                + "1. artefactos_recomendados: Los artefactos de la lista maestra que el documento de la Fase 7 sugiere, menciona, requiere o que claramente se alinean con la metodología descrita.\n"
                + "2. otros_artefactos: Los artefactos de la lista maestra que NO están directamente recomendados o que son complementarios / opcionales según el contexto del documento.\n\n"
                + "LISTA MAESTRA DE ARTEFACTOS (debes usar los nombres EXACTAMENTE como aparecen aquí):\n" + lista
                + "\nREGLAS:\n"
                + "- Cada artefacto de la lista maestra debe aparecer en EXACTAMENTE UNA de las dos listas.\n"
                + "- No inventes ni agregues artefactos que no estén en la lista maestra.\n"
                + "- No cambies el nombre de los artefactos.\n"
                + "- Basa tu clasificación únicamente en el análisis del documento de la Fase 7.\n"
                + "- Si el documento menciona un artefacto con un nombre equivalente, clasifica el nombre exacto de la lista maestra como recomendado.\n"
                + "- Si el documento define procesos de inicio, planificación, ejecución, monitoreo, control o cierre, recomienda los artefactos que sean necesarios para operar esos procesos, aunque no aparezcan con el nombre literal.\n"
                + "- No devuelvas artefactos_recomendados vacío salvo que el documento no contenga absolutamente ninguna práctica, proceso, rol, métrica, riesgo, alcance, cronograma, presupuesto, comunicación, entregable, cierre o lección aprendida.\n\n"
                + "DOCUMENTO DE LA FASE 7:\n---\n${fase7Content}\n---\n\n"
                + "Responde ÚNICAMENTE con un JSON válido con la siguiente estructura, sin texto adicional, sin markdown, sin explicaciones:\n"
                + "{\n  \"artefactos_recomendados\": [\"nombre exacto del artefacto\", ...],\n  \"otros_artefactos\": [\"nombre exacto del artefacto\", ...]\n}";
    }

    private final ConfiguracionAgenteRepository configuracionAgenteRepository;
    private final FaseEstadoRepository faseEstadoRepository;
    private final AiModelSettingsService aiModelSettingsService;
    private final AiFallbackService aiFallbackService;
    private final ObjectMapper objectMapper;
    private final TokenUsageRecorder tokenUsageRecorder;

    public ArtefactosService(ConfiguracionAgenteRepository configuracionAgenteRepository,
                              FaseEstadoRepository faseEstadoRepository,
                              AiModelSettingsService aiModelSettingsService,
                              AiFallbackService aiFallbackService,
                              ObjectMapper objectMapper,
                              TokenUsageRecorder tokenUsageRecorder) {
        this.configuracionAgenteRepository = configuracionAgenteRepository;
        this.faseEstadoRepository = faseEstadoRepository;
        this.aiModelSettingsService = aiModelSettingsService;
        this.aiFallbackService = aiFallbackService;
        this.objectMapper = objectMapper;
        this.tokenUsageRecorder = tokenUsageRecorder;
    }

    public JsonNode consolidar(UUID projectId) {
        markProcessing(projectId);
        try {
            JsonNode result = doConsolidar(projectId);
            saveFaseEstado(projectId, "disponible", result);
            return result;
        } catch (Exception e) {
            String message = e.getMessage() != null ? e.getMessage() : "Error desconocido";
            ObjectNode error = objectMapper.createObjectNode();
            error.put("error", true);
            error.put("message", message);
            saveFaseEstado(projectId, "error", error);
            throw e instanceof RuntimeException re ? re : new IllegalStateException(message, e);
        }
    }

    private JsonNode doConsolidar(UUID projectId) {
        ConfiguracionAgente agentConfig = configuracionAgenteRepository.findByFaseNumero(FASE_ARTEFACTOS).orElse(null);

        FaseEstado fase7 = faseEstadoRepository.findByProyectoIdAndNumeroFase(projectId, FASE_ORIGEN).orElse(null);
        if (fase7 == null || fase7.getDatosConsolidados() == null || fase7.getDatosConsolidados().isNull()) {
            throw new IllegalStateException(
                    "No se encontró el resultado aprobado de la Fase 7. Asegúrate de haber completado y aprobado la Guía Metodológica.");
        }

        String fase7Content = extractFase7Content(fase7.getDatosConsolidados());
        if (fase7Content.isBlank()) {
            throw new IllegalStateException("El documento de la Fase 7 está vacío o no tiene contenido procesable.");
        }

        // La inferencia local (sin IA) sigue usando el texto completo; a la IA solo se le envia
        // un extracto con la estructura de la guia y las frases que mencionan cada artefacto.
        String promptSistema = agentConfig != null ? agentConfig.getPromptSistema() : null;
        String prompt = buildPrompt(buildFase7Extract(fase7.getDatosConsolidados(), fase7Content), promptSistema);

        NormalizedAiModelSettings modelSettings = aiModelSettingsService.getNormalized();
        List<String> candidates = aiModelSettingsService.getModelCandidates(modelSettings,
                agentConfig != null ? agentConfig.getModelo() : null);

        GenerationConfig generationConfig = GenerationConfig.builder()
                .temperature(agentConfig != null && agentConfig.getTemperatura() != null
                        ? agentConfig.getTemperatura().doubleValue() : 1.0)
                .maxOutputTokens(16384)
                .providerTimeoutMs(90_000L)
                .responseMimeType("application/json")
                // Clasificar 18 artefactos en dos listas no requiere razonamiento extendido.
                .thinkingBudget(0)
                .build();

        long startTime = System.currentTimeMillis();
        AiGenerateResult aiResult = aiFallbackService.callWithFallback(candidates, List.of(AiPart.ofText(prompt)), generationConfig);
        tokenUsageRecorder.record(projectId, FASE_ARTEFACTOS, aiResult, System.currentTimeMillis() - startTime);

        JsonNode parsed = parseJsonResponse(aiResult.getText());
        List<String> aiRecommended = normalizeArtifactList(parsed.get("artefactos_recomendados"));
        List<String> aiOther = normalizeArtifactList(parsed.get("otros_artefactos"));
        List<String> deterministicRecommended = inferRecommendedFromText(fase7Content);

        String recommendationSource = !aiRecommended.isEmpty() ? "ai"
                : !deterministicRecommended.isEmpty() ? "text_inference" : "base_fallback";
        boolean usedFallback = "base_fallback".equals(recommendationSource);

        Set<String> recommendedSet = new LinkedHashSet<>(
                "ai".equals(recommendationSource) ? aiRecommended : deterministicRecommended);
        if (usedFallback) {
            recommendedSet.addAll(ACTIVE_ARTEFACTOS_BASE_RECOMENDADOS);
        }

        List<String> finalRecommended = ACTIVE_ARTEFACTOS_MAESTROS.stream().filter(recommendedSet::contains).toList();
        List<String> finalOther = ACTIVE_ARTEFACTOS_MAESTROS.stream().filter(a -> !recommendedSet.contains(a)).toList();

        ObjectNode datosFinales = objectMapper.createObjectNode();
        datosFinales.set("artefactos_recomendados", toArrayNode(finalRecommended));
        datosFinales.set("otros_artefactos", toArrayNode(finalOther));
        datosFinales.set("lista_maestra", toArrayNode(ACTIVE_ARTEFACTOS_MAESTROS));

        ObjectNode metadataWrapper = objectMapper.createObjectNode();
        JsonNode metadata = aiModelSettingsService.attachModelMetadata(metadataWrapper, aiResult, modelSettings).get("metadata");
        ObjectNode fullMetadata = ((ObjectNode) metadata);
        fullMetadata.put("timestamp", OffsetDateTime.now().toString());
        fullMetadata.put("agent_id", "agente-8");
        fullMetadata.put("fase_origen", FASE_ORIGEN);
        fullMetadata.put("total_recomendados", finalRecommended.size());
        fullMetadata.put("total_otros", finalOther.size());
        fullMetadata.set("ai_recomendados_normalizados", toArrayNode(aiRecommended));
        fullMetadata.set("ai_otros_normalizados", toArrayNode(aiOther));
        fullMetadata.set("inferidos_por_texto", toArrayNode(deterministicRecommended));
        fullMetadata.put("fuente_recomendaciones", recommendationSource);
        fullMetadata.put("uso_fallback_base", usedFallback);
        datosFinales.set("metadata", fullMetadata);

        return datosFinales;
    }

    // ── Estado en fases_estado ───────────────────────────────────────────────────────────────

    private void markProcessing(UUID projectId) {
        FaseEstado fase = faseEstadoRepository.findByProyectoIdAndNumeroFase(projectId, FASE_ARTEFACTOS)
                .orElseGet(() -> FaseEstado.builder().proyectoId(projectId).numeroFase(FASE_ARTEFACTOS).build());
        fase.setEstadoVisual("procesando");
        fase.setDatosConsolidados(null);
        fase.setUpdatedAt(OffsetDateTime.now());
        faseEstadoRepository.save(fase);
    }

    private void saveFaseEstado(UUID projectId, String estadoVisual, JsonNode datos) {
        FaseEstado fase = faseEstadoRepository.findByProyectoIdAndNumeroFase(projectId, FASE_ARTEFACTOS)
                .orElseGet(() -> FaseEstado.builder().proyectoId(projectId).numeroFase(FASE_ARTEFACTOS).build());
        fase.setEstadoVisual(estadoVisual);
        fase.setDatosConsolidados(datos);
        fase.setUpdatedAt(OffsetDateTime.now());
        faseEstadoRepository.save(fase);
    }

    // ── Prompt: sustituye ${fase7Content} en el prompt guardado en configuracion_agentes ────

    private String buildPrompt(String fase7Content, String systemPrompt) {
        if (systemPrompt != null && !systemPrompt.isBlank()) {
            if (systemPrompt.contains("${fase7Content}")) {
                return systemPrompt.replace("${fase7Content}", fase7Content);
            }
            return systemPrompt + "\n\nDOCUMENTO DE LA FASE 7:\n---\n" + fase7Content + "\n---";
        }
        return DEFAULT_PROMPT_TEMPLATE.replace("${fase7Content}", fase7Content);
    }

    // ── Extraccion de texto plano legible de la Fase 7 ──────────────────────────────────────

    private JsonNode unwrapFase7Payload(JsonNode agentData) {
        if (agentData == null || agentData.isNull()) return objectMapper.createObjectNode();
        if (agentData.hasNonNull("_current")) return agentData.get("_current");
        if (agentData.hasNonNull("diagnosis")) return agentData.get("diagnosis");
        if (agentData.has("data") && agentData.get("data").hasNonNull("diagnosis")) return agentData.get("data").get("diagnosis");
        if (agentData.hasNonNull("data")) return agentData.get("data");
        return agentData;
    }

    private String extractFase7Content(JsonNode agentData) {
        JsonNode d = unwrapFase7Payload(agentData);
        List<String> parts = new ArrayList<>();

        addIfPresent(parts, "Título", d, "titulo");
        addIfPresent(parts, "Resumen", d, "resumen", "summary");
        addIfPresent(parts, "Introducción", d, "introduccion");
        addIfPresent(parts, "Descripción", d, "descripcion_general");

        JsonNode secciones = firstPresent(d, "capitulos", "chapters", "secciones", "guide_content", "contenido");
        if (secciones == null && d.hasNonNull("diagnosis") && d.get("diagnosis").hasNonNull("guide_content")) {
            secciones = d.get("diagnosis").get("guide_content");
        }
        if (secciones != null && secciones.isArray() && !secciones.isEmpty()) {
            parts.add("\nSecciones de la guía:");
            for (JsonNode sec : secciones) {
                if (sec.isTextual()) {
                    parts.add("- " + sec.asText());
                    continue;
                }
                String titulo = firstText(sec, "titulo", "title", "nombre", "section_title", "id", "section_id");
                JsonNode contenido = firstPresent(sec, "contenido", "content", "descripcion", "description", "enfasis", "introduccion");
                parts.add("- " + titulo + ": " + stringifyGuideValue(contenido));

                JsonNode subsecs = firstPresent(sec, "subsecciones", "subsections", "secciones");
                if (subsecs != null && subsecs.isArray()) {
                    for (JsonNode sub : subsecs) {
                        String stit = firstText(sub, "titulo", "title");
                        JsonNode scont = firstPresent(sub, "contenido", "content", "descripcion");
                        if (!stit.isBlank() || scont != null) {
                            parts.add("  · " + stit + ": " + stringifyGuideValue(scont));
                        }
                    }
                }
            }
        } else if (secciones != null && secciones.isObject() && secciones.size() > 0) {
            parts.add("\nSecciones de la guía:");
            secciones.fields().forEachRemaining(entry -> parts.add("- " + entry.getKey() + ": " + stringifyGuideValue(entry.getValue())));
        }

        JsonNode artefactos = firstPresent(d, "artefactos_recomendados", "artefactos", "artifacts");
        if (artefactos != null && artefactos.isArray() && !artefactos.isEmpty()) {
            parts.add("\nArtefactos mencionados en la guía:");
            for (JsonNode art : artefactos) {
                if (art.isTextual()) {
                    parts.add("- " + art.asText());
                } else {
                    String nombre = firstText(art, "nombre", "name", "titulo");
                    String desc = firstText(art, "descripcion", "description");
                    parts.add("- " + nombre + (desc.isBlank() ? "" : ": " + desc));
                }
            }
        }

        if (d.hasNonNull("metodologia")) {
            JsonNode metodologia = d.get("metodologia");
            parts.add("\nMetodología: " + (metodologia.isTextual() ? metodologia.asText() : metodologia.toString()));
        }
        if (d.hasNonNull("enfoque")) {
            JsonNode enfoque = d.get("enfoque");
            parts.add("Enfoque: " + (enfoque.isTextual() ? enfoque.asText() : enfoque.toString()));
        }

        if (parts.isEmpty()) {
            try {
                return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(agentData);
            } catch (Exception e) {
                return agentData.toString();
            }
        }
        return String.join("\n", parts);
    }

    /**
     * Extracto compacto de la guia para la clasificacion de artefactos: titulo, resumen,
     * metodologia/enfoque, titulos de secciones, artefactos que la guia nombra y, como
     * evidencia, las frases del texto completo que mencionan cada artefacto de la lista maestra
     * (o un sinonimo). Es lo que el modelo necesita para decidir, sin reenviar la guia entera.
     */
    private String buildFase7Extract(JsonNode agentData, String fullContent) {
        JsonNode d = unwrapFase7Payload(agentData);
        List<String> parts = new ArrayList<>();
        parts.add("(Extracto de la guía: estructura y frases relevantes para los artefactos. No es el documento completo.)");

        addIfPresent(parts, "Título", d, "titulo");
        addIfPresent(parts, "Resumen", d, "resumen_ejecutivo", "resumen", "summary");
        if (d.hasNonNull("metodologia")) parts.add("Metodología: " + truncate(stringifyGuideValue(d.get("metodologia")), 600));
        if (d.hasNonNull("enfoque")) parts.add("Enfoque: " + truncate(stringifyGuideValue(d.get("enfoque")), 600));

        JsonNode secciones = firstPresent(d, "capitulos", "chapters", "secciones", "guide_content", "contenido");
        if (secciones == null && d.hasNonNull("diagnosis") && d.get("diagnosis").hasNonNull("guide_content")) {
            secciones = d.get("diagnosis").get("guide_content");
        }
        if (secciones != null && secciones.isArray() && !secciones.isEmpty()) {
            parts.add("\nSecciones de la guía:");
            for (JsonNode sec : secciones) {
                String titulo = sec.isTextual() ? sec.asText()
                        : firstText(sec, "titulo", "title", "nombre", "section_title", "id", "section_id");
                if (!titulo.isBlank()) parts.add("- " + truncate(titulo, 160));
                JsonNode subsecs = sec.isObject() ? firstPresent(sec, "subsecciones", "subsections", "secciones") : null;
                if (subsecs != null && subsecs.isArray()) {
                    for (JsonNode sub : subsecs) {
                        String stit = firstText(sub, "titulo", "title");
                        if (!stit.isBlank()) parts.add("  · " + truncate(stit, 160));
                    }
                }
            }
        }

        JsonNode artefactos = firstPresent(d, "artefactos_recomendados", "artefactos", "artifacts");
        if (artefactos != null && artefactos.isArray() && !artefactos.isEmpty()) {
            parts.add("\nArtefactos mencionados en la guía:");
            for (JsonNode art : artefactos) {
                String nombre = art.isTextual() ? art.asText() : firstText(art, "nombre", "name", "titulo");
                if (!nombre.isBlank()) parts.add("- " + truncate(nombre, 160));
            }
        }

        List<String> sentences = new ArrayList<>();
        for (String raw : fullContent.split("(?<=[.!?;])\\s+|\\n+")) {
            String sentence = raw.replaceAll("[#*`>|]+", " ").replaceAll("\\s+", " ").trim();
            if (sentence.length() >= 20) sentences.add(sentence);
        }
        List<String> evidence = new ArrayList<>();
        Set<String> used = new LinkedHashSet<>();
        for (String artifact : ACTIVE_ARTEFACTOS_MAESTROS) {
            List<String> terms = new ArrayList<>();
            terms.add(normalizeText(artifact));
            ACTIVE_ARTIFACT_ALIASES.getOrDefault(artifact, List.of()).forEach(alias -> terms.add(normalizeText(alias)));
            int found = 0;
            for (String sentence : sentences) {
                if (found >= MAX_SNIPPETS_PER_ARTIFACT) break;
                String normalized = " " + normalizeText(sentence) + " ";
                boolean mentions = terms.stream().anyMatch(t -> !t.isBlank() && normalized.contains(" " + t + " "));
                if (mentions && used.add(sentence)) {
                    evidence.add("- [" + artifact + "] " + truncate(sentence, MAX_SNIPPET_CHARS));
                    found++;
                }
            }
        }
        if (!evidence.isEmpty()) {
            parts.add("\nFrases de la guía que mencionan artefactos o sus equivalentes:");
            parts.addAll(evidence);
        }

        return truncate(String.join("\n", parts), MAX_EXTRACT_CHARS);
    }

    private static String truncate(String value, int max) {
        if (value == null) return "";
        return value.length() <= max ? value : value.substring(0, max).trim() + "…";
    }

    private void addIfPresent(List<String> parts, String label, JsonNode node, String... keys) {
        String value = firstText(node, keys);
        if (!value.isBlank()) parts.add(label + ": " + value);
    }

    private JsonNode firstPresent(JsonNode obj, String... keys) {
        for (String key : keys) {
            JsonNode v = obj.get(key);
            if (v != null && !v.isNull() && !v.isMissingNode()) return v;
        }
        return null;
    }

    private String firstText(JsonNode obj, String... keys) {
        JsonNode v = firstPresent(obj, keys);
        return v != null && v.isTextual() ? v.asText() : "";
    }

    private String stringifyGuideValue(JsonNode value) {
        if (value == null || value.isNull() || value.isMissingNode()) return "";
        if (value.isTextual()) return value.asText();
        if (value.isNumber() || value.isBoolean()) return value.asText();
        if (value.isArray()) {
            List<String> mapped = new ArrayList<>();
            value.forEach(v -> {
                String s = stringifyGuideValue(v);
                if (!s.isBlank()) mapped.add(s);
            });
            return String.join("\n", mapped);
        }
        if (value.isObject()) {
            List<String> mapped = new ArrayList<>();
            value.fields().forEachRemaining(entry -> {
                JsonNode nested = entry.getValue();
                if (nested != null && !nested.isNull() && !(nested.isTextual() && nested.asText().isEmpty())) {
                    mapped.add(entry.getKey() + ": " + stringifyGuideValue(nested));
                }
            });
            return String.join("\n", mapped);
        }
        return value.toString();
    }

    // ── Normalizacion / matching contra la lista maestra ────────────────────────────────────

    private String normalizeText(String value) {
        if (value == null) return "";
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase();
        return normalized.replaceAll("[^a-z0-9]+", " ").trim();
    }

    private String resolveArtifactName(String value) {
        String normalized = normalizeText(value);
        if (normalized.isBlank()) return null;

        for (String artifact : ACTIVE_ARTEFACTOS_MAESTROS) {
            List<String> candidates = new ArrayList<>();
            candidates.add(artifact);
            candidates.addAll(ACTIVE_ARTIFACT_ALIASES.getOrDefault(artifact, List.of()));
            for (String candidateRaw : candidates) {
                String candidate = normalizeText(candidateRaw);
                if (normalized.equals(candidate) || normalized.contains(candidate) || candidate.contains(normalized)) {
                    return artifact;
                }
            }
        }
        return null;
    }

    private List<String> normalizeArtifactList(JsonNode values) {
        List<String> result = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        if (values != null && values.isArray()) {
            for (JsonNode v : values) {
                String resolved = resolveArtifactName(v.isTextual() ? v.asText() : v.toString());
                if (resolved != null && seen.add(resolved)) result.add(resolved);
            }
        }
        return result;
    }

    private List<String> inferRecommendedFromText(String text) {
        String normalizedText = normalizeText(text);
        if (normalizedText.isBlank()) return List.of();

        List<String> matches = new ArrayList<>();
        for (String artifact : ACTIVE_ARTEFACTOS_MAESTROS) {
            List<String> candidates = new ArrayList<>();
            candidates.add(artifact);
            candidates.addAll(ACTIVE_ARTIFACT_ALIASES.getOrDefault(artifact, List.of()));
            boolean matched = candidates.stream()
                    .map(this::normalizeText)
                    .anyMatch(candidate -> candidate.length() > 3 && normalizedText.contains(candidate));
            if (matched) matches.add(artifact);
        }
        return matches;
    }

    // ── Parseo de la respuesta JSON de la IA ────────────────────────────────────────────────

    private JsonNode parseJsonResponse(String rawContent) {
        try {
            return objectMapper.readTree(rawContent);
        } catch (Exception e) {
            String cleaned = rawContent != null ? rawContent.trim() : "";
            int firstBrace = cleaned.indexOf('{');
            int lastBrace = cleaned.lastIndexOf('}');
            if (firstBrace == -1 || lastBrace == -1 || lastBrace <= firstBrace) {
                String preview = rawContent != null && rawContent.length() > 300 ? rawContent.substring(0, 300) : rawContent;
                throw new IllegalStateException("El proveedor de IA no devolvio JSON valido: " + preview);
            }
            try {
                return objectMapper.readTree(cleaned.substring(firstBrace, lastBrace + 1));
            } catch (Exception e2) {
                String preview = rawContent.length() > 300 ? rawContent.substring(0, 300) : rawContent;
                throw new IllegalStateException("El proveedor de IA no devolvio JSON valido: " + preview);
            }
        }
    }

    private ArrayNode toArrayNode(List<String> values) {
        ArrayNode array = objectMapper.createArrayNode();
        values.forEach(array::add);
        return array;
    }
}
