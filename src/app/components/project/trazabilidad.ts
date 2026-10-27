import { apiGet } from '../../lib/api';

/** Matriz hallazgo → decisión que devuelve GET /api/projects/{id}/trazabilidad. */
export interface Cita {
  fase: number;
  elemento: string;
  decision: string;
}

export interface Hallazgo {
  id: string;
  fase: number;
  tipo: string;
  texto: string;
  citado_por: Cita[];
}

export interface Decision extends Cita {
  hallazgos_origen: string[];
  ids_no_encontrados: string[];
}

export interface MatrizTrazabilidad {
  hallazgos: Hallazgo[];
  decisiones: Decision[];
}

export function getTrazabilidad(projectId: string): Promise<MatrizTrazabilidad> {
  return apiGet(`/api/projects/${projectId}/trazabilidad`);
}

/** Cifras de la matriz: cuántos hallazgos sostienen alguna decisión y cuántas decisiones citan hallazgos. */
export function resumenTrazabilidad(matriz: MatrizTrazabilidad) {
  const citados = matriz.hallazgos.filter(h => h.citado_por.length > 0).length;
  return {
    hallazgos: matriz.hallazgos.length,
    citados,
    sinUsar: matriz.hallazgos.length - citados,
    decisiones: matriz.decisiones.length,
    decisionesConSustento: matriz.decisiones.filter(d => d.hallazgos_origen.length > 0).length,
    idsNoEncontrados: matriz.decisiones.reduce((n, d) => n + d.ids_no_encontrados.length, 0),
  };
}

export { formatElemento } from '../phases/guia-metodologica/flowchart';

/** Citas agrupadas por fase, en orden (4, 6, 7), para mostrarlas juntas en la fila del hallazgo. */
export function citasPorFase(citas: Cita[]): Array<{ fase: number; citas: Cita[] }> {
  const grupos = new Map<number, Cita[]>();
  citas.forEach(c => grupos.set(c.fase, [...(grupos.get(c.fase) ?? []), c]));
  return [...grupos.entries()].sort(([a], [b]) => a - b).map(([fase, list]) => ({ fase, citas: list }));
}
