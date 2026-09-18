package com.pmo.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ai")
public record AiProperties(Gemini gemini) {
    public record Gemini(String apiKey) {
    }
}
