package com.pmo.backend.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.pmo.backend.domain.Profile;

public interface ProfileRepository extends JpaRepository<Profile, UUID> {
    List<Profile> findAllByOrderByFullNameAsc();
}
