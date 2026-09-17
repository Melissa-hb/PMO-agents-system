package com.pmo.backend.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

import org.hibernate.annotations.ColumnTransformer;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Refleja `public.profiles`. El id coincide con el id del usuario en GoTrue (auth.users.id),
 * que sigue siendo la fuente de identidad; aqui solo vive el perfil/rol de aplicacion.
 */
@Entity
@Table(name = "profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Profile {

    @Id
    private UUID id;

    @Column(name = "full_name")
    private String fullName;

    private String email;

    @ColumnTransformer(write = "?::user_role")
    @Column(columnDefinition = "user_role")
    @Builder.Default
    private String role = "usuario_externo";

    @Column(name = "empresa_id")
    private UUID empresaId;

    @Builder.Default
    private Boolean active = true;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
