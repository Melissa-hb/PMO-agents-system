package com.pmo.backend.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.pmo.backend.domain.BancoPregunta;

public interface BancoPreguntaRepository extends JpaRepository<BancoPregunta, UUID> {

    List<BancoPregunta> findAllByOrderByCategoriaAscCodigoAsc();

    List<BancoPregunta> findByTipoEncuestaOrderByCodigoAsc(String tipoEncuesta);
}
