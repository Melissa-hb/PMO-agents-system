package com.pmo.backend.service.ai;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
class AiCallResult {
    private boolean ok;
    private int status;
    private String finishReason;
    private String text;
    private String errorMessage;
    private AiTokenUsage usage;
}
