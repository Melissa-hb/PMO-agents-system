package com.pmo.backend.web;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pmo.backend.dto.AuditorUserDto;
import com.pmo.backend.service.AdminUserService;

/** Requiere ROLE_ADMIN (ver SecurityConfig: /api/admin/** ). Reemplaza create-user + useAdminUsers. */
@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    public List<AuditorUserDto> list() {
        return adminUserService.listUsers().stream().map(AuditorUserDto::from).toList();
    }

    public record CreateUserRequest(String name, String email, String password, String role) {
    }

    @PostMapping
    public AuditorUserDto create(@RequestBody CreateUserRequest request) {
        return AuditorUserDto.from(adminUserService.createUser(request.name(), request.email(), request.password(), request.role()));
    }

    public record UpdateUserRequest(String name, String role) {
    }

    @PutMapping("/{id}")
    public AuditorUserDto update(@PathVariable String id, @RequestBody UpdateUserRequest request) {
        return AuditorUserDto.from(adminUserService.updateUser(id, request.name(), request.role()));
    }

    @PatchMapping("/{id}/active")
    public AuditorUserDto toggleActive(@PathVariable String id) {
        return AuditorUserDto.from(adminUserService.toggleActive(id));
    }
}
