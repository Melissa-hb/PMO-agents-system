package com.pmo.backend.service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.pmo.backend.domain.ConfiguracionAgente;
import com.pmo.backend.domain.FaseEstado;
import com.pmo.backend.dto.RunPhaseRequest;
import com.pmo.backend.dto.RunPhaseResponse;
import com.pmo.backend.repository.ConfiguracionAgenteRepository;
import com.pmo.backend.repository.FaseEstadoRepository;
import com.pmo.backend.service.ai.AiFallbackService;
import com.pmo.backend.service.ai.AiGenerateResult;
import com.pmo.backend.service.ai.AiModelSettingsService;
import com.pmo.backend.service.ai.AiPart;
import com.pmo.backend.service.ai.GenerationConfig;
import com.pmo.backend.service.ai.NormalizedAiModelSettings;
import com.pmo.backend.service.ai.TokenUsageRecorder;
import com.pmo.backend.service.phases.FileRef;
import com.pmo.backend.service.phases.Phase7Sections;
import com.pmo.backend.service.phases.PhasePayloadBuilder;
import com.pmo.backend.service.phases.PhasePayloadContext;
import com.pmo.backend.service.phases.PhasePayloadResult;
import com.pmo.backend.service.phases.Phase3CompletionService;

/**
 * Puerto Java del nucleo de la Edge Function `pmo-agent` (index.ts: runAgent() + el handler
 * serve()). Cubre las fases 1,2,3,4,5,6,7 y 9 con el flujo generico (prompt guardado en
 * configuracion_agentes + fallback de modelos + guardado en fases_estado), igual que el
 * original. La UNICA simplificacion deliberada es la fase 7: aqui se genera con una sola
 * llamada (una fase 7OutputInstruction identica a la original) en vez de dividirse en 9
 * sub-llamadas (7.1A..7.2F, index.ts lineas 141-223 y 1002-1394). Si en produccion la guia
 * sale truncada por limite de tokens, ese split es el siguiente paso a portar.
 */
@Service
public class PmoAgentService {

    private static final Set<Integer> RUN_TRACKED_PHASES = Set.of(4, 5, 6, 9);
    /**
     * Fases de clasificacion/extraccion (3.1 = preguntas de entrevista, 4 = tipo de PMO) que no
     * necesitan razonamiento extendido: se ejecutan con thinkingBudget=0 para no pagar esos tokens.
     */
    private static final Set<Integer> CLASSIFICATION_PHASES = Set.of(4, 9);

    private final ConfiguracionAgenteRepository configuracionAgenteRepository;
    private final FaseEstadoRepository faseEstadoRepository;
    private final AiModelSettingsService aiModelSettingsService;
    private final AiFallbackService aiFallbackService;
    private final Phase3CompletionService phase3CompletionService;
    private final Map<Integer, PhasePayloadBuilder> buildersByPhase;
    private final ObjectMapper objectMapper;
    private final WebClient.Builder webClientBuilder;
    private final Executor pmoAgentExecutor;
    private final TokenUsageRecorder tokenUsageRecorder;
    private final PdfAttachmentOptimizer pdfAttachmentOptimizer;
    private final PromptCompactor promptCompactor;

    public PmoAgentService(ConfiguracionAgenteRepository configuracionAgenteRepository,
                            FaseEstadoRepository faseEstadoRepository,
                            AiModelSettingsService aiModelSettingsService,
                            AiFallbackService aiFallbackService,
                            Phase3CompletionService phase3CompletionService,
                            List<PhasePayloadBuilder> builders,
                            ObjectMapper objectMapper,
                            WebClient.Builder webClientBuilder,
                            @org.springframework.beans.factory.annotation.Qualifier("pmoAgentExecutor") Executor pmoAgentExecutor,
                            TokenUsageRecorder tokenUsageRecorder,
                            PdfAttachmentOptimizer pdfAttachmentOptimizer,
                            PromptCompactor promptCompactor) {
        this.configuracionAgenteRepository = configuracionAgenteRepository;
        this.faseEstadoRepository = faseEstadoRepository;
        this.aiModelSettingsService = aiModelSettingsService;
        this.aiFallbackService = aiFallbackService;
        this.phase3CompletionService = phase3CompletionService;
        this.buildersByPhase = builders.stream().collect(Collectors.toMap(PhasePayloadBuilder::phaseNumber, b -> b));
        this.objectMapper = objectMapper;
        this.webClientBuilder = webClientBuilder;
        this.pmoAgentExecutor = pmoAgentExecutor;
        this.tokenUsageRecorder = tokenUsageRecorder;
        this.pdfAttachmentOptimizer = pdfAttachmentOptimizer;
        this.promptCompactor = promptCompactor;
    }

    private record PhaseRunResult(JsonNode diagnosis, String processingTime, boolean cancelled) {
    }

    // ── Entrypoint equivalente al handler serve() de index.ts ──────────────────────────────

