package com.pmo.backend.dto;

public record CreateProjectRequest(
        String companyName,
        String projectName,
        String startDate,
        String tamano,
        String mision,
        String vision,
        String auditorId
) {
}
