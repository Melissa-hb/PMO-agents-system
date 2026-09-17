package com.pmo.backend.service.phases;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.pmo.backend.domain.EncuestaRespuesta;
import com.pmo.backend.domain.FaseEstado;
import com.pmo.backend.repository.EncuestaRespuestaRepository;
import com.pmo.backend.repository.FaseEstadoRepository;

/** Puerto de phases/phase5.ts (Asistente 5 - Madurez). */
@Component
public class Phase5PayloadBuilder implements PhasePayloadBuilder {

    private static final Set<String> OPEN_KEYWORDS = Set.of("open", "abierta", "comentario");

    private final FaseEstadoRepository faseEstadoRepository;
    private final EncuestaRespuestaRepository respuestaRepository;
    private final PhasePayloadSupport support;
    private final ObjectMapper objectMapper;

    public Phase5PayloadBuilder(FaseEstadoRepository faseEstadoRepository, EncuestaRespuestaRepository respuestaRepository,
                                 PhasePayloadSupport support, ObjectMapper objectMapper) {
        this.faseEstadoRepository = faseEstadoRepository;
        this.respuestaRepository = respuestaRepository;
        this.support = support;
        this.objectMapper = objectMapper;
    }

    @Override
    public int phaseNumber() {
        return 5;
    }

    @Override
    public PhasePayloadResult build(PhasePayloadContext ctx) {
        JsonNode fase4Datos = faseEstadoRepository.findByProyectoIdAndNumeroFase(ctx.projectId(), 4)
                .map(FaseEstado::getDatosConsolidados).orElse(null);

        List<EncuestaRespuesta> respPredictiva = respuestaRepository
                .findByProyectoIdAndTipoEncuestaOrderByCreatedAtDesc(ctx.projectId(), "predictiva");
        List<EncuestaRespuesta> respAgil = respuestaRepository
                .findByProyectoIdAndTipoEncuestaOrderByCreatedAtDesc(ctx.projectId(), "agil");

        JsonNode phase4Diagnosis = extractPhase4Diagnosis(fase4Datos);
        String pmoTypeFromComments = ctx.comments() != null ? ctx.comments().path("pmoType").asText(null) : null;
        String rawPmoType = pmoTypeFromComments != null ? pmoTypeFromComments
                : phase4Diagnosis != null && phase4Diagnosis.hasNonNull("pmo_type") ? phase4Diagnosis.get("pmo_type").asText()
                : phase4Diagnosis != null && phase4Diagnosis.hasNonNull("pmoType") ? phase4Diagnosis.get("pmoType").asText()
                : "Hibrido";
        String pmoType = normalizePmoType(rawPmoType);
        ObjectNode weights = extractPhase4Weights(phase4Diagnosis, pmoType);

        List<FileRef> fileUrls = new ArrayList<>();
        List<String> urls = new ArrayList<>();
        if (ctx.externalFileUrl() != null && !ctx.externalFileUrl().isBlank()) urls.add(ctx.externalFileUrl());
        if (ctx.extraFileUrls() != null) urls.addAll(ctx.extraFileUrls());
        for (String url : urls) {
            String fresh = support.ensureFreshUrl(url);
            fileUrls.add(new FileRef(fresh, PhasePayloadSupport.fileTypeFromPath(url), null));
        }

        ObjectNode metadata = ctx.baseMetadata().deepCopy();
        metadata.put("agent_id", "asistente-5");

        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("approved_pmo_type", pmoType);
        payload.set("approved_phase4_weights", weights);

        ObjectNode maturitySurveys = payload.putObject("maturity_surveys");
        maturitySurveys.set("predictive", surveyNode("predictive", respPredictiva));
        maturitySurveys.set("agile", surveyNode("agile", respAgil));

        JsonNode fase4Diagnosis2 = fase4Datos != null && fase4Datos.hasNonNull("diagnosis") ? fase4Datos.get("diagnosis")
                : fase4Datos != null ? fase4Datos : objectMapper.nullNode();
        payload.set("fase4_diagnostico_referencia", fase4Diagnosis2);

        JsonNode consultantComment = ctx.comments() != null ? ctx.comments().path("comentario_consultor") : null;

        return new PhasePayloadResult(metadata, payload,
                consultantComment != null && !consultantComment.isMissingNode() ? consultantComment : objectMapper.nullNode(),
                fileUrls);
    }

