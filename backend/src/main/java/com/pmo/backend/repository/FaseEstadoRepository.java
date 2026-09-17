package com.pmo.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.pmo.backend.domain.FaseEstado;

public interface FaseEstadoRepository extends JpaRepository<FaseEstado, UUID> {

    List<FaseEstado> findByProyectoId(UUID proyectoId);

    Optional<FaseEstado> findByProyectoIdAndNumeroFase(UUID proyectoId, Integer numeroFase);

    List<FaseEstado> findByProyectoIdAndNumeroFaseIn(UUID proyectoId, List<Integer> numerosFase);

    List<FaseEstado> findByProyectoIdAndNumeroFaseGreaterThan(UUID proyectoId, Integer numeroFase);

    void deleteByProyectoId(UUID proyectoId);
}
