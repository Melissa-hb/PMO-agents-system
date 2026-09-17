package com.pmo.backend.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.pmo.backend.domain.Entrevista;

public interface EntrevistaRepository extends JpaRepository<Entrevista, UUID> {
    List<Entrevista> findByProyectoIdOrderByCreatedAtAsc(UUID proyectoId);

    void deleteByProyectoId(UUID proyectoId);
}