    private ObjectNode surveyNode(String surveyType, List<EncuestaRespuesta> respuestas) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("survey_type", surveyType);
        node.put("input_method", respuestas.isEmpty() ? "bulk_upload" : "online_survey");
        node.set("answers", formatMaturityAnswers(respuestas));
        return node;
    }

    private ArrayNode formatMaturityAnswers(List<EncuestaRespuesta> respuestas) {
        ArrayNode array = objectMapper.createArrayNode();
        int idx = 0;
        for (EncuestaRespuesta r : respuestas) {
            idx++;
            ObjectNode item = objectMapper.createObjectNode();
            item.put("respondent_id", "r-" + String.format("%03d", idx));
            item.put("name", r.getNombreEncuestado() != null ? r.getNombreEncuestado() : "");
            item.put("role", r.getCargoEncuestado() != null ? r.getCargoEncuestado() : "");

            ObjectNode responses = objectMapper.createObjectNode();
            String openQuestion = "";
            if (r.getRespuestas() != null && r.getRespuestas().isArray()) {
                int ansIdx = 0;
                for (JsonNode ans : r.getRespuestas()) {
                    ansIdx++;
                    String code = firstNonBlank(ans, "codigo", "id", "pregunta_id", "pregunta_codigo", "pregunta");
                    if (code == null) code = "Pregunta_" + ansIdx;
                    String normalizedCode = code.trim().toLowerCase();
                    boolean isOpen = OPEN_KEYWORDS.stream().anyMatch(normalizedCode::contains);
                    Double numeric = coerceNumeric(firstNonNullNode(ans, "valor", "respuesta", "value"));
                    if (isOpen) {
                        String text = firstNonBlank(ans, "valor", "respuesta", "texto", "comentario");
                        if (text != null && !text.isBlank()) openQuestion = text.trim();
                        continue;
                    }
                    if (numeric != null && !normalizedCode.isBlank()) {
                        responses.put(code, numeric);
                    }
                }
            }
            item.set("responses", responses);
            item.put("open_question", openQuestion);
            array.add(item);
        }
        return array;
    }

    private String firstNonBlank(JsonNode node, String... fields) {
        for (String f : fields) {
            JsonNode v = node.get(f);
            if (v != null && !v.isNull() && !v.asText().isBlank()) return v.asText();
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

    private Double coerceNumeric(JsonNode value) {
        if (value == null) return null;
        if (value.isNumber()) return value.asDouble();
        if (value.isTextual() && !value.asText().isBlank()) {
            try {
                return Double.parseDouble(value.asText().trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private JsonNode extractPhase4Diagnosis(JsonNode fase4Datos) {
        if (fase4Datos == null) return null;
        return fase4Datos.hasNonNull("diagnosis") && fase4Datos.get("diagnosis").isObject() ? fase4Datos.get("diagnosis") : fase4Datos;
    }

    private ObjectNode extractPhase4Weights(JsonNode phase4Diagnosis, String pmoType) {
        ObjectNode weights = objectMapper.createObjectNode();
        JsonNode breakdown = phase4Diagnosis != null
                ? (phase4Diagnosis.hasNonNull("type_breakdown") ? phase4Diagnosis.get("type_breakdown")
                    : phase4Diagnosis.hasNonNull("typeBreakdown") ? phase4Diagnosis.get("typeBreakdown") : null)
                : null;

        Double agile = breakdown != null ? numericOrNull(breakdown, "agile_weight", "agileWeight") : null;
        Double predictive = breakdown != null ? numericOrNull(breakdown, "predictive_weight", "predictiveWeight") : null;

        if (agile != null && predictive != null) {
            weights.put("agile_weight", agile);
            weights.put("predictive_weight", predictive);
            return weights;
        }

        if ("Agil".equals(pmoType)) {
            weights.put("agile_weight", 100);
            weights.put("predictive_weight", 0);
        } else if ("Predictivo".equals(pmoType)) {
            weights.put("agile_weight", 0);
            weights.put("predictive_weight", 100);
        } else {
            weights.put("agile_weight", 0);
            weights.put("predictive_weight", 0);
        }
        return weights;
    }

    private Double numericOrNull(JsonNode node, String... fields) {
        for (String f : fields) {
            JsonNode v = node.get(f);
            if (v != null && v.isNumber()) return v.asDouble();
        }
        return null;
    }

    private String normalizePmoType(String value) {
        String token = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase();
        if (token.contains("agil")) return "Agil";
        if (token.contains("predict")) return "Predictivo";
        return "Hibrido";
    }
}
