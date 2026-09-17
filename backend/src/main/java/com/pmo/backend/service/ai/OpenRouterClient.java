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

import com.pmo.backend.config.AiProperties;

/**
 * Cliente unico hacia OpenRouter (https://openrouter.ai) usando su API compatible con el formato
 * de OpenAI Chat Completions. Reemplaza los clientes separados de OpenAI y Anthropic: un modelo
 * se identifica con un slug "vendor/modelo" (ej. "openai/gpt-4o", "anthropic/claude-3.5-sonnet")
 * y OpenRouter se encarga de hablar con el proveedor real detras.
 */
@Component
class OpenRouterClient {

    private static final String ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

    private final WebClient.Builder webClientBuilder;
    private final AiProperties aiProperties;
    private final ObjectMapper objectMapper;

    OpenRouterClient(WebClient.Builder webClientBuilder, AiProperties aiProperties, ObjectMapper objectMapper) {
        this.webClientBuilder = webClientBuilder;
        this.aiProperties = aiProperties;
        this.objectMapper = objectMapper;
    }

    AiCallResult call(String apiKey, String model, List<AiPart> parts, GenerationConfig config) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("model", model);

        ArrayNode messages = payload.putArray("messages");
        ObjectNode userMessage = messages.addObject();
        userMessage.put("role", "user");
        ArrayNode content = userMessage.putArray("content");
        for (AiPart part : parts) {
            ObjectNode item = buildContentItem(part);
            if (item != null) content.add(item);
        }

        if (config.getMaxOutputTokens() != null) {
            payload.put("max_tokens", config.getMaxOutputTokens());
        }
        if (config.getTemperature() != null) {
            payload.put("temperature", config.getTemperature());
        }
        if ("application/json".equalsIgnoreCase(config.getResponseMimeType())) {
            payload.putObject("response_format").put("type", "json_object");
        }

        try {
            WebClient.RequestBodySpec request = webClientBuilder.build().post()
                    .uri(ENDPOINT)
                    .header("Authorization", "Bearer " + apiKey.trim())
                    .contentType(MediaType.APPLICATION_JSON);
            if (aiProperties.openrouter().siteUrl() != null && !aiProperties.openrouter().siteUrl().isBlank()) {
                request = (WebClient.RequestBodySpec) request.header("HTTP-Referer", aiProperties.openrouter().siteUrl());
            }
            if (aiProperties.openrouter().appName() != null && !aiProperties.openrouter().appName().isBlank()) {
                request = (WebClient.RequestBodySpec) request.header("X-Title", aiProperties.openrouter().appName());
            }

            JsonNode data = request
                    .bodyValue(payload)
                    .retrieve()
                    .onStatus(status -> status.isError(), response -> response.bodyToMono(String.class)
                            .map(body -> new OpenRouterErrorException(response.statusCode().value(), body)))
                    .bodyToMono(JsonNode.class)
                    .block(Duration.ofMillis(config.getProviderTimeoutMs() + 5_000));

            return normalize(data);
        } catch (OpenRouterErrorException e) {
            return AiCallResult.builder().ok(false).status(e.status).errorMessage(e.body).build();
        } catch (Exception e) {
            return AiCallResult.builder().ok(false).status(0).errorMessage(e.getMessage()).build();
        }
    }

    private ObjectNode buildContentItem(AiPart part) {
        if (part.getText() != null) {
            ObjectNode item = objectMapper.createObjectNode();
            item.put("type", "text");
            item.put("text", part.getText());
            return item;
        }
        if (part.isInlineData()) {
            String dataUri = "data:" + part.getMimeType() + ";base64," + part.getBase64Data();
            if (part.getMimeType().startsWith("image/")) {
                ObjectNode item = objectMapper.createObjectNode();
                item.put("type", "image_url");
                item.putObject("image_url").put("url", part.getSourceUrl() != null ? part.getSourceUrl() : dataUri);
                return item;
            }
            // PDFs u otros documentos: soporte de archivos de OpenRouter (procesamiento nativo de PDF).
            ObjectNode item = objectMapper.createObjectNode();
            item.put("type", "file");
            ObjectNode file = item.putObject("file");
            file.put("filename", part.getFilename() != null ? part.getFilename() : "adjunto.pdf");
            file.put("file_data", dataUri);
            return item;
        }
        return null;
    }

    private AiCallResult normalize(JsonNode data) {
        JsonNode choice = data.path("choices").path(0);
        String content = choice.path("message").path("content").asText("");
        String finishReason = choice.path("finish_reason").asText(null);
        if ("length".equals(finishReason)) finishReason = "MAX_TOKENS";

        return AiCallResult.builder().ok(true).status(200).finishReason(finishReason).text(content).build();
    }

    private static class OpenRouterErrorException extends RuntimeException {
        final int status;
        final String body;

        OpenRouterErrorException(int status, String body) {
            this.status = status;
            this.body = body;
        }
    }
}
