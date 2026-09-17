package com.pmo.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ai")
public record AiProperties(Openrouter openrouter) {
    public record Openrouter(String apiKey, String siteUrl, String appName) {
    }
}
