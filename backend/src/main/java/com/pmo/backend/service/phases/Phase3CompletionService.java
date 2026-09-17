package com.pmo.backend.service.phases;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Puerto Java 1:1 de _shared/phase3Completion.ts: el calculo deterministico de la encuesta de
 * idoneidad (fase 3) que se aplica SIEMPRE encima de lo que devuelve la IA, para que los
 * promedios/desviaciones/zonas sean aritmeticamente exactos y no dependan del modelo.
 */
@Service
public class Phase3CompletionService {

    private static final Pattern IDONEIDAD_ITEM_RE = Pattern.compile("([CEP]\\d{2})", Pattern.CASE_INSENSITIVE);

    private static final Map<String, String> ITEM_LABELS = new LinkedHashMap<>();
    static {
        ITEM_LABELS.put("C01", "Apertura al cambio");
        ITEM_LABELS.put("C02", "Autonomia en decisiones");
        ITEM_LABELS.put("C03", "Confianza entre equipos");
        ITEM_LABELS.put("C04", "Orientacion a valor vs. cumplimiento");
        ITEM_LABELS.put("C05", "Adaptacion ante imprevistos");
        ITEM_LABELS.put("C06", "Tolerancia a la ambiguedad");
        ITEM_LABELS.put("C07", "Colaboracion entre areas");
        ITEM_LABELS.put("C08", "Liderazgo participativo");
        ITEM_LABELS.put("C09", "Aprendizaje continuo");
        ITEM_LABELS.put("C10", "Orientacion a resultados sobre procesos");
        ITEM_LABELS.put("E01", "Capacidades tecnicas");
        ITEM_LABELS.put("E02", "Experiencia en enfoques agiles");
        ITEM_LABELS.put("E03", "Acceso al cliente");
        ITEM_LABELS.put("E04", "Estructura del equipo");
        ITEM_LABELS.put("E05", "Dedicacion de roles");
        ITEM_LABELS.put("E06", "Nivel de autogestion");
        ITEM_LABELS.put("P01", "Nivel de incertidumbre en requisitos");
        ITEM_LABELS.put("P02", "Frecuencia de cambios esperados");
        ITEM_LABELS.put("P03", "Viabilidad de entrega iterativa");
        ITEM_LABELS.put("P04", "Criticidad y riesgo del producto");
        ITEM_LABELS.put("P05", "Claridad del alcance desde el inicio");
    }

    private static final List<String> EXPECTED_ITEMS = new ArrayList<>(ITEM_LABELS.keySet());
    private static final Map<String, List<String>> DIMENSION_ITEMS = Map.of(
            "cultura", EXPECTED_ITEMS.stream().filter(i -> i.startsWith("C")).toList(),
            "equipo", EXPECTED_ITEMS.stream().filter(i -> i.startsWith("E")).toList(),
            "proyecto", EXPECTED_ITEMS.stream().filter(i -> i.startsWith("P")).toList()
    );

    private final ObjectMapper objectMapper;

    public Phase3CompletionService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    private record ScoreRecord(String respondentId, String name, String role, String code, double score, String source) {
    }

    private record ItemStat(String item, String dimension, Double promedioRaw, Double promedio, Double minimo, Double maximo,
                             double desviacionEstandar, String zona, boolean factorCritico, List<Double> scores) {
    }

    private static class RespondentAcc {
        String respondentId;
        String name;
        String role;
        Map<String, Double> scores = new LinkedHashMap<>();
    }

