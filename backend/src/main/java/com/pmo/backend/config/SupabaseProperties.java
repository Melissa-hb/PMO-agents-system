package com.pmo.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "supabase")
public record SupabaseProperties(
        String url,
        String serviceRoleKey,
        String anonKey,
        Storage storage
) {
    public record Storage(String bucket, long signedUrlTtlSeconds) {
    }
}
