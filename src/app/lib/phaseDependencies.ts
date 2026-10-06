import type { Phase } from '../context/AppContext';
import { getPhaseConfig, type PhaseConfig } from './phaseConfig';

/**
 * Dependencias entre fases: cada fase lista las fases que deben estar COMPLETADAS para poder
 * ejecutarla. Vienen de la tabla `fases` (columna requiere_completas) y se editan en
 * Administracion > Fases y agentes. Todas las fases se pueden abrir siempre; si hay dependencias
 * pendientes, la vista de la fase muestra un aviso y solo se deshabilita su accion principal.
 */

/** Numeros de las fases de las que depende `phaseNumber` (ej. 6 → [4, 5]). */
export function getPhaseDependencies(phaseNumber: number, config: PhaseConfig = getPhaseConfig()): number[] {
  return config.fases.find(f => f.numero === phaseNumber)?.requiereCompletas ?? [];
}

/** Fases de las que depende `phaseNumber` que aún no están completadas. */
export function getPendingDependencies(phases: Phase[], phaseNumber: number, config: PhaseConfig = getPhaseConfig()): Phase[] {
  return getPhaseDependencies(phaseNumber, config)
    .map(n => phases.find(p => p.number === n))
    .filter((p): p is Phase => !!p && p.status !== 'completado');
}

/** Texto corto para tooltips: "Completa primero: F3, F5". */
export function pendingDependenciesLabel(pending: Phase[], config: PhaseConfig = getPhaseConfig()): string {
  const code = (n: number) => config.fases.find(f => f.numero === n)?.codigo ?? `F${n}`;
  return `Completa primero: ${pending.map(p => code(p.number)).join(', ')}`;
}
