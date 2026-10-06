import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Phase } from '../context/AppContext';
import { getPhaseConfig, isOtrosCategory, otrosCategoryCode, categoryLabel, resetPhaseConfig, setPhaseConfig, type PhaseDefinition } from './phaseConfig';
import { getPendingDependencies, getPhaseDependencies, pendingDependenciesLabel } from './phaseDependencies';

const fase = (numero: number, requiereCompletas: number[], codigo = `F${numero}`): PhaseDefinition =>
  ({ numero, codigo, nombre: `Fase ${numero}`, orden: numero, visible: true, requiereCompletas, leeResultadoDe: requiereCompletas });

// Misma configuracion inicial que la migracion 202610060001_configuracion_fases.sql.
const CONFIG = {
  fases: [fase(1, []), fase(2, []), fase(3, []), fase(4, [1, 2, 3]), fase(5, [4]), fase(6, [4, 5]),
    fase(7, [4, 5, 6]), fase(8, [1, 2, 3, 4, 5, 6, 7]), { ...fase(9, [], 'F3.1'), visible: false }],
  categoriasDocumento: [
    { codigo: 'D16', nombre: 'Otros', orden: 16, esVisual: false, esOtros: true },
    { codigo: 'D01', nombre: 'Organigrama', orden: 1, esVisual: true, esOtros: false },
  ],
};

const fases = (estados: Record<number, Phase['status']>): Phase[] =>
  Object.entries(estados).map(([n, status]) => ({ number: Number(n), name: `Fase ${n}`, status }));

beforeEach(() => setPhaseConfig(CONFIG));
afterEach(() => resetPhaseConfig());

describe('dependencias entre fases (tabla fases)', () => {
  it('lee las dependencias de la configuracion cargada', () => {
    expect(getPhaseDependencies(4)).toEqual([1, 2, 3]);
    expect(getPhaseDependencies(6)).toEqual([4, 5]);
    expect(getPhaseDependencies(8)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(getPhaseDependencies(1)).toEqual([]);
  });

  it('una fase desconocida o sin configuracion cargada no tiene dependencias', () => {
    expect(getPhaseDependencies(99)).toEqual([]);
    resetPhaseConfig();
    expect(getPhaseDependencies(4)).toEqual([]);
    expect(getPhaseConfig().loaded).toBe(false);
  });

  it('un cambio en la configuracion se refleja sin tocar el codigo', () => {
    setPhaseConfig({ ...CONFIG, fases: CONFIG.fases.map(f => (f.numero === 5 ? { ...f, requiereCompletas: [3, 4] } : f)) });

    expect(getPhaseDependencies(5)).toEqual([3, 4]);
  });

  it('solo reporta como pendientes las dependencias no completadas', () => {
    const proyecto = fases({ 1: 'completado', 2: 'disponible', 3: 'procesando', 4: 'bloqueado' });

    expect(getPendingDependencies(proyecto, 4).map(p => p.number)).toEqual([2, 3]);
    expect(getPendingDependencies(proyecto, 2)).toEqual([]);
  });

  it('arma el texto del aviso con el codigo de cada fase', () => {
    const proyecto = fases({ 4: 'completado', 5: 'disponible', 6: 'error', 9: 'disponible' });

    expect(pendingDependenciesLabel(getPendingDependencies(proyecto, 7))).toBe('Completa primero: F5, F6');
    expect(pendingDependenciesLabel([{ number: 9, name: 'x', status: 'disponible' }])).toBe('Completa primero: F3.1');
  });

  it('ordena las fases y categorias segun la columna orden', () => {
    expect(getPhaseConfig().categoriasDocumento.map(c => c.codigo)).toEqual(['D01', 'D16']);
    expect(getPhaseConfig().loaded).toBe(true);
  });
});

describe('categorias de documentos (tabla categorias_documento)', () => {
  it('identifica la categoria "Otros" por configuracion, no por codigo fijo', () => {
    expect(otrosCategoryCode()).toBe('D16');
    expect(isOtrosCategory('D16')).toBe(true);
    expect(isOtrosCategory('D01')).toBe(false);
    expect(isOtrosCategory(undefined)).toBe(false);
  });

  it('devuelve el nombre de una categoria', () => {
    expect(categoryLabel('D01')).toBe('Organigrama');
    expect(categoryLabel('D99')).toBeUndefined();
  });
});
