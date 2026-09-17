package com.pmo.backend.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;

import io.hypersistence.utils.hibernate.type.json.JsonType;
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

@Entity
@Table(name = "encuestas_respuestas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EncuestaRespuesta {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "proyecto_id")
    private UUID proyectoId;

    @Column(name = "link_id")
    private UUID linkId;

    @Column(name = "nombre_encuestado")
    private String nombreEncuestado;

    @Column(name = "cargo_encuestado")
    private String cargoEncuestado;

    @Column(name = "area_encuestado")
    private String areaEncuestado;

    @Column(name = "tipo_encuesta")
    private String tipoEncuesta;

    @Type(JsonType.class)
    @Column(columnDefinition = "jsonb")
    private JsonNode respuestas;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}
