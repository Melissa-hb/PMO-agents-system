package com.pmo.backend.domain;

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
@Table(name = "banco_preguntas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BancoPregunta {

    @Id
    @GeneratedValue
    private UUID id;

    private String codigo;

    private String categoria;

    @Column(name = "texto_pregunta")
    private String textoPregunta;

    @Column(name = "tipo_encuesta")
    private String tipoEncuesta;

    /** ej. 'likert_10'. Determina si en la UI se trata como pregunta 'abierta' o 'si_no'. */
    private String tipo;
}