    public JsonNode withCompletedPhase3Items(JsonNode diagnosis, JsonNode inputEnvelope, List<String> csvTexts) {
        Map<String, Object> deterministic = buildDeterministicDiagnosis(inputEnvelope, csvTexts);
        if (deterministic == null || diagnosis == null || !diagnosis.isObject()) return diagnosis;

        ObjectNode wrapper = (ObjectNode) diagnosis;
        ObjectNode inner = wrapper.has("diagnosis") && wrapper.get("diagnosis").isObject()
                ? (ObjectNode) wrapper.get("diagnosis") : wrapper;

        Double aiScore = normalizeIdoneidadScore(inner.has("suitability_score") ? inner.get("suitability_score") : null);
        double deterministicScore = (double) deterministic.get("suitability_score");
        List<String> auditObservations = new ArrayList<>();
        if (aiScore != null && Math.abs(aiScore - deterministicScore) > 0.05) {
            auditObservations.add("Se detecto diferencia entre suitability_score de IA (" + aiScore
                    + ") y calculo deterministico (" + deterministicScore + "); se conservo el calculo deterministico.");
        }

        JsonNode preservedSummary = inner.get("summary");
        JsonNode preservedInterpretation = inner.get("interpretacion_por_factores");
        JsonNode preservedInconsistencias = inner.has("inconsistencias") && inner.get("inconsistencias").isArray()
                ? inner.get("inconsistencias") : objectMapper.createArrayNode();

        ObjectNode deterministicNode = (ObjectNode) objectMapper.valueToTree(deterministic);
        // Object.assign(inner, deterministic): copiamos todos los campos deterministicos sobre inner.
        deterministicNode.fields().forEachRemaining(entry -> inner.set(entry.getKey(), entry.getValue()));

        if (preservedSummary != null && !preservedSummary.isNull()) inner.set("summary", preservedSummary);
        if (preservedInterpretation != null && !preservedInterpretation.isNull()) {
            inner.set("interpretacion_por_factores", preservedInterpretation);
        }
        inner.set("inconsistencias", preservedInconsistencias);

        List<String> observations = new ArrayList<>();
        @SuppressWarnings("unchecked")
        List<String> deterministicObservations = (List<String>) deterministic.get("observations");
        List<String> wrapperObservations = new ArrayList<>();
        if (wrapper.has("observations") && wrapper.get("observations").isArray()) {
            wrapper.get("observations").forEach(n -> wrapperObservations.add(n.asText()));
        }
        observations.addAll(mergeLimitedStrings(auditObservations, deterministicObservations, wrapperObservations));
        inner.set("observations", objectMapper.valueToTree(observations));
        inner.put("_calculo_deterministico_fuente", "spring_boot_phase3_v1");

        if (wrapper.has("metadata") && wrapper.get("metadata").isObject()) {
            ((ObjectNode) wrapper.get("metadata")).put("agent_id", "asistente-3");
        }

        return diagnosis;
    }

    private List<String> mergeLimitedStrings(List<String>... groups) {
        List<String> result = new ArrayList<>();
        for (List<String> group : groups) {
            if (group == null) continue;
            for (String item : group) {
                if (item == null) continue;
                String text = item.trim();
                if (!text.isEmpty() && !result.contains(text)) result.add(text);
                if (result.size() >= 6) return result;
            }
        }
        return result;
    }

