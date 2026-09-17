package com.pmo.backend.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.pmo.backend.domain.Proyecto;

public interface ProyectoRepository extends JpaRepository<Proyecto, UUID> {
    List<Proyecto> findAllByOrderByCreatedAtDesc();
}
