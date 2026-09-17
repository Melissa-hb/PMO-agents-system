package com.pmo.backend.service.phases;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.pmo.backend.domain.BancoPregunta;
import com.pmo.backend.domain.EncuestaRespuesta;
import com.pmo.backend.repository.BancoPreguntaRepository;
import com.pmo.backend.repository.EncuestaRespuestaRepository;

/** Puerto de phases/phase3.ts (Asistente 3 - Idoneidad). */
@Component
public class Phase3PayloadBuilder implements PhasePayloadBuilder {

    private final EncuestaRespuestaRepository respuestaRepository;
    private final BancoPreguntaRepository bancoPreguntaRepository;
    private final PhasePayloadSupport support;
    private final ObjectMapper objectMapper;

    public Phase3PayloadBuilder(EncuestaRespuestaRepository respuestaRepository, BancoPreguntaRepository bancoPreguntaRepository,
                                 PhasePayloadSupport support, ObjectMapper objectMapper) {
        this.respuestaRepository = respuestaRepository;
        this.bancoPreguntaRepository = bancoPreguntaRepository;
        this.support = support;
        this.objectMapper = objectMapper;
    }

    @Override
    public int phaseNumber() {
        return 3;
    }

    @Override
    public PhasePayloadResult build(PhasePayloadContext ctx) {
        List<EncuestaRespuesta> respuestas = respuestaRepository
                .findByProyectoIdAndTipoEncuestaOrderByCreatedAtDesc(ctx.projectId(), "idoneidad");
        Map<String, BancoPregunta> questionByCode = bancoPreguntaRepository.findByTipoEncuestaOrderByCodigoAsc("idoneidad")
                .stream().collect(Collectors.toMap(BancoPregunta::getCodigo, q -> q, (a, b) -> a));

        ArrayNode formattedRespondents = objectMapper.createArrayNode();
        int idx = 0;
        for (EncuestaRespuesta r : respuestas) {
            idx++;
            ObjectNode respondent = objectMapper.createObjectNode();
            respondent.put("respondent_id", "r-" + String.format("%03d", idx));
            respondent.put("name", r.getNombreEncuestado());
            respondent.put("role", r.getCargoEncuestado());
            respondent.put("area", r.getAreaEncuestado() != null && !r.getAreaEncuestado().isBlank() ? r.getAreaEncuestado() : "Sin area");

            ArrayNode answers = objectMapper.createArrayNode();
            if (r.getRespuestas() != null && r.getRespuestas().isArray()) {
                for (JsonNode ans : r.getRespuestas()) {
                    String codigo = ans.path("codigo").asText(null);
                    BancoPregunta question = codigo != null ? questionByCode.get(codigo) : null;
                    ObjectNode a = objectMapper.createObjectNode();
                    a.put("question_id", codigo);
                    a.put("question_code", codigo);
                    a.put("question_text", question != null ? question.getTextoPregunta() : "No disponible");
                    a.set("answer_value", ans.path("valor"));
                    a.set("answer_score", ans.path("valor"));
                    answers.add(a);
                }
            }
            respondent.set("answers", answers);
            formattedRespondents.add(respondent);
        }

        List<FileRef> fileUrls = new ArrayList<>();
        if (ctx.externalFileUrl() != null && !ctx.externalFileUrl().isBlank()) {
            String freshUrl = support.ensureFreshUrl(ctx.externalFileUrl());
            String fileType = PhasePayloadSupport.fileTypeFromPath(ctx.externalFileUrl());
            String fileName = URLDecoder.decode(ctx.externalFileUrl().split("\\?")[0], StandardCharsets.UTF_8);
            fileName = fileName.contains("/") ? fileName.substring(fileName.lastIndexOf('/') + 1) : fileName;
            String label = String.join("\n",
                    "Archivo externo de fase 3 - encuesta de idoneidad",
                    "input_method: " + (formattedRespondents.size() > 0 ? "mixed" : "offline_file"),
                    "file_name: " + fileName,
                    "file_format: " + ("text/csv".equals(fileType) ? "csv" : "pdf"),
                    "scale: 1-10");
            fileUrls.add(new FileRef(freshUrl, fileType, label));
        }

        ObjectNode metadata = ctx.baseMetadata().deepCopy();
        metadata.put("agent_id", "asistente-3");

        String inputMethod = ctx.externalFileUrl() != null && !ctx.externalFileUrl().isBlank()
                ? (formattedRespondents.size() > 0 ? "mixed" : "offline_file")
                : "online_survey";

        ObjectNode payload = objectMapper.createObjectNode();
        payload.set("organization_context", support.organizationContext(ctx.projectId()));
        payload.put("input_method", inputMethod);
        payload.set("respondents", formattedRespondents);
        payload.put("survey_completed_at", ctx.now().toString());

        return new PhasePayloadResult(metadata, payload, ctx.comments(), fileUrls);
    }
}
