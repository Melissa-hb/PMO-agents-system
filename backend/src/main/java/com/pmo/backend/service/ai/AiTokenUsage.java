package com.pmo.backend.service.ai;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Consumo de tokens de una llamada a Gemini, tomado de `usageMetadata` en la respuesta.
 * Los campos son null cuando la respuesta no los trae.
 *
 * @param promptTokens   tokens de entrada (incluye los cacheados)
 * @param cachedTokens   parte de la entrada servida desde la cache (se cobra con descuento)
 * @param outputTokens   tokens de la respuesta
 * @param thoughtsTokens tokens de razonamiento interno (se cobran como salida)
 * @param totalTokens    total informado por Gemini
 */
public record AiTokenUsage(Integer promptTokens, Integer cachedTokens, Integer outputTokens,
                           Integer thoughtsTokens, Integer totalTokens) {

    static AiTokenUsage fromGemini(JsonNode usageMetadata) {
        if (usageMetadata == null || usageMetadata.isMissingNode() || usageMetadata.isNull()) return null;
        return new AiTokenUsage(
                intOrNull(usageMetadata, "promptTokenCount"),
                intOrNull(usageMetadata, "cachedContentTokenCount"),
                intOrNull(usageMetadata, "candidatesTokenCount"),
                intOrNull(usageMetadata, "thoughtsTokenCount"),
                intOrNull(usageMetadata, "totalTokenCount"));
    }

    private static Integer intOrNull(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value != null && value.canConvertToInt() ? value.asInt() : null;
    }
}
