package com.pmo.backend.service.phases;

import com.fasterxml.jackson.databind.JsonNode;

/** Helpers de types.ts (unwrapDiagnosis) + los "usableDiagnosis"/"unwrapPhaseOutput" repetidos en varios phaseX.ts. */
public final class PhaseJsonUtils {

    private PhaseJsonUtils() {
    }

    public static JsonNode unwrapDiagnosis(JsonNode value) {
        if (value != null && value.hasNonNull("diagnosis")) return value.get("diagnosis");
        return value;
    }

    /** Puerto de usableDiagnosis() en phase4.ts: descarta placeholders de error/procesando. */
    public static JsonNode usableDiagnosis(JsonNode value) {
        JsonNode diagnosis = unwrapDiagnosis(value);
        if (diagnosis == null || !diagnosis.isObject()) return null;
        if (diagnosis.path("_processing").asBoolean(false)) return null;
        if (diagnosis.path("_error").asBoolean(false)) return null;
        if (!diagnosis.path("error").isMissingNode() && !diagnosis.path("error").isNull()) return null;
        if ("error".equals(diagnosis.path("metadata").path("status").asText(null))) return null;
        return diagnosis;
    }

    /** Puerto de unwrapPhaseOutput() en phase6.ts/phase7.ts/phase9.ts: prioriza _current (revisiones de fase 7). */
    public static JsonNode unwrapPhaseOutput(JsonNode value) {
        if (value == null) return null;
        if (value.hasNonNull("_current")) return value.get("_current");
        if (value.hasNonNull("diagnosis")) return value.get("diagnosis");
        if (value.path("data").hasNonNull("diagnosis")) return value.path("data").get("diagnosis");
        if (value.hasNonNull("data")) return value.get("data");
        return value;
    }
}