    private Map<String, Object> buildDeterministicDiagnosis(JsonNode inputEnvelope, List<String> csvTexts) {
        CollectResult collected = collectRawScores(inputEnvelope, csvTexts);
        if (collected.records.isEmpty()) return null;

        Map<String, List<ScoreRecord>> scoresByItem = new LinkedHashMap<>();
        for (String item : EXPECTED_ITEMS) scoresByItem.put(item, new ArrayList<>());
        for (ScoreRecord record : collected.records) scoresByItem.get(record.code()).add(record);

        List<ItemStat> itemStats = new ArrayList<>();
        for (String item : EXPECTED_ITEMS) {
            List<Double> scores = scoresByItem.get(item).stream().map(ScoreRecord::score).toList();
            Double avg = average(scores);
            double deviation = std(scores);
            String zone = zoneFromScore(avg);
            itemStats.add(new ItemStat(
                    item, inferDimension(item), avg, avg == null ? null : round(avg, 2),
                    scores.isEmpty() ? null : scores.stream().min(Double::compareTo).orElse(null),
                    scores.isEmpty() ? null : scores.stream().max(Double::compareTo).orElse(null),
                    round(deviation, 2), zone, avg != null && (avg <= 3 || avg >= 7), scores
            ));
        }

        List<ItemStat> validItemStats = itemStats.stream().filter(s -> s.promedioRaw() != null).toList();
        List<String> missingItems = itemStats.stream().filter(s -> s.promedioRaw() == null).map(ItemStat::item).toList();
        boolean allItemsAvailable = missingItems.isEmpty();
        List<Double> itemAverageValues = validItemStats.stream().map(ItemStat::promedioRaw).toList();
        double sumAvailableItemAverages = itemAverageValues.stream().mapToDouble(Double::doubleValue).sum();
        Double suitabilityRaw = allItemsAvailable
                ? (EXPECTED_ITEMS.isEmpty() ? null : sumAvailableItemAverages / EXPECTED_ITEMS.size())
                : average(itemAverageValues);
        double suitabilityScore = suitabilityRaw == null ? 0 : round(suitabilityRaw, 1);
        String generalZone = zoneFromScore(suitabilityRaw);

        List<Map<String, Object>> traceScores = new ArrayList<>();
        List<String> incompleteRespondents = new ArrayList<>();
        List<String> zeroVariationRespondents = new ArrayList<>();
        for (RespondentAcc respondent : collected.respondents) {
            List<Double> present = new ArrayList<>();
            Map<String, Object> scoresOut = new LinkedHashMap<>();
            for (String item : EXPECTED_ITEMS) {
                Double v = respondent.scores.get(item);
                scoresOut.put(item, v != null ? v : 0);
                if (v != null) present.add(v);
            }
            Map<String, Object> trace = new LinkedHashMap<>();
            trace.put("respondent_id", respondent.respondentId);
            trace.put("role", respondent.role);
            trace.put("scores", scoresOut);
            trace.put("promedio_individual", present.isEmpty() ? 0 : round(average(present), 2));
            traceScores.add(trace);

            if (EXPECTED_ITEMS.stream().anyMatch(item -> !respondent.scores.containsKey(item))) {
                incompleteRespondents.add(respondent.respondentId);
            }
            if (present.size() > 1 && new LinkedHashSet<>(present).size() == 1) {
                zeroVariationRespondents.add(respondent.respondentId);
            }
        }

        Map<String, Object> sumByItem = new LinkedHashMap<>();
        Map<String, Object> countByItem = new LinkedHashMap<>();
        Map<String, Object> rawAvgByItem = new LinkedHashMap<>();
        for (String item : EXPECTED_ITEMS) {
            List<ScoreRecord> records = scoresByItem.get(item);
            sumByItem.put(item, round(records.stream().mapToDouble(ScoreRecord::score).sum(), 4));
            countByItem.put(item, records.size());
            Double avg = itemStats.stream().filter(s -> s.item().equals(item)).findFirst().map(ItemStat::promedioRaw).orElse(null);
            rawAvgByItem.put(item, avg == null ? null : round(avg, 4));
        }

        Map<String, Map<String, Object>> dimensionSummary = new LinkedHashMap<>();
        for (Map.Entry<String, List<String>> entry : DIMENSION_ITEMS.entrySet()) {
            List<ItemStat> dimStats = itemStats.stream()
                    .filter(s -> entry.getValue().contains(s.item()) && s.promedioRaw() != null).toList();
            List<Double> averages = dimStats.stream().map(ItemStat::promedioRaw).toList();
            Double avg = average(averages);
            double deviation = std(averages);
            List<ItemStat> sorted = new ArrayList<>(dimStats);
            sorted.sort((a, b) -> Double.compare(a.promedioRaw(), b.promedioRaw()));

            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("promedio_raw", avg);
            summary.put("promedio", avg == null ? 0 : round(avg, 2));
            summary.put("desviacion_estandar", round(deviation, 2));
            summary.put("item_mas_bajo", sorted.isEmpty() ? "No disponible" : sorted.get(0).item());
            summary.put("item_mas_alto", sorted.isEmpty() ? "No disponible" : sorted.get(sorted.size() - 1).item());
            summary.put("coherencia_interna", coherenceFromStd(deviation));
            dimensionSummary.put(entry.getKey(), summary);
        }

        List<Map<String, Object>> indicadoresAgilidad = itemStats.stream()
                .filter(s -> s.promedioRaw() != null && s.promedioRaw() <= 3)
                .map(s -> factorMap(s, "agil"))
                .toList();
        List<Map<String, Object>> indicadoresPredictivos = itemStats.stream()
                .filter(s -> s.promedioRaw() != null && s.promedioRaw() >= 7)
                .map(s -> factorMap(s, "predictiva"))
                .toList();
        List<Map<String, Object>> indicadoresHibridos = itemStats.stream()
                .filter(s -> s.promedioRaw() != null && s.promedioRaw() > 3 && s.promedioRaw() < 7 && s.desviacionEstandar() <= 2.5)
                .map(s -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("item_o_dimension", s.item());
                    m.put("promedio", s.promedio());
                    m.put("desviacion", s.desviacionEstandar());
                    m.put("interpretacion_del_factor", s.item() + " - " + ITEM_LABELS.get(s.item())
                            + " se ubica en zona de transicion con dispersion " + s.desviacionEstandar() + ".");
                    return m;
                }).toList();

        List<Map<String, Object>> conflictos = new ArrayList<>();
        for (ItemStat s : itemStats) {
            if (s.minimo() == null || s.maximo() == null || (s.maximo() - s.minimo()) < 5) continue;
            List<String> involved = collected.records.stream()
                    .filter(r -> r.code().equals(s.item()) && (r.score() == s.minimo() || r.score() == s.maximo()))
                    .map(ScoreRecord::role).distinct().toList();
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("item", s.item());
            c.put("valor_maximo", s.maximo());
            c.put("valor_minimo", s.minimo());
            c.put("cargos_involucrados", involved);
            c.put("diferencia", round(s.maximo() - s.minimo(), 2));
            conflictos.add(c);
        }

