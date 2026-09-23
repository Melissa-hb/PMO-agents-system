package com.pmo.backend.service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;

import com.pmo.backend.service.phases.PhaseDataFlow;
import com.pmo.backend.domain.Empresa;
import com.pmo.backend.domain.FaseEstado;
import com.pmo.backend.domain.Profile;
import com.pmo.backend.domain.Proyecto;
import com.pmo.backend.dto.AuditorDto;
import com.pmo.backend.dto.CreateProjectRequest;
import com.pmo.backend.dto.EditProjectRequest;
import com.pmo.backend.dto.PhaseDto;
import com.pmo.backend.dto.ProjectDto;
import com.pmo.backend.repository.DocumentoRepository;
import com.pmo.backend.repository.EmpresaRepository;
import com.pmo.backend.repository.EncuestaRespuestaRepository;
import com.pmo.backend.repository.EntrevistaRepository;
import com.pmo.backend.repository.FaseEstadoRepository;
import com.pmo.backend.repository.ProfileRepository;
import com.pmo.backend.repository.ProyectoRepository;

/** Puerto de AppContext.tsx (fetchProjects, addProject, editProject, updatePhaseStatus, reprocessPhase, trash/restore/delete). */
@Service
public class ProyectoService {

    private static final DateTimeFormatter ES_CO_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final ProyectoRepository proyectoRepository;
    private final EmpresaRepository empresaRepository;
    private final FaseEstadoRepository faseEstadoRepository;
    private final ProfileRepository profileRepository;
    private final EncuestaRespuestaRepository encuestaRespuestaRepository;
    private final EntrevistaRepository entrevistaRepository;
    private final DocumentoRepository documentoRepository;

    public ProyectoService(ProyectoRepository proyectoRepository, EmpresaRepository empresaRepository,
                            FaseEstadoRepository faseEstadoRepository, ProfileRepository profileRepository,
                            EncuestaRespuestaRepository encuestaRespuestaRepository,
                            EntrevistaRepository entrevistaRepository, DocumentoRepository documentoRepository) {
        this.proyectoRepository = proyectoRepository;
        this.empresaRepository = empresaRepository;
        this.faseEstadoRepository = faseEstadoRepository;
        this.profileRepository = profileRepository;
        this.encuestaRespuestaRepository = encuestaRespuestaRepository;
        this.entrevistaRepository = entrevistaRepository;
        this.documentoRepository = documentoRepository;
    }

    public List<ProjectDto> listProjects() {
        return proyectoRepository.findAllByOrderByCreatedAtDesc().stream().map(this::toDto).toList();
    }

    @Transactional
    public ProjectDto addProject(CreateProjectRequest req, String currentUserId) {
        Empresa empresa = findOrCreateEmpresa(req.companyName());

        Proyecto proyecto = Proyecto.builder()
                .empresa(empresa)
                .auditorId(UUID.fromString(req.auditorId() != null && !req.auditorId().isBlank() ? req.auditorId() : currentUserId))
                .nombreProyecto(req.projectName())
                .tamano(blankToNull(req.tamano()))
                .mision(blankToNull(req.mision()))
                .vision(blankToNull(req.vision()))
                .faseActual(1)
                .fechaInicio(req.startDate() != null && !req.startDate().isBlank() ? LocalDate.parse(req.startDate()) : LocalDate.now())
                .createdAt(OffsetDateTime.now())
                .isDeleted(false)
                .build();
        proyecto = proyectoRepository.save(proyecto);

        List<PhaseAvailability.MutablePhase> initial = PhaseAvailability.createInitialPhases();
        for (PhaseAvailability.MutablePhase phase : initial) {
            FaseEstado fe = FaseEstado.builder()
                    .proyectoId(proyecto.getId())
                    .numeroFase(phase.number)
                    .estadoVisual(phase.status)
                    .build();
            faseEstadoRepository.save(fe);
        }

        return toDto(proyecto);
    }

    @Transactional
    public ProjectDto editProject(UUID id, EditProjectRequest req) {
        Proyecto proyecto = proyectoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Proyecto no encontrado: " + id));

        Empresa empresa = findOrCreateEmpresa(req.companyName());
        proyecto.setEmpresa(empresa);
        proyecto.setNombreProyecto(req.projectName());
        if (req.auditorId() != null && !req.auditorId().isBlank()) {
            proyecto.setAuditorId(UUID.fromString(req.auditorId()));
        }
        return toDto(proyectoRepository.save(proyecto));
    }

