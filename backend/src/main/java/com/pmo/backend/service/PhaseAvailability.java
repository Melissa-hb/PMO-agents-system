package com.pmo.backend.service;

import java.util.List;

/**
 * Nombres de las fases y normalizacion de su estado visual. Ya no hay bloqueo secuencial:
 * toda fase que no este completada, procesando o en error se expone como "disponible".
 * Las dependencias entre fases (qué fases deben completarse antes de ejecutar otra) se
 * configuran en el frontend, en src/app/lib/phaseDependencies.ts.
 */
public final class PhaseAvailability {

    public static final List<String> PHASE_NAMES = List.of(
            "Registro documental",
            "Registro de entrevistas",
            "Encuestas de idoneidad",
            "Diagnostico de idoneidad",
            "Diagnóstico de madurez",
            "Diseño guía metodológica",
            "Construcción guía metodológica",
            "Consolidación de artefactos"
    );

    public static class MutablePhase {
        public int number;
        public String name;
        public String status;
        public String completedAt;
        public String agentDiagnosis;
        public com.fasterxml.jackson.databind.JsonNode agentData;
    }

    private PhaseAvailability() {
    }

    public static List<MutablePhase> createInitialPhases() {
        List<MutablePhase> phases = new java.util.ArrayList<>();
        for (int i = 0; i < PHASE_NAMES.size(); i++) {
            MutablePhase p = new MutablePhase();
            p.number = i + 1;
            p.name = PHASE_NAMES.get(i);
            p.status = "bloqueado";
            phases.add(p);
        }
        return recompute(phases);
    }

    public static List<MutablePhase> recompute(List<MutablePhase> phases) {
        for (MutablePhase phase : phases) {
            if (phase.status == null || phase.status.equals("bloqueado")) {
                phase.status = "disponible";
            }
        }
        return phases;
    }
}
