package com.pmo.backend.service.ai;

public record NormalizedAiModelSettings(
        String provider,
        String selectedModel,
        String fallbackModel
) {
}