    public RunPhaseResponse runPhase(UUID projectId, int phaseNumber, RunPhaseRequest request) {
        int iteration = request.iteration() != null ? request.iteration() : 1;

        JsonNode resolvedComments;
        if (phaseNumber == 5) {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("pmoType", request.pmoType());
            node.put("comentario_consultor", request.comentarioConsultor());
            resolvedComments = node;
        } else if (request.comments() != null && !request.comments().isNull()) {
            resolvedComments = request.comments();
        } else if (request.comentarioConsultor() != null && !request.comentarioConsultor().isBlank()) {
            resolvedComments = objectMapper.valueToTree(request.comentarioConsultor());
        } else {
            resolvedComments = null;
        }

        List<String> extraFileUrls = new ArrayList<>();
        if (request.predictivaFileUrl() != null) extraFileUrls.add(request.predictivaFileUrl());
        if (request.agilFileUrl() != null) extraFileUrls.add(request.agilFileUrl());
        if (request.predictivaFileUrls() != null) extraFileUrls.addAll(request.predictivaFileUrls());
        if (request.agilFileUrls() != null) extraFileUrls.addAll(request.agilFileUrls());

        if (phaseNumber == 7 && resolvedComments == null) {
            FaseEstado existing = faseEstadoRepository.findByProyectoIdAndNumeroFase(projectId, 7).orElse(null);
            JsonNode existingData = existing != null ? existing.getDatosConsolidados() : null;
            boolean hasExistingGuide = existing != null
                    && ("disponible".equals(existing.getEstadoVisual()) || "completado".equals(existing.getEstadoVisual()))
                    && ProcessingUtils.hasMeaningfulData(existingData)
                    && !(existingData.isObject() && existingData.path("_error").asBoolean(false));
            if (hasExistingGuide) {
                return RunPhaseResponse.cached(phaseNumber, existingData);
            }
        }

        JsonNode commentsForAgent = resolvedComments;
        if (phaseNumber == 7 && resolvedComments != null) {
            FaseEstado existing = faseEstadoRepository.findByProyectoIdAndNumeroFase(projectId, 7).orElse(null);
            JsonNode existingGuide = existing != null ? existing.getDatosConsolidados() : null;
            if (ProcessingUtils.hasMeaningfulData(existingGuide) && !(existingGuide.isObject() && existingGuide.path("_error").asBoolean(false))) {
                ObjectNode wrapped = objectMapper.createObjectNode();
                wrapped.put("comments", extractCommentText(resolvedComments));
                wrapped.set("current_guide_for_revision", existingGuide);
                wrapped.set("latest_version", existingGuide.path("_latest_version"));
                if (resolvedComments.isObject() && resolvedComments.has("target_sections")) {
                    wrapped.set("target_sections", resolvedComments.get("target_sections"));
                }
                commentsForAgent = wrapped;
            }
        }

        String runId = null;

        if (phaseNumber == 4 && iteration <= 1 && resolvedComments == null) {
            FaseEstado existing = faseEstadoRepository.findByProyectoIdAndNumeroFase(projectId, 4).orElse(null);
            if (existing != null && ProcessingUtils.hasCompletedPhaseData(existing.getDatosConsolidados())) {
                return RunPhaseResponse.cached(phaseNumber, existing.getDatosConsolidados());
            }
            if (existing != null && "procesando".equals(existing.getEstadoVisual()) && !ProcessingUtils.isProcessingStale(existing.getUpdatedAt())) {
                return RunPhaseResponse.inProgress(phaseNumber, existing.getDatosConsolidados());
            }
        }

        if (phaseNumber == 6 && iteration <= 1 && resolvedComments == null) {
            FaseEstado existing = faseEstadoRepository.findByProyectoIdAndNumeroFase(projectId, 6).orElse(null);
            JsonNode existingData = existing != null ? existing.getDatosConsolidados() : null;
            boolean hasExistingDiagnosis = existing != null
                    && ("disponible".equals(existing.getEstadoVisual()) || "completado".equals(existing.getEstadoVisual()))
                    && ProcessingUtils.hasCompletedPhaseData(existingData);
            if (hasExistingDiagnosis) {
                return RunPhaseResponse.cached(phaseNumber, existingData);
            }
            boolean freshProcessing = existing != null && "procesando".equals(existing.getEstadoVisual())
                    && ProcessingUtils.isProcessingMarker(existingData) && !ProcessingUtils.isProcessingStale(existing.getUpdatedAt());
            if (freshProcessing) {
                return RunPhaseResponse.inProgress(phaseNumber, existingData);
            }
        }

        if (RUN_TRACKED_PHASES.contains(phaseNumber)) {
            runId = ProcessingUtils.createRunId(phaseNumber);
        }

        upsertProcessing(projectId, phaseNumber, runId);

        PhaseRunResult result;
        try {
            result = runAgent(projectId, phaseNumber, iteration, commentsForAgent, request.externalFileUrl(), extraFileUrls, runId);
        } catch (Exception ex) {
            String message = ex.getMessage() != null ? ex.getMessage() : "Error desconocido ejecutando el agente";
            JsonNode previousGuide = phaseNumber == 7 && commentsForAgent != null && commentsForAgent.isObject()
                    ? commentsForAgent.get("current_guide_for_revision") : null;
            if (previousGuide != null && previousGuide.isObject()) {
                // Un ajuste fallido no debe borrar la guia: se restaura la version anterior.
                ObjectNode restored = ((ObjectNode) previousGuide).deepCopy();
                restored.put("_last_adjust_error", message);
                saveFaseEstado(projectId, 7, "disponible", restored);
            } else {
                saveError(projectId, phaseNumber, message);
            }
            throw ex;
        }

        if (phaseNumber == 3) {
            pmoAgentExecutor.execute(() -> safeRun(() -> checkAndTriggerPhase4(projectId)));
        }
        if (phaseNumber == 1) {
            pmoAgentExecutor.execute(() -> safeRun(() -> triggerAgent9(projectId)));
        }

        return RunPhaseResponse.ok(phaseNumber, result.processingTime(), result.diagnosis());
    }

    private void safeRun(Runnable job) {
        try {
            job.run();
        } catch (Exception e) {
            // Espejo de los catch silenciosos de scheduleBackground()/waitUntil() en el original: se registra y no se propaga.
            System.err.println("[pmo-agent] Error en job en background: " + e.getMessage());
        }
    }

    // ── checkAndTriggerPhase4 / auto-trigger del Agente 9 ───────────────────────────────────

    public void checkAndTriggerPhase4(UUID projectId) {
        List<FaseEstado> fases = faseEstadoRepository.findByProyectoIdAndNumeroFaseIn(projectId, List.of(1, 2, 3));
        boolean allCompleted = fases.size() == 3 && fases.stream().allMatch(f -> "completado".equals(f.getEstadoVisual()));
        if (!allCompleted) return;

        FaseEstado phase4 = faseEstadoRepository.findByProyectoIdAndNumeroFase(projectId, 4).orElse(null);
        if (phase4 != null && ProcessingUtils.hasCompletedPhaseData(phase4.getDatosConsolidados())) return;
        boolean alreadyProcessing = phase4 != null && "procesando".equals(phase4.getEstadoVisual())
                && !ProcessingUtils.isProcessingStale(phase4.getUpdatedAt());
        if (alreadyProcessing) return;

        String runId = ProcessingUtils.createRunId(4);
        try {
            upsertProcessing(projectId, 4, runId);
            runAgent(projectId, 4, 1, null, null, List.of(), runId);
        } catch (Exception e) {
            saveError(projectId, 4, e.getMessage() != null ? e.getMessage() : "Error desconocido ejecutando Fase 4");
        }
    }

