package com.pmo.backend.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.pmo.backend.domain.FaseEstado;

public record PhaseStateDto(String estadoVisual, JsonNode datosConsolidados, String updatedAt) {

    public static PhaseStateDto from(FaseEstado fase) {
        if (fase == null) return new PhaseStateDto(null, null, null);
        return new PhaseStateDto(
                fase.getEstadoVisual(),
                fase.getDatosConsolidados(),
                fase.getUpdatedAt() != null ? fase.getUpdatedAt().toString() : null
        );
    }
}
