import { describe, expect, it } from 'vitest';
import { citasPorFase, formatElemento, resumenTrazabilidad, type MatrizTrazabilidad } from './trazabilidad';
import { PHASE_CATALOG } from './phaseCatalog';

const matriz: MatrizTrazabilidad = {
  hallazgos: [
    { id: 'H1-01', fase: 1, tipo: 'Hallazgo documental', texto: 'Sin actas', citado_por: [
      { fase: 7, elemento: 'S7', decision: 'Política de actas' },
      { fase: 4, elemento: 'pmo_type', decision: 'Híbrido' },
    ] },
    { id: 'H2-01', fase: 2, tipo: 'Hallazgo de entrevistas', texto: 'Prioridad por urgencia', citado_por: [] },
  ],
  decisiones: [
    { fase: 4, elemento: 'pmo_type', decision: 'Híbrido', hallazgos_origen: ['H1-01'], ids_no_encontrados: [] },
    { fase: 6, elemento: 'Marco', decision: 'PMBOK', hallazgos_origen: [], ids_no_encontrados: ['H9-01'] },
  ],
};

describe('trazabilidad', () => {
  it('resume hallazgos citados, sin usar y decisiones con sustento', () => {
    expect(resumenTrazabilidad(matriz)).toEqual({
      hallazgos: 2, citados: 1, sinUsar: 1, decisiones: 2, decisionesConSustento: 1, idsNoEncontrados: 1,
    });
  });

  it('agrupa las citas de un hallazgo por fase en orden', () => {
    expect(citasPorFase(matriz.hallazgos[0].citado_por).map(g => g.fase)).toEqual([4, 7]);
  });

  it('muestra legibles las claves de sección', () => {
    expect(formatElemento('S12_documentos_generados')).toBe('S12 · Documentos generados');
    expect(formatElemento('S7 · Políticas')).toBe('S7 · Políticas');
    expect(formatElemento('S10_flujos_de_procesos.fases[Inicio]')).toBe('S10 · Flujos de procesos · Inicio');
    expect(formatElemento('S10 · flujos de procesos.fases[Monitoreo y Control]')).toBe('S10 · Flujos de procesos · Monitoreo y Control');
    expect(formatElemento('guide_approach')).toBe('guide_approach');
  });

  it('ubica cada fase en el ciclo del PMO Value Ring', () => {
    expect(PHASE_CATALOG[1].valueRing?.etapa).toBe('Exploración');
    expect(PHASE_CATALOG[7].valueRing).toEqual({ etapa: 'Diseño', paso: 4, pasoNombre: 'Desarrollar el servicio' });
    expect(PHASE_CATALOG[8].valueRing?.etapa).toBe('Despliegue');
  });
});
