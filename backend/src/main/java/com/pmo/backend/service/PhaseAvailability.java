package com.pmo.backend.service;

import java.util.List;

/**
 * Puerto exacto de computePhaseAvailability() / PHASE_NAMES en AppContext.tsx: la regla de
 * negocio central que determina si una fase esta bloqueada o disponible segun la fase anterior.
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
        for (int idx = 0; idx < phases.size(); idx++) {
            MutablePhase phase = phases.get(idx);
            if (phase.status.equals("completado") || phase.status.equals("procesando") || phase.status.equals("error")) {
                continue;
            }
            if (idx == 0) {
                if (phase.status.equals("bloqueado")) phase.status = "disponible";
                continue;
            }
            String previousStatus = phases.get(idx - 1).status;
            phase.status = "completado".equals(previousStatus) ? "disponible" : "bloqueado";
        }
        return phases;
    }
}
