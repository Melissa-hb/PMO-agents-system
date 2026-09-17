package com.pmo.backend.dto;

import java.util.List;

public record ProjectDto(
        String id,
        String companyName,
        String projectName,
        String startDate,
        String tamano,
        String mision,
        String vision,
        List<AuditorDto> auditors,
        List<PhaseDto> phases,
        String status,
        boolean isDeleted
) {
}
