package com.pmo.backend.service.ai;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class GenerationConfig {
    @Builder.Default
    private Double temperature = 1.0;
    @Builder.Default
    private Integer maxOutputTokens = 16384;
    @Builder.Default
    private long providerTimeoutMs = 110_000L;
    @Builder.Default
    private String responseMimeType = "application/json";
}