        List<Map<String, Object>> tensiones = new ArrayList<>();
        for (String[] pair : new String[][]{{"Cultura-Equipo", "cultura", "equipo"}, {"Cultura-Proyecto", "cultura", "proyecto"}, {"Equipo-Proyecto", "equipo", "proyecto"}}) {
            double a = nz(dimensionSummary.get(pair[1]).get("promedio_raw"));
            double b = nz(dimensionSummary.get(pair[2]).get("promedio_raw"));
            double diff = Math.abs(a - b);
            String clasificacion = diff > 3 ? "Severa" : diff >= 2 ? "Moderada" : "Leve";
            Map<String, Object> t = new LinkedHashMap<>();
            t.put("par_dimensiones", pair[0]);
            t.put("diferencia_promedios", round(diff, 2));
            t.put("clasificacion", clasificacion);
            t.put("interpretacion", "La diferencia cuantitativa entre " + pair[0].toLowerCase() + " es " + round(diff, 2) + " puntos.");
            tensiones.add(t);
        }

        List<Map<String, Object>> risks = new ArrayList<>();
        if (!conflictos.isEmpty()) {
            Map<String, Object> risk = new LinkedHashMap<>();
            risk.put("nombre", "Polarizacion de percepciones");
            risk.put("descripcion", "Se identificaron items con diferencia mayor o igual a 5 puntos entre respuestas.");
            risk.put("datos_respaldo", conflictos.stream().limit(4)
                    .map(c -> c.get("item") + ": diferencia " + c.get("diferencia")).toList());
            risk.put("nivel", conflictos.size() >= 3 ? "Alto" : "Medio");
            risks.add(risk);
        }
        boolean hasSevera = tensiones.stream().anyMatch(t -> "Severa".equals(t.get("clasificacion")));
        if (hasSevera) {
            Map<String, Object> risk = new LinkedHashMap<>();
            risk.put("nombre", "Desalineacion entre dimensiones");
            risk.put("descripcion", "La encuesta muestra diferencias severas entre dimensiones cuantitativas.");
            risk.put("datos_respaldo", tensiones.stream().filter(t -> "Severa".equals(t.get("clasificacion")))
                    .map(t -> t.get("par_dimensiones") + ": " + t.get("diferencia_promedios")).toList());
            risk.put("nivel", "Alto");
            risks.add(risk);
        }
        if (risks.isEmpty()) {
            Map<String, Object> risk = new LinkedHashMap<>();
            risk.put("nombre", "Sin riesgo cuantitativo critico");
            risk.put("descripcion", "No se identificaron tensiones severas ni conflictos de percepcion mayores con los datos validos.");
            risk.put("datos_respaldo", List.of("Desviacion general " + round(std(itemAverageValues), 2)));
            risk.put("nivel", "Bajo");
            risks.add(risk);
        }

        Double p01 = findRaw(itemStats, "P01");
        Double p05 = findRaw(itemStats, "P05");
        Double c09 = findRaw(itemStats, "C09");
        Boolean tienePreproyecto = (p01 == null || p05 == null) ? null : (p01 <= 3 && p05 <= 3);
        Boolean tienePostcierre = c09 == null ? null : c09 >= 7;

        String confidence = allItemsAvailable && collected.respondents.size() >= 3 && collected.invalidAlerts.isEmpty()
                ? "Alta" : allItemsAvailable && !collected.respondents.isEmpty() ? "Media" : "Baja";

        List<String> observations = new ArrayList<>();
        observations.add("El calculo deterministico sobre " + validItemStats.size() + " items validos es " + suitabilityScore + "/10.");
        observations.add("La zona predominante calculada es " + zoneLabel(generalZone) + " segun escala invertida 1-10.");
        observations.add(missingItems.isEmpty() ? "Los 21 items esperados tienen al menos una respuesta valida."
                : "Items sin datos validos: " + String.join(", ", missingItems) + ".");
        observations.add(conflictos.isEmpty() ? "No se identificaron conflictos de percepcion con diferencia >= 5."
                : "Se identificaron " + conflictos.size() + " conflictos de percepcion con diferencia >= 5.");

        Map<String, Object> deterministic = new LinkedHashMap<>();
        deterministic.put("summary", "El calculo deterministico ubica la encuesta en " + zoneLabel(generalZone) + " con score "
                + suitabilityScore + "/10. Los resultados fueron calculados exclusivamente con answer_score validos en escala 1-10.");
        deterministic.put("suitability_score", suitabilityScore);
        deterministic.put("suitability_level", zoneLabel(generalZone));
        deterministic.put("zona_predominante_general", zoneLabel(generalZone));
        deterministic.put("formato_entrada_detectado", !csvTexts.isEmpty() ? "mixto" : "crudos");
        deterministic.put("indicadores_agilidad", indicadoresAgilidad);
        deterministic.put("indicadores_predictivos", indicadoresPredictivos);
        deterministic.put("indicadores_hibridos", indicadoresHibridos);
        deterministic.put("tensiones_criticas_resumen", tensiones.stream().filter(t -> "Severa".equals(t.get("clasificacion")))
                .limit(3).map(t -> t.get("par_dimensiones") + ": diferencia " + t.get("diferencia_promedios")).toList());
        deterministic.put("numero_encuestados", collected.respondents.size());
        deterministic.put("cargos_representados", collected.respondents.stream().map(r -> r.role)
                .filter(r -> r != null && !r.isBlank()).distinct().toList());

