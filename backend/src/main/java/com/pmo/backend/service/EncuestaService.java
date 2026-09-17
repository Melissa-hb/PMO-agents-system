package com.pmo.backend.service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.pmo.backend.domain.BancoPregunta;
import com.pmo.backend.domain.EncuestaLink;
import com.pmo.backend.domain.EncuestaRespuesta;
import com.pmo.backend.dto.BancoPreguntaDto;
import com.pmo.backend.dto.EncuestaRespuestaDto;
import com.pmo.backend.repository.BancoPreguntaRepository;
import com.pmo.backend.repository.EncuestaLinkRepository;
import com.pmo.backend.repository.EncuestaRespuestaRepository;

/** Puerto de useIdoneidad.ts / useMadurez.ts (links y respuestas) + useEncuestaExterna.ts (toma publica). */
@Service
public class EncuestaService {

    private final EncuestaLinkRepository linkRepository;
    private final EncuestaRespuestaRepository respuestaRepository;
    private final BancoPreguntaRepository bancoPreguntaRepository;
    private final ObjectMapper objectMapper;

    public EncuestaService(EncuestaLinkRepository linkRepository, EncuestaRespuestaRepository respuestaRepository,
                            BancoPreguntaRepository bancoPreguntaRepository, ObjectMapper objectMapper) {
        this.linkRepository = linkRepository;
        this.respuestaRepository = respuestaRepository;
        this.bancoPreguntaRepository = bancoPreguntaRepository;
        this.objectMapper = objectMapper;
    }

    public String getActiveLinkToken(UUID projectId, String tipoEncuesta) {
        return linkRepository.findFirstByProyectoIdAndTipoEncuestaAndActivoTrueOrderByCreatedAtDesc(projectId, tipoEncuesta)
                .map(link -> link.getToken().toString())
                .orElse(null);
    }

    @Transactional
    public String generateLink(UUID projectId, String tipoEncuesta) {
        deactivateActiveLinks(projectId, tipoEncuesta);
        EncuestaLink link = EncuestaLink.builder()
                .proyectoId(projectId)
                .activo(true)
                .tipoEncuesta(tipoEncuesta)
                .createdAt(OffsetDateTime.now())
                .build();
        return linkRepository.save(link).getToken().toString();
    }

    @Transactional
    public void deactivateActiveLinks(UUID projectId, String tipoEncuesta) {
        for (EncuestaLink link : linkRepository.findByProyectoIdAndTipoEncuestaAndActivoTrue(projectId, tipoEncuesta)) {
            link.setActivo(false);
            linkRepository.save(link);
        }
    }

    public List<EncuestaRespuestaDto> listRespuestas(UUID projectId, String tipoEncuesta) {
        return respuestaRepository.findByProyectoIdAndTipoEncuestaOrderByCreatedAtDesc(projectId, tipoEncuesta).stream()
                .map(this::toDto)
                .toList();
    }

    // ── Toma publica de encuestas (sin autenticacion, validada por token) ─────────────────

    public record PublicSurveyInfo(UUID proyectoId, String tipoEncuesta, List<BancoPreguntaDto> preguntas) {
    }

    public PublicSurveyInfo loadPublicSurvey(String token) {
        EncuestaLink link = linkRepository.findFirstByTokenAndActivoTrue(parseToken(token))
                .orElseThrow(() -> new IllegalArgumentException("El enlace de la encuesta es invalido o ha expirado."));
        List<BancoPreguntaDto> preguntas = bancoPreguntaRepository.findByTipoEncuestaOrderByCodigoAsc(link.getTipoEncuesta())
                .stream().map(BancoPreguntaDto::from).toList();
        return new PublicSurveyInfo(link.getProyectoId(), link.getTipoEncuesta(), preguntas);
    }

    @Transactional
    public void submitPublicResponse(String token, String nombre, String cargo, String area, Map<String, Double> respuestasPorPreguntaId) {
        EncuestaLink link = linkRepository.findFirstByTokenAndActivoTrue(parseToken(token))
                .orElseThrow(() -> new IllegalArgumentException("El enlace de la encuesta es invalido o ha expirado."));

        List<BancoPregunta> preguntas = bancoPreguntaRepository.findByTipoEncuestaOrderByCodigoAsc(link.getTipoEncuesta());
        Map<String, BancoPregunta> byId = preguntas.stream()
                .collect(java.util.stream.Collectors.toMap(p -> p.getId().toString(), p -> p));

        ArrayNode respuestasArray = objectMapper.createArrayNode();
        for (Map.Entry<String, Double> entry : respuestasPorPreguntaId.entrySet()) {
            BancoPregunta pregunta = byId.get(entry.getKey());
            ObjectNode item = objectMapper.createObjectNode();
            item.put("pregunta_id", entry.getKey());
            item.put("codigo", pregunta != null ? pregunta.getCodigo() : null);
            item.put("valor", entry.getValue());
            respuestasArray.add(item);
        }

        EncuestaRespuesta respuesta = EncuestaRespuesta.builder()
                .proyectoId(link.getProyectoId())
                .linkId(link.getId())
                .nombreEncuestado(nombre)
                .cargoEncuestado(cargo)
                .areaEncuestado(area)
                .tipoEncuesta(link.getTipoEncuesta())
                .respuestas(respuestasArray)
                .createdAt(OffsetDateTime.now())
                .build();

        respuestaRepository.save(respuesta);
    }

    private UUID parseToken(String token) {
        try {
            return UUID.fromString(token);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("El enlace de la encuesta es invalido o ha expirado.");
        }
    }

    private EncuestaRespuestaDto toDto(EncuestaRespuesta r) {
        return new EncuestaRespuestaDto(
                r.getId().toString(), r.getNombreEncuestado(), r.getCargoEncuestado(), r.getAreaEncuestado(),
                r.getRespuestas(), r.getCreatedAt() != null ? r.getCreatedAt().toString() : null
        );
    }
}
