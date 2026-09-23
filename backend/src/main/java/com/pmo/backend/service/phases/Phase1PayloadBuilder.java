package com.pmo.backend.service.phases;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.pmo.backend.domain.Documento;
import com.pmo.backend.repository.DocumentoRepository;

/** Puerto de phases/phase1.ts (Asistente 1 - Documentacion). */
@Component
public class Phase1PayloadBuilder implements PhasePayloadBuilder {

    private static final Pattern PREDEFINED = Pattern.compile("^D\\d+$");
    private static final Map<String, String> CATEGORY_LABELS = Map.ofEntries(
            Map.entry("D01", "Organigrama"),
            Map.entry("D02", "Artefactos de Gestión de proyectos"),
            Map.entry("D03", "Plataformas y Sistemas"),
            Map.entry("D04", "Listado de Proyectos"),
            Map.entry("D05", "Listado de lideres del proyecto"),
            Map.entry("D06", "Proyecto mejor documentado"),
            Map.entry("D07", "Resultados Estratégicos"),
            Map.entry("D08", "Resultados financieros"),
            Map.entry("D09", "Mapa de Procesos"),
            Map.entry("D10", "Filosofia organizacional"),
            Map.entry("D11", "Modelo de Negocio"),
            Map.entry("D12", "Arquitectura Organizacional/TI"),
            Map.entry("D13", "Metodología de Gestión de Proyectos"),
            Map.entry("D14", "Portafolio de Productos/Servicios"),
            Map.entry("D15", "Segmentos de clientes"),
            Map.entry("D16", "Otros")
    );

    /** Documentos visuales: su estructura grafica importa, nunca se reemplazan por texto. */
    private static final Set<String> VISUAL_CATEGORIES = Set.of("D01", "D09", "D12");
    /** Un diagnostico documental no necesita cada pagina de un manual extenso. */
    private static final int MAX_PDF_PAGES_PER_DOCUMENT = 30;

    private final DocumentoRepository documentoRepository;
    private final PhasePayloadSupport support;
    private final ObjectMapper objectMapper;

    public Phase1PayloadBuilder(DocumentoRepository documentoRepository, PhasePayloadSupport support, ObjectMapper objectMapper) {
        this.documentoRepository = documentoRepository;
        this.support = support;
        this.objectMapper = objectMapper;
    }

    @Override
    public int phaseNumber() {
        return 1;
    }

    @Override
    public PhasePayloadResult build(PhasePayloadContext ctx) {
        List<Documento> docs = documentoRepository.findByProyectoId(ctx.projectId());
        List<FileRef> fileUrls = new ArrayList<>();
        ArrayNode documents = objectMapper.createArrayNode();

        int idx = 0;
        for (Documento d : docs) {
            idx++;
            String rawStoragePath = d.getStoragePath() != null ? d.getStoragePath() : "";
            String ext = rawStoragePath.split("\\?")[0];
            ext = ext.contains(".") ? ext.substring(ext.lastIndexOf('.') + 1).toLowerCase() : "pdf";

            String documentId = "doc-" + String.format("%03d", idx);
            String documentName = d.getNombrePersonalizado() != null ? d.getNombrePersonalizado() : d.getStoragePath();
            String categoryCode = d.getCategoria() != null ? d.getCategoria() : "D16";

            if (!rawStoragePath.isBlank()) {
                String urlToUse = support.ensureFreshUrl(rawStoragePath);
                String label = String.join("\n",
                        "document_id: " + documentId,
                        "document_name: " + documentName,
                        "category: " + categoryCode + " (" + CATEGORY_LABELS.getOrDefault(categoryCode, "Otro") + ")");
                fileUrls.add(new FileRef(urlToUse, PhasePayloadSupport.fileTypeFromPath(rawStoragePath), label,
                        new FileRef.PdfPolicy(MAX_PDF_PAGES_PER_DOCUMENT, VISUAL_CATEGORIES.contains(categoryCode))));
            }

            boolean isPredefined = PREDEFINED.matcher(categoryCode).matches() && !categoryCode.equals("D16");

            ObjectNode doc = objectMapper.createObjectNode();
            doc.put("document_id", documentId);
            doc.put("document_name", documentName);
            doc.put("document_type", isPredefined ? "predefined" : "custom");
            doc.put("category", categoryCode);
            doc.put("category_label", CATEGORY_LABELS.getOrDefault(categoryCode, "Otro"));
            doc.put("file_format", ext);
            doc.put("file_size_kb", d.getMetadatos() != null ? d.getMetadatos().path("size_kb").asInt(0) : 0);
            doc.put("uploaded_at", d.getCreatedAt() != null ? d.getCreatedAt().toString() : null);
            documents.add(doc);
        }

        ObjectNode metadata = ctx.baseMetadata().deepCopy();
        metadata.put("agent_id", "asistente-1");

        ObjectNode payload = objectMapper.createObjectNode();
        payload.set("organization_context", support.organizationContext(ctx.projectId()));
        payload.set("documents", documents);
        payload.put("total_documents", documents.size());

        return new PhasePayloadResult(metadata, payload, ctx.comments(), fileUrls);
    }
}
