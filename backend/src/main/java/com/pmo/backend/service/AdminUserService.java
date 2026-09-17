package com.pmo.backend.service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;

import com.pmo.backend.domain.Profile;
import com.pmo.backend.repository.ProfileRepository;

/** Puerto de la Edge Function `create-user` + los hooks de administracion de usuarios de useAdmin.ts. */
@Service
public class AdminUserService {

    private final ProfileRepository profileRepository;
    private final GoTrueAdminClient goTrueAdminClient;

    public AdminUserService(ProfileRepository profileRepository, GoTrueAdminClient goTrueAdminClient) {
        this.profileRepository = profileRepository;
        this.goTrueAdminClient = goTrueAdminClient;
    }

    public List<Profile> listUsers() {
        return profileRepository.findAllByOrderByFullNameAsc();
    }

    @Transactional
    public Profile createUser(String name, String email, String password, String role) {
        if (name == null || name.isBlank() || email == null || email.isBlank() || password == null || password.isBlank()) {
            throw new IllegalArgumentException("Faltan campos requeridos: name, email, password");
        }

        JsonNode authResponse = goTrueAdminClient.createUser(email, password, name);
        String userId = authResponse.path("id").asText(null);
        if (userId == null) {
            throw new IllegalStateException("GoTrue no devolvio el id del usuario creado: " + authResponse);
        }

        Profile profile = Profile.builder()
                .id(UUID.fromString(userId))
                .fullName(name)
                .email(email)
                .role(role != null && !role.isBlank() ? role : "auditor")
                .active(true)
                .updatedAt(OffsetDateTime.now())
                .build();

        return profileRepository.save(profile);
    }

    @Transactional
    public Profile updateUser(String id, String name, String role) {
        Profile profile = profileRepository.findById(UUID.fromString(id))
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado: " + id));
        profile.setFullName(name);
        profile.setRole(role);
        profile.setUpdatedAt(OffsetDateTime.now());
        return profileRepository.save(profile);
    }

    @Transactional
    public Profile toggleActive(String id) {
        Profile profile = profileRepository.findById(UUID.fromString(id))
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado: " + id));
        profile.setActive(!(profile.getActive() != null && profile.getActive()));
        profile.setUpdatedAt(OffsetDateTime.now());
        return profileRepository.save(profile);
    }
}
