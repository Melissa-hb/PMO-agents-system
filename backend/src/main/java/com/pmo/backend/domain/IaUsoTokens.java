package com.pmo.backend.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Refleja `public.ia_uso_tokens`: consumo de tokens de cada llamada exitosa a Gemini. */
@Entity
@Table(name = "ia_uso_tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IaUsoTokens {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "proyecto_id")
    private UUID proyectoId;

    @Column(name = "fase_numero")
    private Integer faseNumero;

    @Column(name = "modelo")
    private String modelo;

    @Column(name = "prompt_tokens")
    private Integer promptTokens;

    @Column(name = "cached_tokens")
    private Integer cachedTokens;

    @Column(name = "output_tokens")
    private Integer outputTokens;

    @Column(name = "thoughts_tokens")
    private Integer thoughtsTokens;

    @Column(name = "total_tokens")
    private Integer totalTokens;

    @Column(name = "duracion_ms")
    private Integer duracionMs;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}