    @Transactional
    public void moveToTrash(UUID id) {
        Proyecto proyecto = proyectoRepository.findById(id).orElseThrow();
        proyecto.setIsDeleted(true);
        proyectoRepository.save(proyecto);
    }

    @Transactional
    public void restoreProject(UUID id) {
        Proyecto proyecto = proyectoRepository.findById(id).orElseThrow();
        proyecto.setIsDeleted(false);
        proyectoRepository.save(proyecto);
    }

    @Transactional
    public void deleteProject(UUID id) {
        encuestaRespuestaRepository.deleteByProyectoId(id);
        entrevistaRepository.deleteByProyectoId(id);
        documentoRepository.deleteByProyectoId(id);
        faseEstadoRepository.deleteByProyectoId(id);
        proyectoRepository.deleteById(id);
    }

    @Transactional
    public void updatePhaseStatus(UUID projectId, int phaseNumber, String status) {
        FaseEstado fase = faseEstadoRepository.findByProyectoIdAndNumeroFase(projectId, phaseNumber)
                .orElseGet(() -> FaseEstado.builder().proyectoId(projectId).numeroFase(phaseNumber).build());
        fase.setEstadoVisual(status);
        fase.setUpdatedAt(OffsetDateTime.now());
        faseEstadoRepository.save(fase);

        if ("completado".equals(status) && phaseNumber < PhaseAvailability.PHASE_NAMES.size()) {
            faseEstadoRepository.findByProyectoIdAndNumeroFase(projectId, phaseNumber + 1).ifPresent(next -> {
                if ("bloqueado".equals(next.getEstadoVisual())) {
                    next.setEstadoVisual("disponible");
                    next.setUpdatedAt(OffsetDateTime.now());
                    faseEstadoRepository.save(next);
                }
            });
        }
    }

    @Transactional
    public void reprocessPhase(UUID projectId, int phaseNumber) {
        faseEstadoRepository.findByProyectoIdAndNumeroFase(projectId, phaseNumber).ifPresent(fase -> {
            fase.setEstadoVisual("disponible");
            fase.setDatosConsolidados(null);
            fase.setUpdatedAt(OffsetDateTime.now());
            faseEstadoRepository.save(fase);
        });

        // Solo se invalidan las fases que consumen el resultado de esta (PhaseDataFlow), no todas
        // las posteriores: las demas conservan su resultado y no hay que pagar su regeneracion.
        for (FaseEstado fase : dependentPhaseStates(projectId, phaseNumber)) {
            fase.setEstadoVisual("bloqueado");
            fase.setDatosConsolidados(null);
            fase.setUpdatedAt(OffsetDateTime.now());
            faseEstadoRepository.save(fase);
        }
    }

    /**
     * Lectura/escritura "cruda" de una fila de fases_estado (sin pasar por el DTO recortado de
     * ProjectDto). Existe porque varios componentes del frontend (EnfoqueModule, TipoProyectosModule,
     * MadurezModule, GuiaMetodologicaView, ArtefactosView) leian/escribian `fases_estado` directo con
     * `supabase.from('fases_estado')` para su propio polling y maquinas de estado (marcadores
     * _processing, _error, versionado de fase 7, etc.). Este endpoint generico les permite seguir
     * haciendo exactamente lo mismo contra la API nueva sin reescribir esa logica.
     */
    public FaseEstado getPhaseStateRaw(UUID projectId, int phaseNumber) {
        return faseEstadoRepository.findByProyectoIdAndNumeroFase(projectId, phaseNumber).orElse(null);
    }

    @Transactional
    public FaseEstado updatePhaseStateRaw(UUID projectId, int phaseNumber, Boolean hasEstadoVisual, String estadoVisual,
                                           Boolean hasDatosConsolidados, JsonNode datosConsolidados) {
        FaseEstado fase = faseEstadoRepository.findByProyectoIdAndNumeroFase(projectId, phaseNumber)
                .orElseGet(() -> FaseEstado.builder().proyectoId(projectId).numeroFase(phaseNumber).build());
        if (Boolean.TRUE.equals(hasEstadoVisual)) {
            fase.setEstadoVisual(estadoVisual);
        }
        if (Boolean.TRUE.equals(hasDatosConsolidados)) {
            fase.setDatosConsolidados(datosConsolidados != null && !datosConsolidados.isNull() ? datosConsolidados : null);
        }
        fase.setUpdatedAt(OffsetDateTime.now());
        return faseEstadoRepository.save(fase);
    }

