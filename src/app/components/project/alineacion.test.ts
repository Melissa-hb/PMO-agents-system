import { describe, expect, it } from 'vitest';
import type { Phase } from '../../context/AppContext';
import { coberturaValueRing, FLYWHEEL, rangoFases } from './alineacion';

const phase = (number: number, status: Phase['status'], agentData?: any): Phase =>
  ({ number, name: `Fase ${number}`, status, agentData } as Phase);

describe('alineacion', () => {
  it('tiene los 10 pasos del flywheel repartidos en las 5 etapas', () => {
    expect(FLYWHEEL).toHaveLength(10);
    expect(new Set(FLYWHEEL.map(p => p.etapa)).size).toBe(5);
  });

  it('marca cada paso según el estado de las fases que lo apoyan', () => {
    const phases = [
      ...[1, 2, 3, 4, 5].map(n => phase(n, 'completado')),
      phase(6, 'disponible', { diagnosis: {} }),
      phase(7, 'disponible'),
      phase(8, 'disponible'),
    ];
    const byPaso = Object.fromEntries(coberturaValueRing(phases).map(p => [p.paso, p]));

    expect(byPaso[2]).toMatchObject({ estado: 'cubierto', fases: [1, 2, 3, 4, 5] });
    expect(byPaso[3].estado).toBe('en_curso');
    expect(byPaso[4].estado).toBe('pendiente');
    expect(byPaso[1].estado).toBe('fuera');
    expect(byPaso[9]).toMatchObject({ estado: 'fuera', fases: [] });
  });

  it('compacta los rangos de fases', () => {
    expect(rangoFases([3, 1, 2, 4, 5])).toBe('F1–F5');
    expect(rangoFases([6])).toBe('F6');
    expect(rangoFases([1, 3])).toBe('F1, F3');
  });
});
