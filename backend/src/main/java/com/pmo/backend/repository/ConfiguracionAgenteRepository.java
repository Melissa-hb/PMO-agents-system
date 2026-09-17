package com.pmo.backend.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.pmo.backend.domain.ConfiguracionAgente;

public interface ConfiguracionAgenteRepository extends JpaRepository<ConfiguracionAgente, UUID> {

    Optional<ConfiguracionAgente> findByFaseNumero(Integer faseNumero);
}
