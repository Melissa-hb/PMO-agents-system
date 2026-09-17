package com.pmo.backend.domain;

import java.math.BigDecimal;
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

/**
 * Refleja `public.configuracion_agentes`: aqui viven los prompts de sistema de cada fase
 * (prompt_sistema), editables sin tocar codigo. El PK real es `id` (uuid); `fase_numero`
 * es la clave natural que usa el flujo original (`.eq("fase_numero", phaseNumber).single()`),
 * con una unique constraint aparte.
 */
@Entity
@Table(name = "configuracion_agentes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConfiguracionAgente {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "fase_numero")
    private Integer faseNumero;

    @Column(name = "nombre_fase")
    private String nombreFase;

    @Column(name = "prompt_sistema")
    private String promptSistema;

    private String modelo;

    private BigDecimal temperatura;
}
