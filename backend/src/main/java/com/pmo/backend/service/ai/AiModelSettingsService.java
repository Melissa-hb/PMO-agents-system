package com.pmo.backend.service.ai;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.pmo.backend.domain.AiModelSettings;
import com.pmo.backend.repository.AiModelSettingsRepository;

import static com.pmo.backend.service.ai.AiModelDefaults.*;

/** Puerto Java de aiModels.ts, adaptado a Gemini: modelos identificados por nombre libre. */
@Service
public class AiModelSettingsService {

    private final AiModelSettingsRepository repository;
    private final ObjectMapper objectMapper;

    public AiModelSettingsService(AiModelSettingsRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    public AiModelSettings getOrDefaultEntity() {
        return repository.findById("global").orElseGet(() -> AiModelSettings.builder()
                .id("global")
                .provider(vendorOf(DEFAULT_MODEL))
                .selectedModel(DEFAULT_MODEL)
                .fallbackModel(DEFAULT_FALLBACK_MODEL)
                .build());
    }

    public NormalizedAiModelSettings getNormalized() {
        return normalize(getOrDefaultEntity());
    }

    public NormalizedAiModelSettings normalize(AiModelSettings row) {
        String selectedModel = nonBlankOr(row.getSelectedModel(), DEFAULT_MODEL);
        String fallbackModel = nonBlankOr(row.getFallbackModel(), DEFAULT_FALLBACK_MODEL);
        return new NormalizedAiModelSettings(vendorOf(selectedModel), selectedModel, fallbackModel);
    }

    public AiModelSettings updateSelectedModel(String selectedModel, String fallbackModel) {
        NormalizedAiModelSettings current = getNormalized();
        String normalizedSelected = nonBlankOr(selectedModel, current.selectedModel());
        String normalizedFallback = nonBlankOr(fallbackModel, current.fallbackModel());

        AiModelSettings toSave = AiModelSettings.builder()
                .id("global")
                .provider(vendorOf(normalizedSelected))
                .selectedModel(normalizedSelected)
                .fallbackModel(normalizedFallback)
                .updatedAt(OffsetDateTime.now())
                .build();

        return repository.save(toSave);
    }

    private String nonBlankOr(String value, String fallback) {
        return value != null && !value.isBlank() ? value.trim() : fallback;
    }

    /**
     * Puerto de getModelCandidates(): primero el modelo explicito de la fase
     * (configuracion_agentes.modelo) si viene informado, luego el modelo global configurado,
     * y por ultimo el modelo de respaldo global. Todos los modelos son de Gemini, asi que ya
     * no hace falta ninguna logica de fallback cruzado por proveedor.
     */
    public List<String> getModelCandidates(NormalizedAiModelSettings settings, String preferredModelRaw) {
        List<String> ordered = new ArrayList<>();
        if (preferredModelRaw != null && !preferredModelRaw.isBlank()) ordered.add(preferredModelRaw.trim());
        ordered.add(settings.selectedModel());
        ordered.add(settings.fallbackModel());

        Set<String> seen = new LinkedHashSet<>();
        List<String> result = new ArrayList<>();
        for (String model : ordered) {
            if (model == null || model.isBlank()) continue;
            if (seen.add(model)) result.add(model);
        }
        return result;
    }

    /** Puerto de attachModelMetadata(): agrega metadata de trazabilidad del modelo usado. */
    public JsonNode attachModelMetadata(JsonNode value, AiGenerateResult modelResult, NormalizedAiModelSettings settings) {
        if (value == null || !value.isObject()) return value;
        ObjectNode record = (ObjectNode) value;
        ObjectNode metadata = record.has("metadata") && record.get("metadata").isObject()
                ? (ObjectNode) record.get("metadata")
                : objectMapper.createObjectNode();

        metadata.put("model_provider_configured", settings.provider());
        metadata.put("model_selected", settings.selectedModel());
        metadata.put("model_fallback_configured", settings.fallbackModel());
        metadata.put("model_provider", modelResult.getProvider());
        metadata.put("model_used", modelResult.getModel());
        metadata.put("model_fallback_used", modelResult.isFallbackUsed());
        metadata.set("attempted_models", objectMapper.valueToTree(modelResult.getAttemptedModels()));
        metadata.set("model_errors", objectMapper.valueToTree(modelResult.getErrors()));
        metadata.put("model_gateway", "gemini");

        record.set("metadata", metadata);
        return record;
    }
}
