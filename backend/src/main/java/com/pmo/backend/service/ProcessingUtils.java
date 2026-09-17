package com.pmo.backend.service;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** Puerto de _shared/processing.ts. */
public final class ProcessingUtils {

    public static final long PHASE_PROCESSING_STALE_MS = 5 * 60 * 1000L;

    private ProcessingUtils() {
    }

    public static String createRunId(int phaseNumber) {
        return "phase-" + phaseNumber + "-" + System.currentTimeMillis() + "-" + UUID.randomUUID();
    }

    public static boolean isProcessingStale(OffsetDateTime updatedAt) {
        if (updatedAt == null) return true;
        return Duration.between(updatedAt.toInstant(), Instant.now()).toMillis() > PHASE_PROCESSING_STALE_MS;
    }

    public static boolean isProcessingMarker(JsonNode value) {
        return value != null && value.isObject() && value.path("_processing").asBoolean(false);
    }

    public static boolean hasMeaningfulData(JsonNode value) {
        if (value == null || value.isNull() || value.isMissingNode()) return false;
        if (value.isArray()) return value.size() > 0;
        if (value.isObject()) return value.size() > 0;
        return true;
    }

    public static boolean hasCompletedPhaseData(JsonNode value) {
        if (!hasMeaningfulData(value)) return false;
        if (value.isObject()) {
            if (value.path("_error").asBoolean(false)) return false;
            if (value.path("_processing").asBoolean(false)) return false;
            if (!value.path("error").isMissingNode() && !value.path("error").isNull()) return false;
            if ("error".equals(value.path("metadata").path("status").asText(null))) return false;
        }
        return true;
    }

    public static ObjectNode phaseProcessingPayload(ObjectMapper objectMapper, int phaseNumber, String runId) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("_processing", true);
        node.put("_run_id", runId);
        node.put("phaseNumber", phaseNumber);
        node.put("started_at", OffsetDateTime.now().toString());
        return node;
    }
}
