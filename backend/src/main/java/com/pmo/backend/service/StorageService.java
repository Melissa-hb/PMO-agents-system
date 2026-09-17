package com.pmo.backend.service;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.pmo.backend.config.SupabaseProperties;

/**
 * Proxy hacia Supabase Storage (self-hosted expone la misma API REST que Supabase Cloud).
 * El almacenamiento de archivos, igual que Auth, se mantiene como servicio de infraestructura
 * generico; la logica de negocio sobre esos archivos vive en este backend.
 */
@Service
public class StorageService {

    private final WebClient.Builder webClientBuilder;
    private final SupabaseProperties supabaseProperties;
    private final ObjectMapper objectMapper;

    public StorageService(WebClient.Builder webClientBuilder, SupabaseProperties supabaseProperties, ObjectMapper objectMapper) {
        this.webClientBuilder = webClientBuilder;
        this.supabaseProperties = supabaseProperties;
        this.objectMapper = objectMapper;
    }

    private String bucket() {
        return supabaseProperties.storage().bucket();
    }

    public void upload(String path, byte[] bytes, String contentType) {
        webClientBuilder.build().post()
                .uri(supabaseProperties.url() + "/storage/v1/object/" + bucket() + "/" + encodePath(path))
                .header("Authorization", "Bearer " + supabaseProperties.serviceRoleKey())
                .header("x-upsert", "false")
                .contentType(contentType != null ? MediaType.parseMediaType(contentType) : MediaType.APPLICATION_OCTET_STREAM)
                .bodyValue(bytes)
                .retrieve()
                .toBodilessEntity()
                .block(Duration.ofSeconds(60));
    }

    public String createSignedUrl(String path, long expiresInSeconds) {
        try {
            JsonNode result = webClientBuilder.build().post()
                    .uri(supabaseProperties.url() + "/storage/v1/object/sign/" + bucket() + "/" + encodePath(path))
                    .header("Authorization", "Bearer " + supabaseProperties.serviceRoleKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of("expiresIn", expiresInSeconds))
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .block(Duration.ofSeconds(30));

            String signedURL = result.path("signedURL").asText(null);
            if (signedURL == null) return null;
            return supabaseProperties.url() + "/storage/v1" + signedURL;
        } catch (WebClientResponseException e) {
            return null;
        }
    }

    public void remove(List<String> paths) {
        if (paths.isEmpty()) return;
        webClientBuilder.build().method(org.springframework.http.HttpMethod.DELETE)
                .uri(supabaseProperties.url() + "/storage/v1/object/" + bucket())
                .header("Authorization", "Bearer " + supabaseProperties.serviceRoleKey())
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("prefixes", paths))
                .retrieve()
                .toBodilessEntity()
                .block(Duration.ofSeconds(30));
    }

    public JsonNode list(String prefix) {
        return webClientBuilder.build().post()
                .uri(supabaseProperties.url() + "/storage/v1/object/list/" + bucket())
                .header("Authorization", "Bearer " + supabaseProperties.serviceRoleKey())
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("prefix", prefix, "limit", 1000, "sortBy", Map.of("column", "created_at", "order", "desc")))
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block(Duration.ofSeconds(30));
    }

    /** Re-firma una URL ya generada (o una ruta cruda) para asegurar que no expiro. Espejo de ensureFreshUrl(). */
    public String ensureFreshUrl(String url) {
        if (url == null || url.isBlank()) return url;
        try {
            String relPath = url;
            if (url.contains(bucket() + "/")) {
                String afterBucket = url.substring(url.indexOf(bucket() + "/") + bucket().length() + 1);
                relPath = afterBucket.split("\\?token=")[0];
                relPath = java.net.URLDecoder.decode(relPath, java.nio.charset.StandardCharsets.UTF_8);
            } else if (url.startsWith("http")) {
                return url;
            }
            String fresh = createSignedUrl(relPath, supabaseProperties.storage().signedUrlTtlSeconds());
            return fresh != null ? fresh : url;
        } catch (Exception e) {
            return url;
        }
    }

    private String encodePath(String path) {
        return java.net.URLEncoder.encode(path, java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20").replace("%2F", "/");
    }
}
