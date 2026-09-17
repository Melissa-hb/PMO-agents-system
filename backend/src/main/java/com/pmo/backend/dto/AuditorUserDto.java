package com.pmo.backend.dto;

import com.pmo.backend.domain.Profile;

public record AuditorUserDto(String id, String name, String email, String role, String updatedAt, boolean active) {
    public static AuditorUserDto from(Profile p) {
        return new AuditorUserDto(
                p.getId().toString(),
                p.getFullName() != null ? p.getFullName() : "Sin nombre",
                p.getEmail() != null ? p.getEmail() : "",
                p.getRole() != null ? p.getRole() : "auditor",
                p.getUpdatedAt() != null ? p.getUpdatedAt().toString() : null,
                p.getActive() == null || p.getActive()
        );
    }
}