    public void triggerAgent9(UUID projectId) {
        String runId = ProcessingUtils.createRunId(9);
        try {
            upsertProcessing(projectId, 9, runId);
            runAgent(projectId, 9, 1, null, null, List.of(), runId);
        } catch (Exception e) {
            saveError(projectId, 9, e.getMessage() != null ? e.getMessage() : "Error desconocido ejecutando Agente 9");
        }
    }

    // ── runAgent(): el nucleo que arma el prompt, llama a la IA y guarda el resultado ──────

    protected PhaseRunResult runAgent(UUID projectId, int phaseNumber, int iteration, JsonNode comments,
                                       String externalFileUrl, List<String> extraFileUrls, String runId) {
        ConfiguracionAgente agentConfig = configuracionAgenteRepository.findByFaseNumero(phaseNumber)
                .orElseThrow(() -> new IllegalStateException("Sin configuracion para fase " + phaseNumber
                        + ". Verifica que existe una fila en configuracion_agentes con fase_numero=" + phaseNumber + "."));
        if (agentConfig.getPromptSistema() == null || agentConfig.getPromptSistema().isBlank()) {
            throw new IllegalStateException("La configuracion para fase " + phaseNumber
                    + " existe pero prompt_sistema esta vacio. Actualiza el prompt en la tabla configuracion_agentes.");
        }

        if (phaseNumber != 3) {
            String activeRunId = runId != null ? runId : ProcessingUtils.createRunId(phaseNumber);
            upsertProcessing(projectId, phaseNumber, RUN_TRACKED_PHASES.contains(phaseNumber) ? activeRunId : null);
            runId = activeRunId;
        }

        PhasePayloadBuilder builder = buildersByPhase.get(phaseNumber);
        ObjectNode baseMetadata = objectMapper.createObjectNode();
        baseMetadata.put("project_id", projectId.toString());
        baseMetadata.put("phase", phaseNumber);
        baseMetadata.put("agent_id", "agente-" + phaseNumber);
        baseMetadata.put("timestamp", OffsetDateTime.now().toString());
        baseMetadata.put("iteration", iteration);

        PhasePayloadContext ctx = new PhasePayloadContext(projectId, iteration, comments, externalFileUrl, extraFileUrls,
                OffsetDateTime.now(), baseMetadata);

        PhasePayloadResult payloadResult = builder != null
                ? builder.build(ctx)
                : new PhasePayloadResult(baseMetadata, objectMapper.createObjectNode(), comments, List.of());

        ObjectNode inputEnvelope = objectMapper.createObjectNode();
        inputEnvelope.set("metadata", payloadResult.metadata());
        inputEnvelope.set("payload", payloadResult.payload());
        inputEnvelope.set("comments", payloadResult.comments() != null ? payloadResult.comments() : objectMapper.nullNode());

        boolean isPartialPhase7 = phaseNumber == 7
                && "partial".equals(payloadResult.metadata().path("revision_mode").asText(null));

        // Orden pensado para la cache implicita de Gemini: primero lo que es identico entre
        // llamadas (prompt de sistema + contexto fijo como las guias de la Fase 7) y al final
        // los datos propios del proyecto.
        String staticContext = payloadResult.staticContext() != null && !payloadResult.staticContext().isBlank()
                ? "\n\n" + promptCompactor.compact(payloadResult.staticContext()) : "";
        String fullPrompt = promptCompactor.compact(agentConfig.getPromptSistema()) + staticContext + "\n\nJSON DE ENTRADA:\n"
                + toCompactJson(inputEnvelope)
                + (isPartialPhase7 ? PHASE7_PARTIAL_INSTRUCTION : outputInstructionFor(phaseNumber))
                + ENFORCE_JSON_INSTRUCTION;

        List<AiPart> parts = new ArrayList<>();
        parts.add(AiPart.ofText(fullPrompt));

        List<String> csvTextsForPhase3 = new ArrayList<>();
        long[] inlinePdfBytes = {0L};
        for (FileRef fileRef : payloadResult.fileUrls()) {
            attachFile(parts, fileRef, phaseNumber, csvTextsForPhase3, inlinePdfBytes);
        }

        NormalizedAiModelSettings modelSettings = aiModelSettingsService.getNormalized();
        List<String> candidates = aiModelSettingsService.getModelCandidates(modelSettings, agentConfig.getModelo());

        boolean hasAttachedFiles = !payloadResult.fileUrls().isEmpty();
        long providerTimeoutMs = phaseNumber == 9 ? 75_000
                // Fase 7 genera la guia completa (8-12 paginas): es la generacion mas grande del
                // sistema. En modelos lentos o de menor prioridad de cola puede tardar varios minutos.
                : phaseNumber == 7 ? 280_000
                : phaseNumber == 6 ? 90_000
                : phaseNumber == 5 ? (hasAttachedFiles ? 200_000 : 180_000)
                : 90_000;

        // Fase 5 produce un diagnostico igual de extenso que Fase 7 en la practica (dominios,
        // fases, factores, brechas y patrones con textos narrativos de 60-80+ palabras cada
        // uno), asi que necesita el mismo presupuesto grande de tokens. Con datos reales de
        // encuesta, una corrida completa en un modelo lento/gratuito puede tardar 100s+, de ahi
        // el timeout mas generoso que el resto de fases.
        GenerationConfig generationConfig = GenerationConfig.builder()
                .temperature(agentConfig.getTemperatura() != null ? agentConfig.getTemperatura().doubleValue() : 1.0)
                // Fase 7: guia completa (8-12 paginas, ~10-15K tokens; 65K deja margen). Fase 5: su respuesta real ronda
                // 5-9K tokens; 32K deja margen amplio y solo corta respuestas desbocadas.
                .maxOutputTokens(phaseNumber == 7 ? (isPartialPhase7 ? 32768 : 65536) : phaseNumber == 5 ? 32768 : 16384)
                .providerTimeoutMs(providerTimeoutMs)
                .responseMimeType("application/json")
                .thinkingBudget(CLASSIFICATION_PHASES.contains(phaseNumber) ? 0 : null)
                .build();

        long startTime = System.currentTimeMillis();
        AiGenerateResult aiResult = aiFallbackService.callWithFallback(candidates, parts, generationConfig);
        long durationMs = System.currentTimeMillis() - startTime;
        String processingTime = String.format(Locale.US, "%.2f", durationMs / 1000.0);
        tokenUsageRecorder.record(projectId, phaseNumber, aiResult, durationMs);

        if ("MAX_TOKENS".equals(aiResult.getFinishReason())) {
            throw new IllegalStateException("El modelo " + aiResult.getProvider() + ":" + aiResult.getModel()
                    + " corto la respuesta por limite de tokens antes de completar el JSON. Aumenta maxOutputTokens o divide la fase en partes mas pequenas.");
        }

        JsonNode diagnosis = parseJsonResponse(aiResult.getText(), processingTime);

        // Verificar cancelacion del usuario durante el procesamiento.
        FaseEstado currentState = faseEstadoRepository.findByProyectoIdAndNumeroFase(projectId, phaseNumber).orElse(null);
        JsonNode currentData = currentState != null ? currentState.getDatosConsolidados() : null;
        boolean runMismatch = RUN_TRACKED_PHASES.contains(phaseNumber) && runId != null
                && ProcessingUtils.isProcessingMarker(currentData)
                && !runId.equals(currentData.path("_run_id").asText(null));

        if (currentState == null || !"procesando".equals(currentState.getEstadoVisual()) || runMismatch) {
            return new PhaseRunResult(null, processingTime, true);
        }

        String commentText = extractCommentText(comments);
        JsonNode diagnosisToSave = phaseNumber == 3
                ? phase3CompletionService.withCompletedPhase3Items(diagnosis, inputEnvelope, csvTextsForPhase3)
                : diagnosis;

        if (phaseNumber == 7) {
            JsonNode guideToVersion = diagnosis;
            if (isPartialPhase7) {
                JsonNode previousGuide = comments != null && comments.isObject() ? comments.get("current_guide_for_revision") : null;
                guideToVersion = Phase7Sections.merge(Phase7Sections.currentGuide(previousGuide), diagnosis,
                        Phase7Sections.targetSections(comments));
                if (guideToVersion == null) {
                    throw new IllegalStateException("El ajuste parcial no devolvió las secciones solicitadas; se conserva la versión anterior de la guía.");
                }
            }
            String versionComment = isPartialPhase7
                    ? "Ajuste de secciones " + String.join(", ", Phase7Sections.targetSections(comments))
                        + (commentText != null ? ": " + commentText : "")
                    : commentText;
            diagnosisToSave = wrapPhase7Version(projectId, guideToVersion, comments, versionComment);
        } else if (phaseNumber == 4) {
            diagnosisToSave = normalizePhase4Envelope(diagnosisToSave, inputEnvelope, processingTime);
        } else if (phaseNumber == 5) {
            diagnosisToSave = aiModelSettingsService.attachModelMetadata(
                    normalizePhase5Envelope(diagnosisToSave, inputEnvelope, processingTime), aiResult, modelSettings);
        } else if (phaseNumber == 6) {
            diagnosisToSave = aiModelSettingsService.attachModelMetadata(
                    normalizePhase6Envelope(diagnosisToSave, inputEnvelope, processingTime), aiResult, modelSettings);
        } else {
            diagnosisToSave = aiModelSettingsService.attachModelMetadata(diagnosisToSave, aiResult, modelSettings);
        }

        boolean agentReturnedError = diagnosisToSave != null && diagnosisToSave.isObject()
                && (!diagnosisToSave.path("error").isMissingNode() && !diagnosisToSave.path("error").isNull()
                    || "error".equals(diagnosisToSave.path("metadata").path("status").asText(null)));

        String estadoVisual = agentReturnedError ? "error" : (phaseNumber == 3 || phaseNumber == 9) ? "completado" : "disponible";
        saveFaseEstado(projectId, phaseNumber, estadoVisual, diagnosisToSave);

        return new PhaseRunResult(diagnosisToSave, processingTime, false);
    }

