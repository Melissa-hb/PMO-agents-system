package com.pmo.backend.service;

import java.time.Duration;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.fasterxml.jackson.databind.JsonNode;

import com.pmo.backend.config.SupabaseProperties;

/**
 * Cliente de la Admin API de GoTrue (Supabase Auth self-hosted). Reemplaza el uso de
 * `supabaseAdmin.auth.admin.createUser(...)` que hacia la Edge Function `create-user`.
 * Requiere la Service Role Key: nunca debe exponerse al frontend.
 */
@Component
public class GoTrueAdminClient {

    private final WebClient.Builder webClientBuilder;
    private final SupabaseProperties supabaseProperties;

    public GoTrueAdminClient(WebClient.Builder webClientBuilder, SupabaseProperties supabaseProperties) {
        this.webClientBuilder = webClientBuilder;
        this.supabaseProperties = supabaseProperties;
    }

    public JsonNode createUser(String email, String password, String fullName) {
        requireConfig();
        try {
            return webClientBuilder.build().post()
                    .uri(supabaseProperties.url() + "/auth/v1/admin/users")
                    .header("apikey", supabaseProperties.serviceRoleKey())
                    .header("Authorization", "Bearer " + supabaseProperties.serviceRoleKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of(
                            "email", email,
                            "password", password,
                            "email_confirm", true,
                            "user_metadata", Map.of("full_name", fullName)
                    ))
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .block(Duration.ofSeconds(30));
        } catch (WebClientResponseException e) {
            throw new GoTrueAdminException("GoTrue admin.createUser fallo (" + e.getStatusCode() + "): " + e.getResponseBodyAsString());
        }
    }

    private void requireConfig() {
        if (supabaseProperties.url() == null || supabaseProperties.url().isBlank()
                || supabaseProperties.serviceRoleKey() == null || supabaseProperties.serviceRoleKey().isBlank()) {
            throw new IllegalStateException("Falta configurar SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
        }
    }

    public static class GoTrueAdminException extends RuntimeException {
        public GoTrueAdminException(String message) {
            super(message);
        }
    }
}
