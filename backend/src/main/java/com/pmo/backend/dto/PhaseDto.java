package com.pmo.backend.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record PhaseDto(
        int number,
        String name,
        String status,
        String completedAt,
        String agentDiagnosis,
        JsonNode agentData
) {
}
