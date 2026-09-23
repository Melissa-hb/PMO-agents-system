package com.pmo.backend.service.ai;

import java.util.List;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AiGenerateResult {
    private String text;
    private String finishReason;
    private String provider;
    private String model;
    private List<String> attemptedModels;
    private List<AiAttemptError> errors;
    private boolean fallbackUsed;
    /** Consumo de tokens de la llamada exitosa (null si Gemini no lo informo). */
    private AiTokenUsage usage;
}
