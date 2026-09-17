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
}
