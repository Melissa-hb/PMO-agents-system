package com.pmo.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.pmo.backend.domain.EncuestaLink;

public interface EncuestaLinkRepository extends JpaRepository<EncuestaLink, UUID> {

    Optional<EncuestaLink> findFirstByProyectoIdAndTipoEncuestaAndActivoTrueOrderByCreatedAtDesc(
            UUID proyectoId, String tipoEncuesta);

    List<EncuestaLink> findByProyectoIdAndTipoEncuestaAndActivoTrue(UUID proyectoId, String tipoEncuesta);

    Optional<EncuestaLink> findFirstByTokenAndActivoTrue(UUID token);
}
