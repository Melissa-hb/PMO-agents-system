import { apiGet } from '../../lib/api';
import type { Phase } from '../../context/AppContext';
import { PHASE_CATALOG, type ValueRingStage } from './phaseCatalog';

/** Los 10 pasos del flywheel del PMO Value Ring, agrupados en las 5 etapas del ciclo del cliente. */
export const FLYWHEEL: Array<{ paso: number; nombre: string; etapa: ValueRingStage['etapa'] }> = [
  { paso: 1, nombre: 'Generar conciencia', etapa: 'Exploración' },
  { paso: 2, nombre: 'Evaluar necesidades', etapa: 'Exploración' },
  { paso: 3, nombre: 'Propuesta de valor', etapa: 'Diseño' },
  { paso: 4, nombre: 'Desarrollar el servicio', etapa: 'Diseño' },
  { paso: 5, nombre: 'Incorporar', etapa: 'Despliegue' },
  { paso: 6, nombre: 'Operar', etapa: 'Despliegue' },
  { paso: 7, nombre: 'Monitorear', etapa: 'Mejora' },
  { paso: 8, nombre: 'Mejorar', etapa: 'Mejora' },
  { paso: 9, nombre: 'Entregar valor', etapa: 'Realización' },
  { paso: 10, nombre: 'Reconocer el valor', etapa: 'Realización' },
];

export const ETAPAS: ValueRingStage['etapa'][] = ['Exploración', 'Diseño', 'Despliegue', 'Mejora', 'Realización'];

/** cubierto: todas sus fases aprobadas · en_curso: alguna empezada · pendiente · fuera: la plataforma no lo apoya. */
export type EstadoPaso = 'cubierto' | 'en_curso' | 'pendiente' | 'fuera';

export interface PasoCobertura {
  paso: number;
  nombre: string;
  etapa: ValueRingStage['etapa'];
  fases: number[];
  estado: EstadoPaso;
}

const hasData = (data: unknown) => !!data && typeof data === 'object' && Object.keys(data as object).length > 0;

/** Cobertura de cada paso del flywheel según el estado de las fases del proyecto que lo apoyan. */
export function coberturaValueRing(phases: Phase[]): PasoCobertura[] {
  return FLYWHEEL.map(({ paso, nombre, etapa }) => {
    const fases = phases.filter(p => PHASE_CATALOG[p.number]?.valueRing?.paso === paso);
    let estado: EstadoPaso = 'fuera';
    if (fases.length > 0) {
      if (fases.every(p => p.status === 'completado')) estado = 'cubierto';
      else if (fases.some(p => p.status === 'completado' || p.status === 'procesando' || hasData(p.agentData))) estado = 'en_curso';
      else estado = 'pendiente';
    }
    return { paso, nombre, etapa, fases: fases.map(p => p.number), estado };
  });
}

/** Rango compacto de fases: [1,2,3,4,5] → "F1–F5", [6] → "F6". */
export function rangoFases(fases: number[]): string {
  if (fases.length === 0) return '';
  const sorted = [...fases].sort((a, b) => a - b);
  const contiguous = sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1);
  if (sorted.length > 2 && contiguous) return `F${sorted[0]}–F${sorted[sorted.length - 1]}`;
  return sorted.map(n => `F${n}`).join(', ');
}

// ── GET /api/projects/{id}/alineacion ────────────────────────────────────────

export interface CriterioPmi {
  nombre: string;
  cubierto: boolean;
  secciones: string[];
  /** Dominios: tiene indicador propio en S11 (nombres de esos indicadores). */
  con_indicador?: boolean;
  indicadores?: string[];
  /** Áreas de enfoque: es una fase de los flujos de S10 (nombres de esas fases). */
  en_flujos?: boolean;
  fases_flujo?: string[];
}

export interface ElementoCobertura {
  clave: string;
  nombre: string;
  cubierto: boolean;
  evidencia: string;
}

export interface Alineacion {
  pmi: {
    referencia: string;
    guia_generada: boolean;
    marco_principal: string | null;
    marco_secundario: string | null;
    dominios: CriterioPmi[];
    areas_enfoque: CriterioPmi[];
  };
  componentes: ElementoCobertura[];
  linea_base: ElementoCobertura[];
}

export function getAlineacion(projectId: string): Promise<Alineacion> {
  return apiGet(`/api/projects/${projectId}/alineacion`);
}
