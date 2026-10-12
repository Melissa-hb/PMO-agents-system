import type { Phase } from '../../context/AppContext';
import { getPendingDependencies } from '../../lib/phaseDependencies';
import type { PhaseConfig } from '../../lib/phaseConfig';
import { formatOneDecimal, parseAgentResults, parsePmoType } from '../phases/madurez/module/maturityLogic';

/**
 * Datos de la portada ejecutiva del proyecto: lo que diria un informe de consultoria en su
 * primera pagina (tipo de PMO, madurez, enfoque de la guia, avance y proximos pasos).
 * Cada dato sale del resultado de su fase; si la fase no tiene resultado queda en null.
 */

export interface ExecutiveFact {
  value: string;
  detail?: string;
  /** false mientras la fase que lo produce no esta aprobada (el dato es preliminar). */
  approved: boolean;
}

export interface NextStep {
  phaseNumber: number;
  text: string;
  kind: 'en_proceso' | 'continuar' | 'requiere' | 'error';
}

export interface ExecutiveSummary {
  pmoType: ExecutiveFact | null;
  maturity: ExecutiveFact | null;
  approach: ExecutiveFact | null;
  completed: number;
  total: number;
  nextSteps: NextStep[];
}

function diagnosisOf(phase?: Phase): any {
  const data = phase?.agentData;
  if (!data || typeof data !== 'object' || data._error || data._processing) return null;
  const root = data._current ?? data;
  return root.diagnosis ?? root.data ?? root;
}

function hasKeys(value: unknown): boolean {
  return !!value && typeof value === 'object' && Object.keys(value as object).length > 0;
}

function pmoTypeFact(phase?: Phase): ExecutiveFact | null {
  const diag = diagnosisOf(phase);
  if (!diag?.pmo_type && !diag?.pmoType) return null;
  const confidence = Number(diag.confidence_level);
  return {
    value: `PMO ${parsePmoType({ diagnosis: diag }).toLowerCase()}`,
    detail: Number.isFinite(confidence) && confidence > 0 ? `Confianza del diagnóstico: ${confidence}%` : undefined,
    approved: phase?.status === 'completado',
  };
}

function maturityFact(phase?: Phase): ExecutiveFact | null {
  const diag = diagnosisOf(phase);
  if (!hasKeys(diag)) return null;
  const results = parseAgentResults(phase?.agentData);
  if (!results || !(results.overallScore > 0)) return null;
  const label = results.overallLabel ? ` · ${results.overallLabel}` : '';
  return {
    value: `Nivel ${results.overallLevel} de 5`,
    detail: `Puntaje ${formatOneDecimal(results.overallScore).replace('.', ',')} de 5${label}`,
    approved: phase?.status === 'completado',
  };
}

function approachFact(phase?: Phase): ExecutiveFact | null {
  const approach = diagnosisOf(phase)?.guide_approach;
  const type = typeof approach?.type === 'string' ? approach.type.trim() : '';
  if (!type) return null;
  const framework = typeof approach.primary_framework === 'string' ? approach.primary_framework.trim() : '';
  return {
    value: type.charAt(0).toUpperCase() + type.slice(1),
    detail: framework ? `Marco principal: ${framework}` : undefined,
    approved: phase?.status === 'completado',
  };
}

function nextSteps(phases: Phase[], config: PhaseConfig): NextStep[] {
  const steps: NextStep[] = [];
  for (const phase of phases) {
    if (phase.status === 'completado') continue;
    const label = `F${phase.number} ${phase.name}`;
    if (phase.status === 'procesando') {
      steps.push({ phaseNumber: phase.number, kind: 'en_proceso', text: `${label}: el agente está trabajando.` });
    } else if (phase.status === 'error') {
      steps.push({ phaseNumber: phase.number, kind: 'error', text: `${label}: el último intento falló; revisa y vuelve a ejecutarla.` });
    } else {
      const pending = getPendingDependencies(phases, phase.number, config);
      if (pending.length > 0) {
        const names = pending.map(p => `F${p.number}`).join(', ');
        steps.push({ phaseNumber: phase.number, kind: 'requiere', text: `${label}: se habilita al completar ${names}.` });
      } else {
        steps.push({ phaseNumber: phase.number, kind: 'continuar', text: `${label}: lista para trabajar.` });
      }
    }
    if (steps.length === 3) break;
  }
  return steps;
}

export function buildExecutiveSummary(phases: Phase[], config: PhaseConfig): ExecutiveSummary {
  const byNumber = (n: number) => phases.find(p => p.number === n);
  return {
    pmoType: pmoTypeFact(byNumber(4)),
    maturity: maturityFact(byNumber(5)),
    approach: approachFact(byNumber(6)),
    completed: phases.filter(p => p.status === 'completado').length,
    total: phases.length,
    nextSteps: nextSteps(phases, config),
  };
}
