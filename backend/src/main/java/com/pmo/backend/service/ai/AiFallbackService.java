package com.pmo.backend.service.ai;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.pmo.backend.config.AiProperties;

/**
 * Puerto Java de callAiWithFallback() en aiModels.ts, adaptado a OpenRouter: un unico proveedor
 * HTTP (OpenRouter) que puede servir cualquier modelo, asi que el fallback es simplemente
 * "intenta el siguiente slug de la lista" en vez de alternar entre clientes de proveedor.
 */
@Service
public class AiFallbackService {

    private static final Set<Integer> RETRYABLE_STATUS = Set.of(400, 404, 408, 409, 429, 500, 502, 503, 504);

    private final OpenRouterClient openRouterClient;
    private final AiProperties aiProperties;
    private final ObjectMapper objectMapper;

    public AiFallbackService(OpenRouterClient openRouterClient, AiProperties aiProperties, ObjectMapper objectMapper) {
        this.openRouterClient = openRouterClient;
        this.aiProperties = aiProperties;
        this.objectMapper = objectMapper;
    }

    public AiGenerateResult callWithFallback(List<String> candidates, List<AiPart> parts, GenerationConfig config) {
        String apiKey = aiProperties.openrouter().apiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new AiGenerationException("Falta configurar OPENROUTER_API_KEY.");
        }

        List<AiAttemptError> errors = new ArrayList<>();
        List<String> attemptedModels = new ArrayList<>();

        for (int index = 0; index < candidates.size(); index++) {
            String model = candidates.get(index);
            boolean isLast = index == candidates.size() - 1;
            attemptedModels.add(model);

            AiCallResult result = openRouterClient.call(apiKey, model, parts, config);

            if (result.isOk()) {
                return AiGenerateResult.builder()
                        .text(result.getText())
                        .finishReason(result.getFinishReason())
                        .provider(AiModelDefaults.vendorOf(model))
                        .model(model)
                        .attemptedModels(attemptedModels)
                        .errors(errors)
                        .fallbackUsed(index > 0)
                        .build();
            }

            String message = extractErrorMessage(result.getErrorMessage());
            errors.add(AiAttemptError.builder().provider(AiModelDefaults.vendorOf(model)).model(model)
                    .status(result.getStatus()).message(message).build());

            boolean shouldTryNext = !isLast && (result.getStatus() == 0 || RETRYABLE_STATUS.contains(result.getStatus()));
            if (!shouldTryNext) {
                throw new AiGenerationException("Error de OpenRouter (" + model + ", " + result.getStatus() + "): " + message);
            }

            if (isLast) {
                throw new AiGenerationException(lastErrorSummary(attemptedModels, errors));
            }
        }

        throw new AiGenerationException("No hay modelos configurados.");
    }

    private String extractErrorMessage(String rawBody) {
        if (rawBody == null || rawBody.isBlank()) return "Error desconocido llamando al modelo";
        try {
            JsonNode node = objectMapper.readTree(rawBody);
            String message = node.path("error").path("message").asText(null);
            if (message != null) return message;
            String type = node.path("error").path("type").asText(null);
            if (type != null) return type;
        } catch (Exception ignored) {
            // no era JSON, se usa el cuerpo crudo
        }
        return rawBody;
    }

    private String lastErrorSummary(List<String> attemptedModels, List<AiAttemptError> errors) {
        String lastMessage = errors.isEmpty() ? "Error desconocido" : errors.get(errors.size() - 1).getMessage();
        return "Fallaron todos los modelos configurados (" + String.join(", ", attemptedModels)
                + "). Ultimo error: " + lastMessage;
    }

    public static class AiGenerationException extends RuntimeException {
        public AiGenerationException(String message) {
            super(message);
        }
    }
}