        Map<String, Object> calidadInput = new LinkedHashMap<>();
        calidadInput.put("items_faltantes", missingItems);
        calidadInput.put("encuestados_con_datos_incompletos", incompleteRespondents);
        List<String> alertas = new ArrayList<>(collected.invalidAlerts);
        zeroVariationRespondents.forEach(id -> alertas.add(id + ": patron de respuesta con variacion cero"));
        calidadInput.put("alertas_respuesta_invalida", alertas);
        List<String> limitaciones = new ArrayList<>();
        if (!allItemsAvailable) limitaciones.add("No fue posible calcular la formula completa de 21 items porque hay items faltantes.");
        calidadInput.put("limitaciones_por_formato", limitaciones);
        deterministic.put("calidad_input", calidadInput);

        Map<String, Object> trazabilidad = new LinkedHashMap<>();
        trazabilidad.put("scores_por_encuestado_por_item", traceScores);
        trazabilidad.put("suma_por_item", sumByItem);
        trazabilidad.put("n_respondentes_por_item", countByItem);
        trazabilidad.put("promedio_por_item_sin_redondear", rawAvgByItem);
        trazabilidad.put("suma_promedios_cultura_10_items", round(sumRaw(itemStats, DIMENSION_ITEMS.get("cultura")), 4));
        trazabilidad.put("promedio_dimension_cultura", dimensionSummary.get("cultura").get("promedio"));
        trazabilidad.put("suma_promedios_equipo_6_items", round(sumRaw(itemStats, DIMENSION_ITEMS.get("equipo")), 4));
        trazabilidad.put("promedio_dimension_equipo", dimensionSummary.get("equipo").get("promedio"));
        trazabilidad.put("suma_promedios_proyecto_5_items", round(sumRaw(itemStats, DIMENSION_ITEMS.get("proyecto")), 4));
        trazabilidad.put("promedio_dimension_proyecto", dimensionSummary.get("proyecto").get("promedio"));
        trazabilidad.put("suma_21_promedios_items", round(sumAvailableItemAverages, 4));
        trazabilidad.put("suitability_score_sin_redondear", suitabilityRaw == null ? 0 : round(suitabilityRaw, 4));
        trazabilidad.put("verificacion_rango_superada", itemStats.stream().allMatch(s ->
                s.promedioRaw() == null || (s.minimo() != null && s.maximo() != null && s.promedioRaw() >= s.minimo() && s.promedioRaw() <= s.maximo())));
        deterministic.put("trazabilidad_calculo", trazabilidad);

