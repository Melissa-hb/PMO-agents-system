package com.pmo.backend.service.ai;

import java.time.OffsetDateTime;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.pmo.backend.domain.IaUsoTokens;
import com.pmo.backend.repository.IaUsoTokensRepository;

/**
 * Registra el consumo de tokens de cada llamada exitosa a la IA en `ia_uso_tokens` y en el log.
 * Nunca interrumpe la ejecucion del agente: si falla el registro solo se deja una advertencia.
 */
@Service
public class TokenUsageRecorder {

    private static final Logger log = LoggerFactory.getLogger(TokenUsageRecorder.class);

    private final IaUsoTokensRepository repository;

    public TokenUsageRecorder(IaUsoTokensRepository repository) {
        this.repository = repository;
    }

    public void record(UUID projectId, int phaseNumber, AiGenerateResult result, long durationMs) {
        AiTokenUsage usage = result != null ? result.getUsage() : null;
        if (usage == null) {
            log.warn("[ia-tokens] proyecto={} fase={} sin usageMetadata en la respuesta", projectId, phaseNumber);
            return;
        }
        log.info("[ia-tokens] proyecto={} fase={} modelo={} entrada={} cacheados={} salida={} razonamiento={} total={} duracion_ms={}",
                projectId, phaseNumber, result.getModel(), usage.promptTokens(), usage.cachedTokens(),
                usage.outputTokens(), usage.thoughtsTokens(), usage.totalTokens(), durationMs);
        try {
            repository.save(IaUsoTokens.builder()
                    .proyectoId(projectId)
                    .faseNumero(phaseNumber)
                    .modelo(result.getModel())
                    .promptTokens(usage.promptTokens())
                    .cachedTokens(usage.cachedTokens())
                    .outputTokens(usage.outputTokens())
                    .thoughtsTokens(usage.thoughtsTokens())
                    .totalTokens(usage.totalTokens())
                    .duracionMs((int) Math.min(durationMs, Integer.MAX_VALUE))
                    .createdAt(OffsetDateTime.now())
                    .build());
        } catch (Exception e) {
            log.warn("[ia-tokens] No se pudo guardar el consumo de tokens (proyecto={} fase={}): {}",
                    projectId, phaseNumber, e.getMessage());
        }
    }
}
