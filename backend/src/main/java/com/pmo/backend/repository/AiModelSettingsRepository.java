package com.pmo.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.pmo.backend.domain.AiModelSettings;

public interface AiModelSettingsRepository extends JpaRepository<AiModelSettings, String> {
}
