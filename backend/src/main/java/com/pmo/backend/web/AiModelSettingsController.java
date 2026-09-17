package com.pmo.backend.web;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pmo.backend.domain.AiModelSettings;
import com.pmo.backend.dto.AiModelSettingsDto;
import com.pmo.backend.service.ai.AiModelSettingsService;

/**
 * Reemplaza el acceso directo del frontend a la tabla `ai_model_settings`.
 * La lectura queda abierta a cualquier usuario autenticado (igual que la policy RLS original
 * "ai_model_settings_select_authenticated"); solo ADMIN puede cambiar el modelo activo.
 */
@RestController
@RequestMapping("/api/ai-model-settings")
public class AiModelSettingsController {

    private final AiModelSettingsService service;

    public AiModelSettingsController(AiModelSettingsService service) {
        this.service = service;
    }

    @GetMapping
    public AiModelSettingsDto get() {
        return AiModelSettingsDto.from(service.getOrDefaultEntity());
    }

    public record UpdateSelectedModelRequest(String selectedModel, String fallbackModel) {
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public AiModelSettingsDto update(@RequestBody UpdateSelectedModelRequest request) {
        AiModelSettings updated = service.updateSelectedModel(request.selectedModel(), request.fallbackModel());
        return AiModelSettingsDto.from(updated);
    }
}
