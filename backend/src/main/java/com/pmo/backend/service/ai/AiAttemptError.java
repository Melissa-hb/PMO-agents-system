package com.pmo.backend.service.ai;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AiAttemptError {
    private String provider;
    private String model;
    private String message;
    private Integer status;
}
