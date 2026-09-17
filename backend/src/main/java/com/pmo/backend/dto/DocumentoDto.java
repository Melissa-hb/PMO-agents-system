package com.pmo.backend.dto;

public record DocumentoDto(
        String id,
        String name,
        long size,
        String type,
        String category,
        String customCategory,
        String storagePath
) {
}
