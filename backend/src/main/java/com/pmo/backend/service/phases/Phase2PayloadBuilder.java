package com.pmo.backend.service.phases;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.pmo.backend.domain.Entrevista;
import com.pmo.backend.repository.EntrevistaRepository;

/** Puerto de phases/phase2.ts (Asistente 2 - Entrevistas). */
@Component
public class Phase2PayloadBuilder implements PhasePayloadBuilder {

    private final EntrevistaRepository entrevistaRepository;
    private final PhasePayloadSupport support;
    private final ObjectMapper objectMapper;

    public Phase2PayloadBuilder(EntrevistaRepository entrevistaRepository, PhasePayloadSupport support, ObjectMapper objectMapper) {
        this.entrevistaRepository = entrevistaRepository;
        this.support = support;
        this.objectMapper = objectMapper;
    }

    @Override
    public int phaseNumber() {
        return 2;
    }

    @Override
    public PhasePayloadResult build(PhasePayloadContext ctx) {
        List<Entrevista> entrevistas = entrevistaRepository.findByProyectoIdOrderByCreatedAtAsc(ctx.projectId());
        List<FileRef> fileUrls = new ArrayList<>();
        ArrayNode interviews = objectMapper.createArrayNode();

        int idx = 0;
        for (Entrevista e : entrevistas) {
            idx++;
            String interviewId = "int-" + String.format("%03d", idx);
            String fileType = e.getStoragePath() != null ? PhasePayloadSupport.fileTypeFromPath(e.getStoragePath()) : null;

            ObjectNode attachment = null;
            if (e.getStoragePath() != null) {
                attachment = objectMapper.createObjectNode();
                attachment.put("file_name", e.getFileName() != null ? e.getFileName() : "Archivo adjunto sin nombre");
                attachment.put("file_format", "text/csv".equals(fileType) ? "csv" : "pdf");
                attachment.put("traceability_note", "El contenido del archivo adjunto corresponde a la entrevista " + interviewId + ".");

                String urlToUse = support.ensureFreshUrl(e.getStoragePath());
                String label = String.join("\n",
                        "Archivo adjunto de entrevista",
                        "interview_id: " + interviewId,
                        "interviewee_name: " + (e.getNombre() != null ? e.getNombre() : "No disponible"),
                        "interviewee_role: " + (e.getCargo() != null ? e.getCargo() : "No disponible"),
                        "interviewee_area: " + (e.getArea() != null ? e.getArea() : "No disponible"),
                        "file_name: " + (e.getFileName() != null ? e.getFileName() : "No disponible"));
                fileUrls.add(new FileRef(urlToUse, fileType != null ? fileType : "application/pdf", label));
            }

            ObjectNode interview = objectMapper.createObjectNode();
            interview.put("interview_id", interviewId);
            interview.put("interviewee_name", e.getNombre());
            interview.put("interviewee_role", e.getCargo() != null ? e.getCargo() : e.getArea());
            interview.put("interviewee_area", e.getArea());
            interview.put("interview_date", e.getCreatedAt() != null ? e.getCreatedAt().toString() : null);
            interview.set("attachment", attachment != null ? attachment : objectMapper.nullNode());

            ArrayNode answers = interview.putArray("answers");
            ObjectNode answer = answers.addObject();
            answer.put("question_id", "q-general");
            answer.put("question_text", "Notas de la entrevista libre");
            String answerText = e.getStoragePath() != null
                    ? "(Ver archivo adjunto asociado a " + interviewId + ": " + e.getFileName() + "). "
                        + (e.getNotas() != null && !e.getNotas().isBlank() ? e.getNotas() : "No se registraron notas textuales adicionales para esta entrevista.")
                    : e.getNotas();
            answer.put("answer_text", answerText);

            interviews.add(interview);
        }

        ObjectNode metadata = ctx.baseMetadata().deepCopy();
        metadata.put("agent_id", "asistente-2");

        ObjectNode payload = objectMapper.createObjectNode();
        payload.set("organization_context", support.organizationContext(ctx.projectId()));
        payload.set("interviews", interviews);
        payload.put("total_interviews", interviews.size());

        return new PhasePayloadResult(metadata, payload, ctx.comments(), fileUrls);
    }
}
