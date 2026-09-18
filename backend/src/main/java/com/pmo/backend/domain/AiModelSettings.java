package com.pmo.backend.domain;

import java.time.OffsetDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Fila unica ('global') con el modelo de IA activo, servido via Gemini. Reutiliza las
 * columnas de la tabla original (ver migraciones 202605*_*_ai_model_settings.sql) con un
 * significado mas simple: selected_model/openai_model ahora guardan nombres de modelo de
 * Gemini (ej. "gemini-pro-latest") en vez de nombres de un enum fijo de OpenAI/Anthropic. Las
 * columnas anthropic_model/high_model/low_model quedan sin usar (no se borran para no
 * requerir una migracion; Hibernate en modo 'validate' ignora columnas no mapeadas).
 */
@Entity
@Table(name = "ai_model_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiModelSettings {

    @Id
    @Builder.Default
    private String id = "global";

    /** Vendor derivado del nombre de selectedModel, solo informativo. */
    @Builder.Default
    private String provider = "gemini";

    /** Nombre de modelo de Gemini primario, ej. "gemini-pro-latest". */
    @Column(name = "selected_model")
    private String selectedModel;

    /** Nombre de modelo de Gemini de respaldo. Reutiliza la columna openai_model. */
    @Column(name = "openai_model")
    private String fallbackModel;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
