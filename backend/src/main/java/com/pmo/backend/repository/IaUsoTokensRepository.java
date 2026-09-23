package com.pmo.backend.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.pmo.backend.domain.IaUsoTokens;

public interface IaUsoTokensRepository extends JpaRepository<IaUsoTokens, UUID> {
}
