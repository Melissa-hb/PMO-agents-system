package com.pmo.backend.service.ai;

import java.time.Duration;
import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Cliente hacia la API de Google Gemini (Generative Language API). Reemplaza a OpenRouter como
 * proveedor unico de IA: el modelo se identifica directamente con el nombre de Gemini
 * (ej. "gemini-2.5-pro", "gemini-2.5-flash"), sin prefijo de vendor.
 */
@Component
class GeminiClient {

    private static final String ENDPOINT_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    GeminiClient(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClientBuilder = webClientBuilder;
        this.objectMapper = objectMapper;
    }

    AiCallResult call(String apiKey, String model, List<AiPart> parts, GenerationConfig config) {
        ObjectNode payload = objectMapper.createObjectNode();

        ArrayNode contents = payload.putArray("contents");
        ObjectNode userContent = contents.addObject();
        userContent.put("role", "user");
        ArrayNode partsArray = userContent.putArray("parts");
        for (AiPart part : parts) {
            ObjectNode item = buildPart(part);
            if (item != null) partsArray.add(item);
        }

        ObjectNode generationConfig = payload.putObject("generationConfig");
        if (config.getTemperature() != null) {
            generationConfig.put("temperature", config.getTemperature());
        }
        if (config.getMaxOutputTokens() != null) {
            generationConfig.put("maxOutputTokens", config.getMaxOutputTokens());
        }
        if ("application/json".equalsIgnoreCase(config.getResponseMimeType())) {
            generationConfig.put("responseMimeType", "application/json");
        }

        try {
            JsonNode data = webClientBuilder.build().post()
                    .uri(String.format(ENDPOINT_TEMPLATE, model))
                    .header("x-goog-api-key", apiKey.trim())
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(payload)
                    .retrieve()
                    .onStatus(status -> status.isError(), response -> response.bodyToMono(String.class)
                            .map(body -> new GeminiErrorException(response.statusCode().value(), body)))
                    .bodyToMono(JsonNode.class)
                    .block(Duration.ofMillis(config.getProviderTimeoutMs() + 5_000));

            return normalize(data);
        } catch (GeminiErrorException e) {
            return AiCallResult.builder().ok(false).status(e.status).errorMessage(e.body).build();
        } catch (Exception e) {
            return AiCallResult.builder().ok(false).status(0).errorMessage(e.getMessage()).build();
        }
    }

    private ObjectNode buildPart(AiPart part) {
        if (part.getText() != null) {
            ObjectNode item = objectMapper.createObjectNode();
            item.put("text", part.getText());
            return item;
        }
        if (part.isInlineData()) {
            ObjectNode item = objectMapper.createObjectNode();
            ObjectNode inlineData = item.putObject("inline_data");
            inlineData.put("mime_type", part.getMimeType());
            inlineData.put("data", part.getBase64Data());
            return item;
        }
        return null;
    }

    private AiCallResult normalize(JsonNode data) {
        JsonNode candidate = data.path("candidates").path(0);
        StringBuilder text = new StringBuilder();
        for (JsonNode part : candidate.path("content").path("parts")) {
            text.append(part.path("text").asText(""));
        }
        String finishReason = candidate.path("finishReason").asText(null);

        return AiCallResult.builder().ok(true).status(200).finishReason(finishReason).text(text.toString()).build();
    }

    private static class GeminiErrorException extends RuntimeException {
        final int status;
        final String body;

        GeminiErrorException(int status, String body) {
            this.status = status;
            this.body = body;
        }
    }
}
