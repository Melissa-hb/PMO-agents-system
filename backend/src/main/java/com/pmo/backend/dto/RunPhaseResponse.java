package com.pmo.backend.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record RunPhaseResponse(boolean success, int phaseNumber, String processingTime, JsonNode data,
                                Boolean cached, Boolean inProgress, String error) {

    public static RunPhaseResponse ok(int phaseNumber, String processingTime, JsonNode data) {
        return new RunPhaseResponse(true, phaseNumber, processingTime, data, null, null, null);
    }

    public static RunPhaseResponse cached(int phaseNumber, JsonNode data) {
        return new RunPhaseResponse(true, phaseNumber, "0.00", data, true, null, null);
    }

    public static RunPhaseResponse inProgress(int phaseNumber, JsonNode data) {
        return new RunPhaseResponse(true, phaseNumber, "0.00", data, null, true, null);
    }
}
