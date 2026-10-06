import { describe, expect, it } from 'vitest';
import type { Phase } from '../../context/AppContext';
import type { PhaseConfig } from '../../lib/phaseConfig';
import { buildExecutiveSummary } from './executiveSummary';

const config: PhaseConfig = {
  loaded: true,
  categoriasDocumento: [],
  fases: [4, 5, 6, 7, 8].map(n => ({
    numero: n, codigo: `F${n}`, nombre: `Fase ${n}`, orden: n, visible: true,
    requiereCompletas: n === 7 ? [5, 6] : n === 8 ? [7] : [], leeResultadoDe: [],
  })),
};

const phase = (number: number, status: Phase['status'], agentData?: unknown): Phase =>
  ({ number, name: `Fase ${number}`, status, agentData } as Phase);

const fase4 = phase(4, 'completado', { diagnosis: { pmo_type: 'Predictivo', confidence_level: 90 } });
const fase5 = phase(5, 'completado', {
  diagnosis: {
    approved_pmo_type: 'Predictivo',
    predictive_maturity: { aplica: true, nivel_global: 'Estándar', score_global: 2.85, por_dominio: {} },
    agile_maturity: { aplica: false, nivel_global: '', score_global: 0 },
  },
});
const fase6 = phase(6, 'disponible', { diagnosis: { guide_approach: { type: 'predictiva formal', primary_framework: 'PMBOK v7/v8' } } });

describe('portada ejecutiva del proyecto', () => {
  it('resume tipo de PMO, madurez y enfoque desde los resultados de las fases', () => {
    const summary = buildExecutiveSummary([fase4, fase5, fase6, phase(7, 'disponible'), phase(8, 'disponible')], config);

    expect(summary.pmoType).toEqual({ value: 'PMO predictiva', detail: 'Confianza del diagnóstico: 90%', approved: true });
    expect(summary.maturity?.value).toBe('Nivel 3 de 5');
    // Mismo redondeo que la pantalla de la fase 5.
    expect(summary.maturity?.detail).toBe('Puntaje 2,9 de 5 · Estándar');
    // La fase 6 tiene resultado pero no esta aprobada: el dato se marca como preliminar.
    expect(summary.approach).toEqual({ value: 'Predictiva formal', detail: 'Marco principal: PMBOK v7/v8', approved: false });
    expect(summary.completed).toBe(2);
    expect(summary.total).toBe(5);
  });

  it('sin resultados los datos quedan vacios en vez de inventarse', () => {
    const summary = buildExecutiveSummary([phase(4, 'disponible'), phase(5, 'disponible'), phase(6, 'disponible', { _error: 'falló' })], config);
    expect(summary.pmoType).toBeNull();
    expect(summary.maturity).toBeNull();
    expect(summary.approach).toBeNull();
  });

  it('los proximos pasos siguen el orden de las fases e indican lo que bloquea', () => {
    const summary = buildExecutiveSummary(
      [fase4, fase5, phase(6, 'procesando'), phase(7, 'disponible'), phase(8, 'disponible')],
      config,
    );
    expect(summary.nextSteps.map(s => [s.phaseNumber, s.kind])).toEqual([[6, 'en_proceso'], [7, 'requiere'], [8, 'requiere']]);
    expect(summary.nextSteps[1].text).toContain('se habilita al completar F6');
  });

  it('un proyecto terminado no tiene proximos pasos', () => {
    const summary = buildExecutiveSummary([fase4, fase5], config);
    expect(summary.nextSteps).toEqual([]);
    expect(summary.completed).toBe(summary.total);
  });
});
