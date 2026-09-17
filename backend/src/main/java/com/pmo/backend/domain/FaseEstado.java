package com.pmo.backend.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.Type;

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

/**
 * Refleja `public.fases_estado`. El PK real es `id` (uuid); (proyecto_id, numero_fase) es
 * una unique constraint aparte, usada como clave natural por el flujo de agentes (upsert
 * con onConflict: "proyecto_id,numero_fase").
 */
@Entity
@Table(name = "fases_estado")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FaseEstado {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "proyecto_id")
    private UUID proyectoId;

    @Column(name = "numero_fase")
    private Integer numeroFase;

    @ColumnTransformer(write = "?::estado_fase")
    @Column(name = "estado_visual", columnDefinition = "estado_fase")
    private String estadoVisual;

    @Type(JsonType.class)
    @Column(name = "datos_consolidados", columnDefinition = "jsonb")
    private JsonNode datosConsolidados;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
