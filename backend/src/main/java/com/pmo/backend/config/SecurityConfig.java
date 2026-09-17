package com.pmo.backend.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.pmo.backend.security.ProfileRoleJwtAuthenticationConverter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(
            HttpSecurity http,
            ProfileRoleJwtAuthenticationConverter authConverter,
            CorsConfigurationSource corsConfigurationSource
    ) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/public/**").permitAll()
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(authConverter)));

        return http.build();
    }

    /**
     * GoTrue (self-hosted, CLI >= 2.x) firma los JWT de sesion con una "signing key" asimetrica
     * (ES256/RS256) propia del proyecto, publicada via JWKS -- ya no con el SUPABASE_JWT_SECRET
     * HS256 estatico (ese secreto solo sirve para acuñar las API keys anon/service_role, no para
     * firmar tokens de usuario). Validamos contra ese JWKS en vez de un secreto compartido.
     */
    @Bean
    public JwtDecoder jwtDecoder(SupabaseProperties supabaseProperties) {
        String url = supabaseProperties.url();
        if (url == null || url.isBlank()) {
            throw new IllegalStateException("Falta configurar SUPABASE_URL.");
        }
        String jwkSetUri = url.replaceAll("/+$", "") + "/auth/v1/.well-known/jwks.json";
        // withJwkSetUri(uri) por defecto solo acepta RS256; GoTrue firma con ES256 (o RS256
        // segun como se haya generado la signing key del proyecto), asi que hay que declarar
        // ambos algoritmos explicitamente o el decoder rechaza tokens validos en silencio.
        return NimbusJwtDecoder.withJwkSetUri(jwkSetUri)
                .jwsAlgorithms(algorithms -> {
                    algorithms.add(SignatureAlgorithm.ES256);
                    algorithms.add(SignatureAlgorithm.RS256);
                })
                .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(AppCorsProperties corsProperties) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(corsProperties.allowedOrigins());
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
