import type { Phase } from '../context/AppContext';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DEPENDENCIAS ENTRE FASES — único lugar para editarlas.
 *
 * Cada fase lista las fases que deben estar COMPLETADAS para poder ejecutarla.
 * Todas las fases se pueden abrir siempre; si hay dependencias pendientes, la vista
 * de la fase muestra un aviso y solo se deshabilita su acción principal
 * (enviar al agente / generar / aprobar cierre).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const dependenciasFases: Record<string, string[]> = {
  F1: [],                                         // Registro documental
  F2: [],                                         // Registro de entrevistas
  F3: [],                                         // Encuestas de idoneidad
  F4: ['F3'],                                     // Diagnóstico de idoneidad
  F5: ['F1', 'F2'],                               // Diagnóstico de madurez
  F6: ['F4', 'F5'],                               // Diseño guía metodológica
  F7: ['F6'],                                     // Construcción guía metodológica
  F8: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'], // Consolidación de artefactos
};

const toNumber = (code: string) => Number(code.replace(/^F/i, ''));

/** Números de las fases de las que depende `phaseNumber` (ej. 6 → [4, 5]). */
export function getPhaseDependencies(phaseNumber: number): number[] {
  return (dependenciasFases[`F${phaseNumber}`] ?? []).map(toNumber);
}

/** Fases de las que depende `phaseNumber` que aún no están completadas. */
export function getPendingDependencies(phases: Phase[], phaseNumber: number): Phase[] {
  return getPhaseDependencies(phaseNumber)
    .map(n => phases.find(p => p.number === n))
    .filter((p): p is Phase => !!p && p.status !== 'completado');
}

/** Texto corto para tooltips: "Completa primero: F3, F5". */
export function pendingDependenciesLabel(pending: Phase[]): string {
  return `Completa primero: ${pending.map(p => `F${p.number}`).join(', ')}`;
}
