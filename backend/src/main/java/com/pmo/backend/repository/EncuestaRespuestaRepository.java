package com.pmo.backend.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.pmo.backend.domain.EncuestaRespuesta;

public interface EncuestaRespuestaRepository extends JpaRepository<EncuestaRespuesta, UUID> {

    List<EncuestaRespuesta> findByProyectoIdAndTipoEncuestaOrderByCreatedAtDesc(UUID proyectoId, String tipoEncuesta);

    void deleteByProyectoId(UUID proyectoId);
}
