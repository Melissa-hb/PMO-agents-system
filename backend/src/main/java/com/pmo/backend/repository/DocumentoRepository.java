package com.pmo.backend.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.pmo.backend.domain.Documento;

public interface DocumentoRepository extends JpaRepository<Documento, UUID> {
    List<Documento> findByProyectoId(UUID proyectoId);

    void deleteByProyectoId(UUID proyectoId);
}
