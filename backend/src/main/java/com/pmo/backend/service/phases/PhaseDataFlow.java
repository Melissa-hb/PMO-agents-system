package com.pmo.backend.service.phases;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * Flujo real de datos entre fases: que fases leen el resultado de cada una (segun los
 * PhaseXPayloadBuilder y ArtefactosService). Al reprocesar una fase solo se invalidan las que
 * consumen su resultado, directa o indirectamente, en vez de todas las posteriores; asi no se
 * pagan de nuevo fases cuyo insumo no cambio.
 *
 * Es distinto del mapa de dependencias de la interfaz (src/app/lib/phaseDependencies.ts), que
 * decide cuando se habilita la accion de una fase. Si un builder empieza a leer otra fase, hay
 * que agregarla aqui.
 */
public final class PhaseDataFlow {

    /** fase -> fases que leen su resultado directamente. La fase 9 es el Agente 3.1. */
    private static final Map<Integer, List<Integer>> DIRECT_CONSUMERS = Map.of(
            1, List.of(4, 9),   // Phase4PayloadBuilder (diagnostico documental), Phase9PayloadBuilder
            2, List.of(4),      // Phase4PayloadBuilder (entrevistas)
            3, List.of(4),      // Phase4PayloadBuilder (encuesta de idoneidad)
            4, List.of(5, 6, 7),// Phase5 (tipo de PMO y pesos), Phase6, Phase7
            5, List.of(6, 7),   // Phase6, Phase7
            6, List.of(7),      // Phase7
            7, List.of(8)       // ArtefactosService (guia aprobada)
    );

    private PhaseDataFlow() {
    }

    /** Fases que dependen, directa o transitivamente, del resultado de {@code phaseNumber}. */
    public static Set<Integer> dependentsOf(int phaseNumber) {
        Set<Integer> result = new TreeSet<>();
        Deque<Integer> pending = new ArrayDeque<>(DIRECT_CONSUMERS.getOrDefault(phaseNumber, List.of()));
        while (!pending.isEmpty()) {
            int next = pending.pop();
            if (result.add(next)) pending.addAll(DIRECT_CONSUMERS.getOrDefault(next, List.of()));
        }
        return result;
    }
}
