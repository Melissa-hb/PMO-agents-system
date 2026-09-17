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

@Entity
@Table(name = "encuestas_links")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EncuestaLink {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "proyecto_id")
    private UUID proyectoId;

    @Builder.Default
    private UUID token = UUID.randomUUID();

    @Builder.Default
    private Boolean activo = true;

    @Column(name = "tipo_encuesta")
    private String tipoEncuesta;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}
