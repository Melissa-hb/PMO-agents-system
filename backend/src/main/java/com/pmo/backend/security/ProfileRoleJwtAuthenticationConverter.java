package com.pmo.backend.security;

import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import com.pmo.backend.domain.Profile;
import com.pmo.backend.repository.ProfileRepository;

/**
 * Los JWT los sigue emitiendo GoTrue (Supabase Auth self-hosted): identidad estandar,
 * no logica de negocio. El rol de aplicacion (admin/auditor/usuario_externo) vive en
 * la tabla `profiles`, asi que se resuelve aqui para no depender de que el token lo traiga.
 */
@Component
public class ProfileRoleJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final ProfileRepository profileRepository;

    public ProfileRoleJwtAuthenticationConverter(ProfileRepository profileRepository) {
        this.profileRepository = profileRepository;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        String userId = jwt.getSubject();
        String appRole = parseUuid(userId)
                .flatMap(profileRepository::findById)
                .map(Profile::getRole)
                .orElse("auditor");

        Collection<GrantedAuthority> authorities = List.of(
                new SimpleGrantedAuthority("ROLE_" + appRole.toUpperCase(Locale.ROOT))
        );

        return new JwtAuthenticationToken(jwt, authorities, userId);
    }

    private java.util.Optional<UUID> parseUuid(String value) {
        try {
            return java.util.Optional.of(UUID.fromString(value));
        } catch (Exception e) {
            return java.util.Optional.empty();
        }
    }
}
