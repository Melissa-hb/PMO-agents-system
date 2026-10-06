import { describe, expect, it } from 'vitest';
import {
  factorMapping,
  getIdoneidadItemCode,
  getIdoneidadItemScore,
  inferIdoneidadDimension,
  normalizeIdoneidadDiagnosisItems,
} from './idoneidadUtils';

describe('items de la encuesta de idoneidad', () => {
  it('extrae el codigo del item de distintos campos', () => {
    expect(getIdoneidadItemCode({ item: 'c03 - Confianza' })).toBe('C03');
    expect(getIdoneidadItemCode({ codigo: 'E2' })).toBe('E2');
    expect(getIdoneidadItemCode({ question_code: 'P05' })).toBe('P05');
    expect(getIdoneidadItemCode({}, 'Item')).toBe('Item');
  });

  it('lee el puntaje con dos decimales', () => {
    expect(getIdoneidadItemScore({ promedio: 4.567 })).toBe(4.57);
    expect(getIdoneidadItemScore({ valor: '6' })).toBe(6);
    expect(getIdoneidadItemScore({ score: 'n/a' })).toBeNull();
    expect(getIdoneidadItemScore({})).toBeNull();
  });

  it('asigna la dimension segun el codigo', () => {
    expect(inferIdoneidadDimension('C01')).toBe('CULTURA');
    expect(inferIdoneidadDimension('E04')).toBe('EQUIPO');
    expect(inferIdoneidadDimension('proyecto')).toBe('PROYECTO');
    expect(inferIdoneidadDimension('')).toBe('N/A');
  });

  it('encuentra los items donde sea que la IA los haya puesto y los ordena', () => {
    const diagnostico = {
      resultados_por_item: [{ item: 'P02', promedio: 7 }, { item: 'C10', promedio: 3 }],
      indicadores: { equipo: { E01: 5.25 } },
      anexo: { C02: '4' },
    };

    const items = normalizeIdoneidadDiagnosisItems(diagnostico);

    expect(items.map(i => i.item)).toEqual(['C02', 'C10', 'E01', 'P02']);
    expect(items.find(i => i.item === 'E01')).toMatchObject({ dimension: 'EQUIPO', promedio: 5.3 });
  });

  it('si un item aparece dos veces se queda con el ultimo', () => {
    const items = normalizeIdoneidadDiagnosisItems({ a: [{ item: 'C01', promedio: 2 }], b: [{ item: 'C01', promedio: 8 }] });

    expect(items).toHaveLength(1);
    expect(items[0].promedio).toBe(8);
  });

  it('tiene nombre y descripcion para los 21 factores', () => {
    expect(Object.keys(factorMapping)).toHaveLength(21);
    expect(factorMapping.C09.name).toBe('Aprendizaje continuo');
  });
});