    // ── Adjuntos: descarga y base64, replica el bloque de fetch de archivos de runAgent() ──

    /**
     * Limite de bytes de PDF por solicitud. Gemini acepta hasta 20 MB por solicitud y el base64
     * agrega ~33 %, asi que se reserva margen para el prompt. Los PDF que ya no caben se envian
     * como texto extraido (o se omiten con una nota) en vez de hacer fallar toda la llamada.
     */
    private static final long MAX_INLINE_PDF_BYTES = 14L * 1024 * 1024;

    private void attachFile(List<AiPart> parts, FileRef fileRef, int phaseNumber, List<String> csvTextsForPhase3,
                            long[] inlinePdfBytes) {
        try {
            byte[] bytes = webClientBuilder.build().get().uri(fileRef.url()).retrieve().bodyToMono(byte[].class)
                    .block(Duration.ofSeconds(60));
            if (bytes == null) return;

            if ("text/csv".equals(fileRef.type())) {
                String textContent = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
                if (phaseNumber == 3) csvTextsForPhase3.add(textContent);
                parts.add(AiPart.ofText("\n\n--- METADATOS DE ARCHIVO ADJUNTO ---\n"
                        + (fileRef.label() != null ? fileRef.label() : "Archivo CSV adjunto") + "\n"));
                parts.add(AiPart.ofText("\n\n--- INICIO CONTENIDO DE ARCHIVO CSV ADJUNTO ---\n" + textContent
                        + "\n--- FIN CONTENIDO DE ARCHIVO CSV ADJUNTO ---\nPor favor, ten muy en cuenta los datos de este archivo CSV para tu analisis.\n"));
                return;
            }

            String label = fileRef.label() != null ? fileRef.label() : "Archivo PDF adjunto";
            byte[] pdfBytes = bytes;
            String note = "";
            String fallbackText = null;
            boolean isPdf = "application/pdf".equals(fileRef.type());

            if (isPdf && fileRef.pdfPolicy() != null) {
                PdfAttachmentOptimizer.Prepared prepared = pdfAttachmentOptimizer.prepare(bytes, fileRef.pdfPolicy());
                if (prepared.mode() == PdfAttachmentOptimizer.Mode.TEXT) {
                    addTextAttachment(parts, label, prepared.note(), prepared.text());
                    return;
                }
                pdfBytes = prepared.pdfBytes();
                note = prepared.note();
                fallbackText = prepared.text();
            }

            if (isPdf && inlinePdfBytes[0] + pdfBytes.length > MAX_INLINE_PDF_BYTES) {
                if (fallbackText == null) {
                    fallbackText = pdfAttachmentOptimizer.prepare(bytes, new FileRef.PdfPolicy(null, true)).text();
                }
                String sizeMb = String.format(Locale.US, "%.1f", pdfBytes.length / 1048576.0);
                if (fallbackText != null && !fallbackText.isBlank()) {
                    addTextAttachment(parts, label, "El PDF (" + sizeMb + " MB) no cabe en el límite de tamaño de la solicitud; se envía su texto extraído.", fallbackText);
                } else {
                    parts.add(AiPart.ofText("\n\n--- METADATOS DE ARCHIVO ADJUNTO ---\n" + label
                            + "\nDocumento omitido: el PDF (" + sizeMb + " MB) supera el límite de tamaño de la solicitud y no tiene texto extraíble.\n"));
                }
                return;
            }
            if (isPdf) inlinePdfBytes[0] += pdfBytes.length;

            String base64 = java.util.Base64.getEncoder().encodeToString(pdfBytes);
            parts.add(AiPart.ofText("\n\n--- METADATOS DE ARCHIVO ADJUNTO ---\n"
                    + label + (note.isBlank() ? "" : "\nNota: " + note)
                    + "\n--- EL SIGUIENTE PDF CORRESPONDE A LOS METADATOS ANTERIORES ---\n"));
            parts.add(AiPart.builder().mimeType(fileRef.type()).base64Data(base64).sourceUrl(fileRef.url())
                    .filename(fileRef.label() != null ? fileRef.label() : "archivo-adjunto.pdf").build());
        } catch (Exception e) {
            System.err.println("[pmo-agent] Error descargando archivo adjunto " + fileRef.url() + ": " + e.getMessage());
        }
    }

