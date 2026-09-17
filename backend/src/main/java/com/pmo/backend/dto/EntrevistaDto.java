package com.pmo.backend.dto;

public record EntrevistaDto(
        String id,
        String nombre,
        String cargo,
        String area,
        String notas,
        String fileName,
        String storagePath,
        String createdAt
) {
}
