package com.pmo.backend.web;

import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pmo.backend.domain.Profile;
import com.pmo.backend.dto.AuditorUserDto;
import com.pmo.backend.repository.ProfileRepository;
import com.pmo.backend.security.CurrentUser;

/** Perfil del usuario autenticado (fetchCurrentUser en AppContext.tsx). Cualquier usuario logueado. */
@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final ProfileRepository profileRepository;
    private final CurrentUser currentUser;

    public ProfileController(ProfileRepository profileRepository, CurrentUser currentUser) {
        this.profileRepository = profileRepository;
        this.currentUser = currentUser;
    }

    @GetMapping
    public AuditorUserDto me() {
        Profile profile = profileRepository.findById(UUID.fromString(currentUser.id()))
                .orElseThrow(() -> new IllegalStateException("No existe un perfil para el usuario autenticado."));
        return AuditorUserDto.from(profile);
    }
}
