package com.pmo.backend.web;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pmo.backend.service.EncuestaService;

/**
 * Toma publica de encuestas por token (useEncuestaExterna.ts). Sin autenticacion:
 * ver SecurityConfig, /api/public/** esta en permitAll().
 */
@RestController
@RequestMapping("/api/public/encuestas")
public class PublicSurveyController {

    private final EncuestaService encuestaService;

    public PublicSurveyController(EncuestaService encuestaService) {
        this.encuestaService = encuestaService;
    }

    @GetMapping("/{token}")
    public EncuestaService.PublicSurveyInfo load(@PathVariable String token) {
        return encuestaService.loadPublicSurvey(token);
    }

    public record SubmitRequest(String nombre, String cargo, String area, Map<String, Double> respuestas) {
    }

    @PostMapping("/{token}/respuestas")
    public void submit(@PathVariable String token, @RequestBody SubmitRequest request) {
        encuestaService.submitPublicResponse(token, request.nombre(), request.cargo(), request.area(), request.respuestas());
    }
}