        deterministic.put("resultados_por_item", validItemStats.stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("item", s.item());
            m.put("dimension", s.dimension());
            m.put("promedio", s.promedio() != null ? s.promedio() : 0);
            m.put("minimo", s.minimo() != null ? s.minimo() : 0);
            m.put("maximo", s.maximo() != null ? s.maximo() : 0);
            m.put("desviacion_estandar", s.desviacionEstandar());
            m.put("zona", "sin_datos".equals(s.zona()) ? "transicion" : s.zona());
            m.put("factor_critico", s.factorCritico());
            return m;
        }).toList());

        Map<String, Object> indicadores = new LinkedHashMap<>();
        indicadores.put("cultura", dimensionSummary.get("cultura"));
        indicadores.put("equipo", dimensionSummary.get("equipo"));
        indicadores.put("proyecto", dimensionSummary.get("proyecto"));
        Map<String, Object> general = new LinkedHashMap<>();
        general.put("promedio", suitabilityRaw == null ? 0 : round(suitabilityRaw, 2));
        general.put("desviacion_estandar", round(std(itemAverageValues), 2));
        general.put("zona_predominante", zoneLabel(generalZone));
        general.put("comportamiento", behaviorFromStd(std(itemAverageValues)));
        indicadores.put("general", general);
        deterministic.put("indicadores", indicadores);

        Map<String, Object> distribucion = new LinkedHashMap<>();
        distribucion.put("cultura", buildDistribution(collected.records, DIMENSION_ITEMS.get("cultura")));
        distribucion.put("equipo", buildDistribution(collected.records, DIMENSION_ITEMS.get("equipo")));
        distribucion.put("proyecto", buildDistribution(collected.records, DIMENSION_ITEMS.get("proyecto")));
        distribucion.put("general", buildDistribution(collected.records, EXPECTED_ITEMS));
        deterministic.put("distribucion", distribucion);

        Map<String, Object> factoresCriticos = new LinkedHashMap<>();
        factoresCriticos.put("alta_afinidad_agil", indicadoresAgilidad.stream().map(m -> simplifyFactor(m)).toList());
        factoresCriticos.put("alta_afinidad_predictiva", indicadoresPredictivos.stream().map(m -> simplifyFactor(m)).toList());
        deterministic.put("factores_criticos", factoresCriticos);

        Map<String, Object> alineacion = new LinkedHashMap<>();
        alineacion.put("disponible", collected.respondents.size() > 1);
        Map<String, Object> consenso = new LinkedHashMap<>();
        consenso.put("cultura", dimensionSummary.get("cultura").get("coherencia_interna"));
        consenso.put("equipo", dimensionSummary.get("equipo").get("coherencia_interna"));
        consenso.put("proyecto", dimensionSummary.get("proyecto").get("coherencia_interna"));
        alineacion.put("consenso_por_dimension", consenso);
        alineacion.put("conflictos_percepcion", conflictos);
        deterministic.put("alineacion", alineacion);

        deterministic.put("tensiones", tensiones);
        deterministic.put("riesgos", risks);
        deterministic.put("nivel_confiabilidad", confidence);
        deterministic.put("justificacion_confiabilidad", "Confiabilidad " + confidence + ": "
                + (allItemsAvailable ? "cobertura completa de items" : "cobertura parcial de items") + " y "
                + collected.respondents.size() + " encuestados con datos validos o parcialmente validos.");
        deterministic.put("observations", observations);
        deterministic.put("listo_para_integracion", allItemsAvailable && !collected.records.isEmpty());

        Map<String, Object> insumos = new LinkedHashMap<>();
        insumos.put("indicadores_agilidad", indicadoresAgilidad);
        insumos.put("indicadores_predictivos", indicadoresPredictivos);
        insumos.put("indicadores_hibridos", indicadoresHibridos);
        insumos.put("zona_predominante_general", zoneLabel(generalZone));
        insumos.put("comportamiento_general", behaviorFromStd(std(itemAverageValues)));
        insumos.put("tiene_preproyecto", tienePreproyecto);
        insumos.put("justificacion_preproyecto", tienePreproyecto == null
                ? "No hay datos suficientes en P01 y P05 para identificar senales de preproyecto."
                : tienePreproyecto
                    ? "P01 (" + round(p01, 2) + ") y P05 (" + round(p05, 2) + ") presentan puntajes bajos que sugieren senales cuantitativas de exploracion previa."
                    : "P01 (" + round(p01, 2) + ") y P05 (" + round(p05, 2) + ") no presentan conjuntamente la senal cuantitativa definida para preproyecto.");
        insumos.put("tiene_postcierre", tienePostcierre);
        insumos.put("justificacion_postcierre", tienePostcierre == null
                ? "No hay datos suficientes en C09 para identificar senales de post-cierre."
                : tienePostcierre
                    ? "C09 (" + round(c09, 2) + ") presenta puntaje alto y sugiere senales cuantitativas asociadas a aprendizaje o seguimiento posterior."
                    : "C09 (" + round(c09, 2) + ") no presenta la senal cuantitativa definida para post-cierre.");
        insumos.put("tensiones_criticas_resumen", deterministic.get("tensiones_criticas_resumen"));
        insumos.put("inconsistencias_criticas_resumen", List.of());
        insumos.put("nivel_confiabilidad", confidence);
        deterministic.put("insumos_para_agente_4", insumos);

        return deterministic;
    }

    private Map<String, Object> simplifyFactor(Map<String, Object> m) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("item", m.get("item"));
        out.put("dimension", m.get("dimension"));
        out.put("promedio", m.get("promedio"));
        out.put("interpretacion", m.get("interpretacion_del_factor"));
        return out;
    }

    private Map<String, Object> factorMap(ItemStat s, String zonaLabel) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("item", s.item());
        m.put("dimension", s.dimension());
        m.put("promedio", s.promedio());
        m.put("interpretacion_del_factor", s.item() + " - " + ITEM_LABELS.get(s.item()) + " se ubica en zona "
                + zonaLabel + " con promedio " + s.promedio() + ".");
        return m;
    }

    private double nz(Object value) {
        return value instanceof Number n ? n.doubleValue() : 0.0;
    }

    private double sumRaw(List<ItemStat> itemStats, List<String> items) {
        double sum = 0;
        for (ItemStat s : itemStats) {
            if (items.contains(s.item()) && s.promedioRaw() != null) sum += s.promedioRaw();
        }
        return sum;
    }

    private Double findRaw(List<ItemStat> itemStats, String code) {
        return itemStats.stream().filter(s -> s.item().equals(code)).findFirst().map(ItemStat::promedioRaw).orElse(null);
    }

    private String inferDimension(String code) {
        if (code.startsWith("C")) return "Cultura";
        if (code.startsWith("E")) return "Equipo";
        if (code.startsWith("P")) return "Proyecto";
        return "N/A";
    }

    private String cleanIdoneidadItemCode(String value) {
        if (value == null) return null;
        Matcher matcher = IDONEIDAD_ITEM_RE.matcher(value);
        return matcher.find() ? matcher.group(1).toUpperCase() : null;
    }

    private Double normalizeIdoneidadScore(JsonNode value) {
        if (value == null || value.isNull()) return null;
        if (value.isNumber()) return value.asDouble();
        String normalized = value.asText("").trim().replace(",", ".");
        if (normalized.isEmpty()) return null;
        try {
            return Double.parseDouble(normalized);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private double round(double value, int decimals) {
        double factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }

    private Double average(List<Double> values) {
        if (values.isEmpty()) return null;
        return values.stream().mapToDouble(Double::doubleValue).average().orElse(0);
    }

    private double std(List<Double> values) {
        Double avg = average(values);
        if (avg == null) return 0;
        double variance = values.stream().mapToDouble(v -> Math.pow(v - avg, 2)).average().orElse(0);
        return Math.sqrt(variance);
    }

    private String zoneFromScore(Double score) {
        if (score == null) return "sin_datos";
        if (score <= 3) return "agil";
        if (score < 7) return "transicion";
        return "predictivo";
    }

    private String zoneLabel(String zone) {
        return switch (zone) {
            case "agil" -> "Zona agil";
            case "predictivo" -> "Zona predictiva";
            case "transicion" -> "Zona de transicion";
            default -> "No disponible";
        };
    }

    private String coherenceFromStd(double value) {
        if (value <= 1.5) return "Alta";
        if (value <= 2.5) return "Media";
        return "Baja";
    }

    private String behaviorFromStd(double value) {
        if (value <= 1.5) return "consistente";
        if (value <= 2.5) return "en_transicion";
        return "polarizado";
    }

    private Map<String, Object> buildDistribution(List<ScoreRecord> records, List<String> itemCodes) {
        List<ScoreRecord> selected = records.stream().filter(r -> itemCodes.contains(r.code())).toList();
        int total = selected.size();
        Map<String, Object> dist = new LinkedHashMap<>();
        dist.put("porcentaje_agil", total == 0 ? 0 : round((countWhere(selected, s -> s <= 3) * 100.0) / total, 1));
        dist.put("porcentaje_transicion", total == 0 ? 0 : round((countWhere(selected, s -> s >= 4 && s <= 6) * 100.0) / total, 1));
        dist.put("porcentaje_predictivo", total == 0 ? 0 : round((countWhere(selected, s -> s >= 7) * 100.0) / total, 1));
        return dist;
    }

    private long countWhere(List<ScoreRecord> records, java.util.function.DoublePredicate predicate) {
        return records.stream().filter(r -> predicate.test(r.score())).count();
    }

    private record CollectResult(List<ScoreRecord> records, List<RespondentAcc> respondents, List<String> invalidAlerts) {
    }

    private CollectResult collectRawScores(JsonNode inputEnvelope, List<String> csvTexts) {
        List<ScoreRecord> records = new ArrayList<>();
        List<String> invalidAlerts = new ArrayList<>();
        Map<String, RespondentAcc> respondentMap = new LinkedHashMap<>();

        AddScore addScore = (respondentId, name, role, codeValue, scoreValue, source) -> {
            String code = cleanIdoneidadItemCode(codeValue);
            if (code == null || !EXPECTED_ITEMS.contains(code)) return;
            RespondentAcc acc = respondentMap.computeIfAbsent(respondentId, id -> {
                RespondentAcc a = new RespondentAcc();
                a.respondentId = id;
                a.name = name;
                a.role = role;
                return a;
            });
            Double score = parseFlexibleDouble(scoreValue);
            if (score == null || score < 1 || score > 10) {
                invalidAlerts.add(respondentId + " - " + code + ": score fuera de rango o invalido (" + scoreValue + ")");
                return;
            }
            records.add(new ScoreRecord(respondentId, name, role, code, score, source));
            acc.scores.put(code, score);
        };

        JsonNode respondents = inputEnvelope != null ? inputEnvelope.path("payload").path("respondents") : null;
        if (respondents != null && respondents.isArray()) {
            int index = 0;
            for (JsonNode respondent : respondents) {
                index++;
                String respondentId = respondent.hasNonNull("respondent_id") ? respondent.get("respondent_id").asText()
                        : "r-" + String.format("%03d", index);
                String name = respondent.hasNonNull("name") ? respondent.get("name").asText() : "No disponible";
                String role = respondent.hasNonNull("role") ? respondent.get("role").asText() : "No disponible";
                respondentMap.computeIfAbsent(respondentId, id -> {
                    RespondentAcc a = new RespondentAcc();
                    a.respondentId = id;
                    a.name = name;
                    a.role = role;
                    return a;
                });
                JsonNode answers = respondent.path("answers");
                if (answers.isArray()) {
                    for (JsonNode answer : answers) {
                        String code = firstNonNullText(answer, "question_id", "question_code", "codigo", "item");
                        JsonNode scoreNode = firstNonNullNode(answer, "answer_score", "valor", "score");
                        addScore.apply(respondentId, name, role, code, scoreNode != null ? scoreNode.asText() : null, "online_survey");
                    }
                }
            }
        }

        int fileIndex = 0;
        for (String csvText : csvTexts) {
            fileIndex++;
            List<List<String>> rows = parseCsvRows(csvText);
            if (rows.size() < 2) continue;
            List<String> headers = rows.get(0);
            List<String> codes = headers.stream().map(this::cleanIdoneidadItemCode).toList();
            int nameIndex = indexOfMatching(headers, "(?i).*nombre.*");
            int roleIndex = indexOfMatching(headers, "(?i).*(cargo|rol).*");

            int rowIndex = 0;
            for (List<String> row : rows.subList(1, rows.size())) {
                rowIndex++;
                String respondentId = "csv-" + fileIndex + "-" + String.format("%03d", rowIndex);
                String name = nameIndex >= 0 && nameIndex < row.size() && !row.get(nameIndex).isBlank() ? row.get(nameIndex) : respondentId;
                String role = roleIndex >= 0 && roleIndex < row.size() && !row.get(roleIndex).isBlank() ? row.get(roleIndex) : "No disponible";
                respondentMap.computeIfAbsent(respondentId, id -> {
                    RespondentAcc a = new RespondentAcc();
                    a.respondentId = id;
                    a.name = name;
                    a.role = role;
                    return a;
                });
                for (int i = 0; i < row.size(); i++) {
                    String code = i < codes.size() ? codes.get(i) : null;
                    if (code != null) addScore.apply(respondentId, name, role, code, row.get(i), "csv");
                }
            }
        }

        return new CollectResult(records, new ArrayList<>(respondentMap.values()), invalidAlerts);
    }

    @FunctionalInterface
    private interface AddScore {
        void apply(String respondentId, String name, String role, String codeValue, String scoreValue, String source);
    }

    private Double parseFlexibleDouble(String value) {
        if (value == null) return null;
        String normalized = value.trim().replace(",", ".");
        if (normalized.isEmpty()) return null;
        try {
            return Double.parseDouble(normalized);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String firstNonNullText(JsonNode node, String... fields) {
        for (String f : fields) {
            JsonNode v = node.get(f);
            if (v != null && !v.isNull()) return v.asText();
        }
        return null;
    }

    private JsonNode firstNonNullNode(JsonNode node, String... fields) {
        for (String f : fields) {
            JsonNode v = node.get(f);
            if (v != null && !v.isNull() && !v.isMissingNode()) return v;
        }
        return null;
    }

    private int indexOfMatching(List<String> headers, String regex) {
        Pattern pattern = Pattern.compile(regex);
        for (int i = 0; i < headers.size(); i++) {
            if (pattern.matcher(headers.get(i)).matches()) return i;
        }
        return -1;
    }

    /** Parser CSV simple con soporte de comillas, puerto de parseCsvRows() en el original. */
    private List<List<String>> parseCsvRows(String csvText) {
        List<List<String>> rows = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        List<String> row = new ArrayList<>();
        boolean inQuotes = false;

        int i = 0;
        int len = csvText.length();
        while (i < len) {
            char c = csvText.charAt(i);
            Character next = i + 1 < len ? csvText.charAt(i + 1) : null;

            if (c == '"') {
                if (inQuotes && next != null && next == '"') {
                    current.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
                i++;
                continue;
            }

            if (c == ',' && !inQuotes) {
                row.add(current.toString().trim());
                current.setLength(0);
                i++;
                continue;
            }

            if ((c == '\n' || c == '\r') && !inQuotes) {
                if (c == '\r' && next != null && next == '\n') i++;
                row.add(current.toString().trim());
                current.setLength(0);
                if (row.stream().anyMatch(cell -> !cell.isEmpty())) rows.add(new ArrayList<>(row));
                row.clear();
                i++;
                continue;
            }

            current.append(c);
            i++;
        }
        row.add(current.toString().trim());
        if (row.stream().anyMatch(cell -> !cell.isEmpty())) rows.add(new ArrayList<>(row));
        return rows;
    }
}
