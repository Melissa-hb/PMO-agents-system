package com.pmo.backend.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.pmo.backend.domain.Empresa;

public interface EmpresaRepository extends JpaRepository<Empresa, UUID> {
    Optional<Empresa> findFirstByNombreIgnoreCase(String nombre);
}
