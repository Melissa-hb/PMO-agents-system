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
@Table(name = "documentos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Documento {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "proyecto_id")
    private UUID proyectoId;

    @Column(name = "uploaded_by")
    private UUID uploadedBy;

    @Column(name = "storage_path")
    private String storagePath;

    private String categoria;

    @Column(name = "nombre_personalizado")
    private String nombrePersonalizado;

    @Type(JsonType.class)
    @Column(columnDefinition = "jsonb")
    private JsonNode metadatos;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}
