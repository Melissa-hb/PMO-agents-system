package com.pmo.backend.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.pmo.backend.domain.BancoPregunta;
import com.pmo.backend.repository.BancoPreguntaRepository;

/** Puerto de useAdminQuestions() (tabla banco_preguntas). */
@Service
public class BancoPreguntaService {

    private final BancoPreguntaRepository repository;

    public BancoPreguntaService(BancoPreguntaRepository repository) {
        this.repository = repository;
    }

    public List<BancoPregunta> listAll() {
        return repository.findAllByOrderByCategoriaAscCodigoAsc();
    }

    public List<BancoPregunta> listByTipoEncuesta(String tipoEncuesta) {
        return repository.findByTipoEncuestaOrderByCodigoAsc(tipoEncuesta);
    }

    @Transactional
    public BancoPregunta update(UUID id, String texto, String dimension) {
        BancoPregunta pregunta = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pregunta no encontrada: " + id));
        pregunta.setTextoPregunta(texto);
        pregunta.setCategoria(dimension);
        return repository.save(pregunta);
    }

    @Transactional
    public BancoPregunta insert(String texto, String dimension, String tipoEncuestaDbValue) {
        BancoPregunta pregunta = BancoPregunta.builder()
                .textoPregunta(texto)
                .categoria(dimension)
                .tipoEncuesta(tipoEncuestaDbValue)
                .build();
        return repository.save(pregunta);
    }

    @Transactional
    public void delete(UUID id) {
        repository.deleteById(id);
    }
}
