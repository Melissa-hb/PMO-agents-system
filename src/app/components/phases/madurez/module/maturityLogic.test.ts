import { describe, expect, it } from 'vitest';
import { formatMaturityLabel, formatOneDecimal, parseAgentResults, parsePmoType } from './maturityLogic';

describe('tipo de PMO aprobado en la fase 4', () => {
  it('lee el tipo del diagnostico', () => {
    expect(parsePmoType({ diagnosis: { pmo_type: 'PMO Ágil' } })).toBe('Ágil');
    expect(parsePmoType({ pmoType: 'agil' })).toBe('Ágil');
    expect(parsePmoType({ diagnosis: { pmo_type: 'Predictiva' } })).toBe('Predictiva');
    expect(parsePmoType({ diagnosis: { pmo_type: 'Híbrida' } })).toBe('Híbrida');
  });

  it('sin datos asume hibrida', () => {
    expect(parsePmoType(undefined)).toBe('Híbrida');
    expect(parsePmoType({})).toBe('Híbrida');
  });
});

describe('escala de madurez', () => {
  it('convierte puntajes de 0-100 a la escala 1-5', () => {
    expect(formatOneDecimal(80)).toBe('4.0');
    expect(formatOneDecimal(3.46)).toBe('3.5');
    expect(formatOneDecimal('no es numero')).toBe('0.0');
    expect(formatOneDecimal(-2)).toBe('0.0');
  });

  it('etiqueta el nivel aunque venga sin numero o con tildes', () => {
    expect(formatMaturityLabel('Básico', 0)).toBe('2. Básico');
    expect(formatMaturityLabel('3. Estándar', 0)).toBe('3. Estándar');
    expect(formatMaturityLabel('Gestionado', 0)).toBe('4. Gestionado');
  });

  it('sin etiqueta usa el nivel que corresponde al puntaje', () => {
    expect(formatMaturityLabel('', 4.6)).toBe('5. Excelencia');
    expect(formatMaturityLabel('', 2.5)).toBe('3. Estándar');
    expect(formatMaturityLabel('', 0)).toBe('1. Informal');
  });
});

describe('lectura del diagnostico de madurez (fase 5)', () => {
  const diagnostico = {
    metadata: { iteration: 2, timestamp: '2026-10-01T10:00:00Z' },
    diagnosis: {
      overall_maturity_score: 3.2,
      overall_maturity_level: 'Estándar',
      summary: 'Madurez intermedia.',
      predictive_maturity: {
        score_global: 3.6,
        nivel_global: 'Avanzado',
        brechas: [{ nombre: 'Riesgos', score: 2.1, impacto_potencial: 'Sobrecostos' }, 'Cierre sin lecciones'],
        fortalezas: [{ nombre: 'Cronograma', score: 4.2 }],
        por_dominio: { Finanzas: { score: 70, nivel: 'Avanzado' }, riesgos: 2.1 },
      },
      agile_maturity: { aplica: false },
      top_gaps: ['Gestion de riesgos', { area: 'Cierre', severity: 'high' }],
      recommendations: ['Formalizar el registro de riesgos'],
    },
  };

  it('lee puntaje global, nivel, brechas y fortalezas', () => {
    const r = parseAgentResults(diagnostico)!;

    expect(r.overallScore).toBe(3.2);
    expect(r.overallLevel).toBe(3);
    expect(r.summary).toBe('Madurez intermedia.');
    expect(r.version).toBe('reprocesado');
    expect(r.predictiva?.level).toBe(4);
    expect(r.predictiva?.gaps).toHaveLength(2);
    expect(r.predictiva?.gaps[1]).toMatchObject({ nombre: 'Cierre sin lecciones' });
    expect(r.predictiva?.fortalezas[0]).toMatchObject({ nombre: 'Cronograma', score: 4.2 });
    expect(r.predictiva?.por_dominio?.Finanzas).toEqual({ score: 3.5, nivel: 'Avanzado' });
    expect(r.top_gaps).toEqual([{ area: 'Gestion de riesgos', severity: 'medium' }, { area: 'Cierre', severity: 'high' }]);
  });

  it('un enfoque que no aplica queda sin resultado', () => {
    expect(parseAgentResults(diagnostico)!.agil).toBeUndefined();
  });

  it('sin puntaje global lo calcula como promedio de los enfoques', () => {
    const r = parseAgentResults({ diagnosis: { predictiva: { score: 3 }, agil: { score: 4 } } })!;

    expect(r.overallScore).toBe(3.5);
    expect(r.overallLevel).toBe(4);
  });

  it('acepta el diagnostico guardado como texto JSON', () => {
    expect(parseAgentResults(JSON.stringify(diagnostico))?.overallScore).toBe(3.2);
  });

  it('no muestra resultados mientras la fase procesa o si fallo', () => {
    expect(parseAgentResults({ _processing: true })).toBeNull();
    expect(parseAgentResults({ _error: true, message: 'fallo' })).toBeNull();
    expect(parseAgentResults({ metadata: { status: 'error' }, diagnosis: { overall_score: 3 } })).toBeNull();
    expect(parseAgentResults('{no es json')).toBeNull();
    expect(parseAgentResults({ diagnosis: { otro_campo: 1 } })).toBeNull();
    expect(parseAgentResults(null)).toBeNull();
  });
});
