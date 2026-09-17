package com.pmo.backend.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record EncuestaRespuestaDto(
        String id,
        String nombreEncuestado,
        String cargoEncuestado,
        String areaEncuestado,
        JsonNode respuestas,
        String createdAt
) {
}
