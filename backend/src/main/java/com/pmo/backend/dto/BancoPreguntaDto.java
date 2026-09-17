package com.pmo.backend.dto;

import com.pmo.backend.domain.BancoPregunta;

public record BancoPreguntaDto(String id, String codigo, String categoria, String textoPregunta) {
    public static BancoPreguntaDto from(BancoPregunta p) {
        return new BancoPreguntaDto(p.getId().toString(), p.getCodigo(), p.getCategoria(), p.getTextoPregunta());
    }
}
