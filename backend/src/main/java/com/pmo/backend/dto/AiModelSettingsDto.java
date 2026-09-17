package com.pmo.backend.dto;

import java.time.OffsetDateTime;

import com.pmo.backend.domain.AiModelSettings;

public record AiModelSettingsDto(
        String id,
        String provider,
        String selectedModel,
        String fallbackModel,
        OffsetDateTime updatedAt
) {
    public static AiModelSettingsDto from(AiModelSettings entity) {
        return new AiModelSettingsDto(
                "global",
                entity.getProvider(),
                entity.getSelectedModel(),
                entity.getFallbackModel(),
                entity.getUpdatedAt()
        );
    }
}
