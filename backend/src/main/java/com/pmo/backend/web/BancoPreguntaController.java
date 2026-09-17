package com.pmo.backend.web;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pmo.backend.domain.BancoPregunta;
import com.pmo.backend.service.BancoPreguntaService;

@RestController
@RequestMapping("/api/admin/banco-preguntas")
public class BancoPreguntaController {

    private final BancoPreguntaService service;

    public BancoPreguntaController(BancoPreguntaService service) {
        this.service = service;
    }

    @GetMapping
    public List<BancoPregunta> list() {
        return service.listAll();
    }

    public record UpdateRequest(String text, String dimension) {
    }

    @PutMapping("/{id}")
    public BancoPregunta update(@PathVariable UUID id, @RequestBody UpdateRequest request) {
        return service.update(id, request.text(), request.dimension());
    }

    public record InsertRequest(String text, String dimension, String surveyType) {
    }

    @PostMapping
    public BancoPregunta insert(@RequestBody InsertRequest request) {
        String dbSurveyType = denormalizeSurveyType(request.surveyType());
        return service.insert(request.text(), request.dimension(), dbSurveyType);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }

    private String denormalizeSurveyType(String display) {
        String v = display == null ? "" : display.toLowerCase();
        if (v.contains("predictiva")) return "madurez_predictiva";
        if (v.contains("agil") || v.contains("ágil")) return "madurez_agil";
        return "idoneidad";
    }
}