    private void addTextAttachment(List<AiPart> parts, String label, String note, String text) {
        parts.add(AiPart.ofText("\n\n--- METADATOS DE ARCHIVO ADJUNTO ---\n" + label
                + (note == null || note.isBlank() ? "" : "\nNota: " + note)
                + "\n--- INICIO TEXTO EXTRAÍDO DEL DOCUMENTO ---\n" + text
                + "\n--- FIN TEXTO EXTRAÍDO DEL DOCUMENTO ---\n"));
    }

    // ── Parseo/limpieza de la respuesta JSON de la IA ───────────────────────────────────────

    private JsonNode parseJsonResponse(String rawContent, String processingTime) {
        String cleaned = rawContent != null ? rawContent.trim() : "";
        int firstBrace = cleaned.indexOf('{');
        int lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace != -1 && lastBrace != -1 && lastBrace > firstBrace) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        } else {
            cleaned = cleaned.replaceFirst("(?i)^```json\\s*", "").replaceFirst("(?i)^```\\s*", "").replaceFirst("(?i)```\\s*$", "").trim();
        }
        try {
            return objectMapper.readTree(cleaned);
        } catch (Exception e) {
            String preview = rawContent != null && rawContent.length() > 150 ? rawContent.substring(0, 150) : rawContent;
            throw new IllegalStateException("La IA devolvio un JSON invalido. Tiempo: " + processingTime + "s. Respuesta original: " + preview + "...");
        }
    }

    /** JSON sin sangria ni saltos de linea: mismo contenido, sin pagar tokens por espacios en blanco. */
    private String toCompactJson(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            return node.toString();
        }
    }

    // ── Estado en fases_estado ───────────────────────────────────────────────────────────────

    private void upsertProcessing(UUID projectId, int phaseNumber, String runId) {
        FaseEstado fase = faseEstadoRepository.findByProyectoIdAndNumeroFase(projectId, phaseNumber)
                .orElseGet(() -> FaseEstado.builder().proyectoId(projectId).numeroFase(phaseNumber).build());
        fase.setEstadoVisual("procesando");
        fase.setDatosConsolidados(runId != null ? ProcessingUtils.phaseProcessingPayload(objectMapper, phaseNumber, runId) : null);
        fase.setUpdatedAt(OffsetDateTime.now());
        faseEstadoRepository.save(fase);
    }

    private void saveFaseEstado(UUID projectId, int phaseNumber, String estadoVisual, JsonNode datos) {
        FaseEstado fase = faseEstadoRepository.findByProyectoIdAndNumeroFase(projectId, phaseNumber)
                .orElseGet(() -> FaseEstado.builder().proyectoId(projectId).numeroFase(phaseNumber).build());
        fase.setEstadoVisual(estadoVisual);
        fase.setDatosConsolidados(datos);
        fase.setUpdatedAt(OffsetDateTime.now());
        faseEstadoRepository.save(fase);
    }

    private void saveError(UUID projectId, int phaseNumber, String message) {
        ObjectNode error = objectMapper.createObjectNode();
        error.put("_error", true);
        error.put("message", message);
        error.put("phaseNumber", phaseNumber);
        error.put("timestamp", OffsetDateTime.now().toString());
        saveFaseEstado(projectId, phaseNumber, "error", error);
    }

    // ── Fase 7: versionado (_current/_versions), puerto del bloque de index.ts (~1766-1795) ──

    private JsonNode wrapPhase7Version(UUID projectId, JsonNode diagnosis, JsonNode comments, String commentText) {
        JsonNode previousFromRequest = comments != null && comments.isObject() ? comments.get("current_guide_for_revision") : null;
        JsonNode previous = previousFromRequest;
        if (previous == null) {
            FaseEstado previousPhase7 = faseEstadoRepository.findByProyectoIdAndNumeroFase(projectId, 7).orElse(null);
            previous = previousPhase7 != null ? previousPhase7.getDatosConsolidados() : null;
        }

        ArrayNode previousVersions = previous != null && previous.isObject() && previous.get("_versions") != null && previous.get("_versions").isArray()
                ? (ArrayNode) previous.get("_versions") : objectMapper.createArrayNode();
        int versionNumber = previousVersions.size() + 1;
        String generatedAt = OffsetDateTime.now().toString();

        ObjectNode versionEntry = objectMapper.createObjectNode();
        versionEntry.put("number", versionNumber);
        versionEntry.put("generatedAt", generatedAt);
        versionEntry.put("status", versionNumber > 1 ? "revisado" : "generado");
        versionEntry.put("comment", commentText);
        versionEntry.set("data", diagnosis);

        ArrayNode newVersions = previousVersions.deepCopy();
        newVersions.add(versionEntry);

        ObjectNode wrapper = objectMapper.createObjectNode();
        wrapper.set("_current", diagnosis);
        wrapper.set("_versions", newVersions);
        wrapper.put("_latest_version", versionNumber);
        wrapper.put("_generated_at", generatedAt);
        wrapper.put("_last_comment", commentText);
        return wrapper;
    }

    // ── Normalizacion de envelopes (puerto de normalizePhase4/5/6Envelope en index.ts) ──────

    private JsonNode normalizePhase4Envelope(JsonNode value, JsonNode inputEnvelope, String processingTimeSeconds) {
        if (value == null || !value.isObject()) return value;
        ObjectNode record = (ObjectNode) value;
        JsonNode metadata = record.has("metadata") && record.get("metadata").isObject() ? record.get("metadata") : objectMapper.createObjectNode();
        JsonNode diagnosis = record.has("diagnosis") && record.get("diagnosis").isObject() ? record.get("diagnosis") : null;

        ObjectNode normalized = objectMapper.createObjectNode();
        ObjectNode newMetadata = objectMapper.createObjectNode();
        newMetadata.put("project_id", firstText(inputEnvelope.path("metadata").path("project_id"), metadata.path("project_id"), ""));
        newMetadata.put("phase", 4);
        newMetadata.put("agent_id", "asistente-4");
        newMetadata.put("timestamp", OffsetDateTime.now().toString());
        newMetadata.put("iteration", firstInt(inputEnvelope.path("metadata").path("iteration"), metadata.path("iteration"), 1));
        boolean hasError = !record.path("error").isMissingNode() && !record.path("error").isNull();
        newMetadata.put("status", hasError ? "error" : firstText(metadata.path("status"), null, "success"));
        newMetadata.put("processing_time_seconds", round2(Double.parseDouble(processingTimeSeconds)));
        normalized.set("metadata", newMetadata);
        normalized.set("diagnosis", diagnosis != null ? diagnosis : objectMapper.nullNode());
        normalized.set("error", record.path("error").isMissingNode() ? objectMapper.nullNode() : record.get("error"));

        if (diagnosis != null && diagnosis.isObject()) {
            ObjectNode diag = (ObjectNode) diagnosis;
            JsonNode rawPmoType = diag.has("pmo_type") ? diag.get("pmo_type") : diag.get("pmoType");
            if (rawPmoType != null && !rawPmoType.isNull()) {
                diag.put("pmo_type", normalizeMethodologyType(rawPmoType.asText()));
            }
            if (diag.has("type_breakdown") && diag.get("type_breakdown").isObject()) {
                ObjectNode breakdown = (ObjectNode) diag.get("type_breakdown");
                if (breakdown.has("agile_weight") && breakdown.has("predictive_weight")
                        && breakdown.get("agile_weight").isNumber() && breakdown.get("predictive_weight").isNumber()) {
                    double agile = breakdown.get("agile_weight").asDouble();
                    double predictive = breakdown.get("predictive_weight").asDouble();
                    if (agile + predictive != 100) {
                        int agileWeight = (int) Math.max(0, Math.min(100, Math.round(agile)));
                        breakdown.put("agile_weight", agileWeight);
                        breakdown.put("predictive_weight", 100 - agileWeight);
                    }
                }
                if (!"Hibrido".equals(diag.path("pmo_type").asText())) {
                    breakdown.put("hybrid_rationale", "");
                }
            }
            if (diag.has("supporting_evidence") && diag.get("supporting_evidence").isArray() && diag.get("supporting_evidence").size() > 8) {
                ArrayNode limited = objectMapper.createArrayNode();
                for (int i = 0; i < 8; i++) limited.add(diag.get("supporting_evidence").get(i));
                diag.set("supporting_evidence", limited);
            }
        }

        return normalized;
    }

    private JsonNode normalizePhase5Envelope(JsonNode value, JsonNode inputEnvelope, String processingTimeSeconds) {
        return normalizeSimpleEnvelope(value, inputEnvelope, processingTimeSeconds, 5, "asistente-5");
    }

    private JsonNode normalizePhase6Envelope(JsonNode value, JsonNode inputEnvelope, String processingTimeSeconds) {
        return normalizeSimpleEnvelope(value, inputEnvelope, processingTimeSeconds, 6, "agente-6");
    }

    private JsonNode normalizeSimpleEnvelope(JsonNode value, JsonNode inputEnvelope, String processingTimeSeconds, int phase, String agentId) {
        if (value == null || !value.isObject()) return value;
        ObjectNode record = ((ObjectNode) value).deepCopy();
        JsonNode metadata = record.has("metadata") && record.get("metadata").isObject() ? record.get("metadata") : objectMapper.createObjectNode();

        ObjectNode newMetadata = ((ObjectNode) metadata).deepCopy();
        newMetadata.put("project_id", firstText(inputEnvelope.path("metadata").path("project_id"), metadata.path("project_id"), ""));
        newMetadata.put("phase", phase);
        newMetadata.put("agent_id", agentId);
        newMetadata.put("timestamp", metadata.hasNonNull("timestamp") ? metadata.get("timestamp").asText() : OffsetDateTime.now().toString());
        newMetadata.put("iteration", firstInt(inputEnvelope.path("metadata").path("iteration"), metadata.path("iteration"), 1));
        boolean hasError = !record.path("error").isMissingNode() && !record.path("error").isNull();
        newMetadata.put("status", hasError ? "error" : firstText(metadata.path("status"), null, "success"));
        newMetadata.put("processing_time_seconds", round2(Double.parseDouble(processingTimeSeconds)));

        record.set("metadata", newMetadata);
        return record;
    }

    private String normalizeMethodologyType(String value) {
        String token = java.text.Normalizer.normalize(value == null ? "" : value, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase();
        if (token.contains("agil")) return "Agil";
        if (token.contains("predict")) return "Predictivo";
        return "Hibrido";
    }

    private String firstText(JsonNode a, JsonNode b, String fallback) {
        if (a != null && !a.isNull() && !a.isMissingNode() && !a.asText().isBlank()) return a.asText();
        if (b != null && !b.isNull() && !b.isMissingNode() && !b.asText().isBlank()) return b.asText();
        return fallback;
    }

    private int firstInt(JsonNode a, JsonNode b, int fallback) {
        if (a != null && a.isNumber()) return a.asInt();
        if (b != null && b.isNumber()) return b.asInt();
        return fallback;
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private String extractCommentText(JsonNode comments) {
        if (comments == null || comments.isNull()) return null;
        if (comments.isTextual() && !comments.asText().isBlank()) return comments.asText().trim();
        if (comments.isObject()) {
            for (String field : new String[]{"comments", "comment", "comentario_consultor"}) {
                JsonNode v = comments.get(field);
                if (v != null && v.isTextual() && !v.asText().isBlank()) return v.asText().trim();
            }
        }
        return null;
    }

    // ── Instrucciones de salida por fase, copiadas literalmente de index.ts (~1546-1602) ────

    private static final String ENFORCE_JSON_INSTRUCTION = """


            IMPORTANTE: DEBES DEVOLVER ÚNICAMENTE UN OBJETO JSON VÁLIDO.
            Tu respuesta DEBE empezar con '{' y terminar con '}'. Sin markdown, sin texto extra.""";

    private static final String PHASE3_INSTRUCTION = """


            REQUISITO ESTRICTO PARA FASE 3:
            El objeto diagnosis.resultados_por_item DEBE incluir un elemento por CADA item valido de idoneidad encontrado en el JSON de entrada y/o CSV adjunto.
            No resumas esta lista. No incluyas solo ejemplos. Deben estar los codigos C01-C10, E01-E06 y P01-P05 presentes en los datos recibidos, con promedio numerico, minimo, maximo, desviacion_estandar, dimension y zona.
            La escala de zonas es estrictamente: 1.0-3.0 agil, 3.1-6.9 transicion, 7.0-10.0 predictivo. Si existen los 21 items esperados, resultados_por_item debe tener exactamente 21 objetos.""";

    private static final String PHASE4_INSTRUCTION = """


            REQUISITO ESTRICTO PARA FASE 4:
            El JSON DE ENTRADA ya viene consolidado con metadata, payload.phase1_diagnosis, payload.phase2_diagnosis, payload.phase3_diagnosis y comments. No uses documentos crudos ni inventes fuentes.
            Devuelve exclusivamente el objeto JSON del contrato de salida del Asistente 4. metadata.agent_id debe ser "asistente-4"; diagnosis.pmo_type debe ser "Agil", "Hibrido" o "Predictivo"; confidence_label debe ser "Alto", "Medio" o "Bajo".
            diagnosis.justification debe tener minimo 80 palabras con evidencia explicita por fuente disponible y razonamiento de ponderacion. Si pmo_type es "Hibrido", type_breakdown.hybrid_rationale debe tener minimo 50 palabras; si no, debe ser "".
            type_breakdown.agile_weight + type_breakdown.predictive_weight debe sumar exactamente 100. supporting_evidence debe tener maximo 8 strings y referenciar la fuente. No evalues madurez y no incluyas recomendaciones.""";

    private static final String PHASE5_INSTRUCTION = """


            REQUISITO ESTRICTO PARA FASE 5:
            Debes actuar como el Asistente 5 de Evaluacion de Madurez en Gestion de Proyectos. Usa exclusivamente el JSON DE ENTRADA y los CSV adjuntos, si existen, para calcular todos los scores desde respuestas crudas en escala 1 a 5. No inventes respuestas ni promedios.
            El campo payload.approved_pmo_type solo puede ser "Hibrido", "Predictivo" o "Agil". Si es "Predictivo", analiza solo maturity_surveys.predictive y marca agile_maturity.aplica=false. Si es "Agil", analiza solo maturity_surveys.agile y marca predictive_maturity.aplica=false. Si es "Hibrido", analiza ambos por separado y activa analisis_cruzado.aplica=true.
            Usa esta escala unica para todos los niveles: 1.00-1.49 Informal nivel 1, 1.50-2.49 Basico nivel 2, 2.50-3.49 Estandar nivel 3, 3.50-4.49 Avanzado nivel 4, 4.50-5.00 Excelencia nivel 5. No uses Inicial, Repetible, Definido, Gestionado ni Optimizado como etiquetas de salida.
            Para Hibrido, overall_maturity_score es el unico campo donde puedes combinar enfoques: score_predictivo * predictive_weight/100 + score_agil * agile_weight/100 usando payload.approved_phase4_weights. Si los pesos faltan o no suman 100, registra advertencia y usa promedio simple. Mantén score_global predictivo y agil separados.
            Mapea y calcula predictive_maturity por dominio y por fase con las preguntas del prompt del Asistente 5; calcula agile_maturity por factor con C1-C6, E7-E11, P12-P19, I20-I26, V27-V33 y A34-A43. Registra en advertencias_de_entrada toda pregunta ausente, encuesta requerida vacia, valor fuera de 1-5, patron uniforme o aquiescencia.
            Mapeo predictivo por dominio: gobernanza=G1-01,G1-02,G1-03,G2-04,G2-05,G2-06,G2-07,G2-08,G3-09,G3-10,G3-11,G3-12,G4-13,G4-14,G4-15,G5-16,G5-17,G5-18; alcance=A2-19,A2-20,A2-21,A2-22,A2-23,A2-24,A4-25,A4-26,A4-27; cronograma=C2-28,C2-29,C2-30,C2-31,C4-32,C4-33,C4-34,C4-35; financiero=F2-36,F2-37,F2-38,F4-39,F4-40,F4-41,F4-42,F5-43; interesados=I1-44,I2-45,I2-46,I3-47,I3-48,I4-49,I4-50,I4-51; recursos=R2-52,R3-53,R3-54,R3-55,R4-56,R4-57,R5-58; riesgos=K2-59,K2-60,K2-61,K3-62,K3-63,K4-64,K4-65.
            Mapeo predictivo por fase: inicio=G1-01,G1-02,G1-03; planeacion=G2-04,G2-05,G2-06,G2-07,G2-08,A2-19,A2-20,A2-21,A2-22,A2-23,A2-24,C2-28,C2-29,C2-30,C2-31,F2-36,F2-37,F2-38,I2-45,I2-46,R2-52,K2-59,K2-60,K2-61; ejecucion=G3-09,G3-10,G3-11,G3-12,G4-13,G4-14,G4-15,A4-25,A4-26,A4-27,I3-47,I3-48,R3-53,R3-54,R3-55,K3-62,K3-63; monitoreo_y_control=G5-16,G5-17,G5-18,C4-32,C4-33,C4-34,C4-35,F4-39,F4-40,F4-41,F4-42,I1-44,I4-49,I4-50,I4-51,R4-56,R4-57,K4-64,K4-65; cierre=G3-10,F5-43,R5-58.
            Mapeo agil por factor: cultura=C1,C2,C3,C4,C5,C6; equipo=E7,E8,E9,E10,E11; producto=P12,P13,P14,P15,P16,P17,P18,P19; interesados=I20,I21,I22,I23,I24,I25,I26; valor=V27,V28,V29,V30,V31,V32,V33; adaptabilidad=A34,A35,A36,A37,A38,A39,A40,A41,A42,A43.
            Incluye en brechas todos los dominios, fases o factores en Informal o Basico. No reportes fortalezas salvo Avanzado o Excelencia. Menciona brechas relativas solo en patrones_estructurales, no en brechas.
            Los campos narrativos deben ser claros, concretos y seguros para JSON: usa frases compactas, sin saltos de linea dentro de strings y sin markdown. Limita patrones_estructurales, impactos, sintesis, relaciones, tensiones y recomendaciones a 1 o 2 frases cada uno. Prioriza JSON completo y valido por encima de extension narrativa.
            Devuelve exclusivamente el JSON del contrato del Asistente 5 con metadata.agent_id="asistente-5", diagnosis, error=null en exito, top_gaps maximo 5 y recommendations maximo 6. La respuesta completa no debe exceder 12000 caracteres: es un limite estricto, no una sugerencia; si te acercas, acorta los textos narrativos antes que omitir campos. Si no hay datos suficientes, devuelve la plantilla de error con codigo adecuado.""";

    private static final String PHASE6_INSTRUCTION = """


            REQUISITO ESTRICTO PARA FASE 6:
            El JSON DE ENTRADA contiene exclusivamente payload.approved_phase4_diagnosis, payload.approved_phase5_diagnosis y comments. No uses documentos crudos ni outputs de fases 1, 2 o 3.
            No redactes la guia metodologica, no reclasifiques el tipo de PMO y no recalcules scores de madurez.
            Devuelve exclusivamente el contrato JSON corto del Agente 6: metadata.agent_id="agente-6", metadata.phase=6, diagnosis.summary, diagnosis.guide_approach, diagnosis.secciones, diagnosis.critical_weaknesses, diagnosis.parametros_construccion, diagnosis.advertencias_de_entrada, diagnosis.insumos_base_utilizados y error=null en exito.
            Incluye siempre las 10 secciones base, maximo 8 critical_weaknesses y solo secciones adicionales justificadas por Fase 4 o Fase 5. Si faltan Fase 4 o Fase 5, devuelve la plantilla de error del prompt con codigo MISSING_PHASE4_DIAGNOSIS, MISSING_PHASE5_DIAGNOSIS, INVALID_FORMAT, INVALID_PMO_TYPE o INSUFFICIENT_DATA.""";

    private static final String PHASE7_PARTIAL_INSTRUCTION = """


            MODO AJUSTE PARCIAL DE FASE 7 (tiene prioridad sobre el contrato de salida completo del prompt):
            No generes la guia completa. payload.sections_to_revise trae las secciones que el consultor pidio ajustar, payload.guide_outline los titulos de toda la guia (solo para mantener coherencia) y payload.comments las instrucciones del consultor, que son obligatorias.
            Reescribe UNICAMENTE las secciones de sections_to_revise aplicando los comentarios. Conserva todo lo que el comentario no pida cambiar, manten el mismo section_id, section_key y section_title (salvo que el comentario pida otro titulo) y la misma estructura del campo contenido, con el mismo nivel de detalle y estilo que exige el prompt para cada seccion.
            La extension objetivo de la guia completa no aplica aqui: cada seccion revisada conserva una extension similar a la actual salvo que el comentario pida otra cosa.
            Devuelve exclusivamente {"guide_content":[...]} con las secciones revisadas y nada mas.""";

    private static final String PHASE7_INSTRUCTION = """


            REQUISITO ESTRICTO PARA FASE 7:
            Genera una guia metodologica profesional, especifica para la organizacion evaluada y lista para revision ejecutiva, con una extension objetivo equivalente a 8-12 paginas A4. La estructura de secciones y sus minimos de contenido (conceptos, politicas, roles, comites, etc.) son los que define este prompt.
            Si el JSON DE ENTRADA incluye comentarios del consultor, tienen prioridad maxima: aplicalos como requerimientos obligatorios y haz visible el cambio en el documento final.
            Preserva la informacion de negocio relevante del JSON de entrada: hallazgos, brechas, riesgos, scores, fases, actividades, entradas, salidas, roles, responsabilidades, criterios, artefactos, KPIs, umbrales y recomendaciones. Excluye campos tecnicos, metadatos, identificadores internos, timestamps, nombres de llaves JSON y trazas de versionado.
            Redacta de forma concreta y sin relleno: parrafos de 40 a 80 palabras, items accionables de una o dos frases, y tablas con encabezados claros y datos concretos cuando aporten (minimo 3 filas). No repitas en una seccion lo que ya explicaste en otra y evita definiciones genericas o placeholders.
            Antes de entregar el JSON, verifica que cada seccion del prompt esta presente con contenido real y que se cumplen sus minimos de contenido.""";


    private String outputInstructionFor(int phaseNumber) {
        return switch (phaseNumber) {
            case 3 -> PHASE3_INSTRUCTION;
            case 4 -> PHASE4_INSTRUCTION;
            case 5 -> PHASE5_INSTRUCTION;
            case 6 -> PHASE6_INSTRUCTION;
            case 7 -> PHASE7_INSTRUCTION;
            default -> "";
        };
    }
}