    @Transactional
    public void updatePhasesAfterRaw(UUID projectId, int phaseNumber, String estadoVisual, JsonNode datosConsolidados) {
        for (FaseEstado fase : dependentPhaseStates(projectId, phaseNumber)) {
            fase.setEstadoVisual(estadoVisual);
            fase.setDatosConsolidados(datosConsolidados != null && !datosConsolidados.isNull() ? datosConsolidados : null);
            fase.setUpdatedAt(OffsetDateTime.now());
            faseEstadoRepository.save(fase);
        }
    }

    private List<FaseEstado> dependentPhaseStates(UUID projectId, int phaseNumber) {
        List<Integer> dependents = List.copyOf(PhaseDataFlow.dependentsOf(phaseNumber));
        return dependents.isEmpty() ? List.of() : faseEstadoRepository.findByProyectoIdAndNumeroFaseIn(projectId, dependents);
    }

    private Empresa findOrCreateEmpresa(String nombre) {
        return empresaRepository.findFirstByNombreIgnoreCase(nombre)
                .orElseGet(() -> empresaRepository.save(Empresa.builder().nombre(nombre).build()));
    }

    private ProjectDto toDto(Proyecto p) {
        Empresa empresa = p.getEmpresa();
        Profile profile = p.getAuditorId() != null ? profileRepository.findById(p.getAuditorId()).orElse(null) : null;
        AuditorDto auditor = AuditorDto.of(
                profile != null ? profile.getId().toString() : (p.getAuditorId() != null ? p.getAuditorId().toString() : null),
                profile != null ? profile.getFullName() : null,
                profile != null ? profile.getRole() : "auditor"
        );

        List<FaseEstado> fases = faseEstadoRepository.findByProyectoId(p.getId());
        Map<Integer, FaseEstado> byNumber = fases.stream()
                .collect(Collectors.toMap(f -> f.getNumeroFase(), f -> f, (a, b) -> a));

        List<PhaseAvailability.MutablePhase> phases = PhaseAvailability.createInitialPhases();
        for (PhaseAvailability.MutablePhase phase : phases) {
            FaseEstado fe = byNumber.get(phase.number);
            if (fe == null) continue;
            JsonNode datos = fe.getDatosConsolidados();
            JsonNode diagnosis = datos != null ? datos.path("diagnosis") : null;
            phase.status = fe.getEstadoVisual() != null ? fe.getEstadoVisual() : "bloqueado";
            phase.completedAt = fe.getUpdatedAt() != null ? fe.getUpdatedAt().format(ES_CO_DATE) : null;
            phase.agentDiagnosis = firstNonBlankText(diagnosis, datos, "summary", "pmo_type", "pmoType");
            phase.agentData = datos;
        }
        PhaseAvailability.recompute(phases);

        List<PhaseDto> phaseDtos = phases.stream()
                .map(ph -> new PhaseDto(ph.number, ph.name, ph.status, ph.completedAt, ph.agentDiagnosis, ph.agentData))
                .toList();

        boolean allDone = phaseDtos.stream().allMatch(ph -> "completado".equals(ph.status()));

        return new ProjectDto(
                p.getId().toString(),
                empresa != null ? empresa.getNombre() : "Empresa sin nombre",
                p.getNombreProyecto(),
                p.getFechaInicio() != null ? p.getFechaInicio().toString() : (p.getCreatedAt() != null ? p.getCreatedAt().toLocalDate().toString() : ""),
                p.getTamano(),
                p.getMision(),
                p.getVision(),
                List.of(auditor),
                phaseDtos,
                allDone ? "completado" : "en_ejecucion",
                p.getIsDeleted() != null && p.getIsDeleted()
        );
    }

    private String firstNonBlankText(JsonNode primary, JsonNode secondary, String... fields) {
        for (String field : fields) {
            if (primary != null && primary.hasNonNull(field) && !primary.get(field).asText().isBlank()) {
                return primary.get(field).asText();
            }
        }
        for (String field : fields) {
            if (secondary != null && secondary.hasNonNull(field) && !secondary.get(field).asText().isBlank()) {
                return secondary.get(field).asText();
            }
        }
        return null;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
