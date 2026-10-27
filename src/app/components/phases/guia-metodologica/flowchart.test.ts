import { describe, expect, it } from 'vitest';
import { buildFlowchartSvg, buildLifecycleSvg, figureNumbers, flowPhaseFrom, wrapText } from './flowchart';

const fase = {
  numero_fase: 2,
  nombre_fase: 'Inicio',
  criterios_entrada_fase: ['Contrato <firmado>'],
  criterios_salida_fase: ['Acta aprobada'],
  actividades: [
    { orden: 1, actividad: 'Designar director', responsable: 'Gerencia', es_punto_decision: false, artefacto_relacionado: 'Carta' },
    { orden: 2, actividad: 'Elaborar acta', responsable: 'Director', es_punto_decision: false, artefacto_relacionado: 'Acta' },
    { orden: 3, actividad: '⬦ Aprobar acta', responsable: 'Gerencia', es_punto_decision: true, artefacto_relacionado: 'Acta' },
  ],
};

describe('flujogramas de la guía', () => {
  it('arma la etapa con actividades numeradas y sin el rombo del texto', () => {
    const flow = flowPhaseFrom(fase, 0)!;
    expect(flow.actividades.map(a => [a.numero, a.actividad, a.esDecision])).toEqual([
      ['2.1', 'Designar director', false], ['2.2', 'Elaborar acta', false], ['2.3', 'Aprobar acta', true],
    ]);
    expect(flow.entrada).toBe('Contrato <firmado>');
    expect(flowPhaseFrom({ actividades: [] }, 0)).toBeNull();
  });

  it('dibuja un carril por responsable, el rombo con Sí y No, y escapa el texto', () => {
    const svg = buildFlowchartSvg(flowPhaseFrom(fase, 0)!);
    expect(svg.match(/GERENCIA|DIRECTOR/g)).toHaveLength(2);
    expect(svg).toContain('<polygon');
    expect(svg).toContain('¿Aprobar acta?');
    expect(svg).toContain('>Sí<');
    expect(svg).toContain('>No<');
    expect(svg).toContain('Contrato &lt;firmado&gt;');
    expect(svg).not.toContain('<firmado>');
  });

  it('pone monitoreo y control como franja del ciclo de vida', () => {
    const svg = buildLifecycleSvg([
      { numero: 1, nombre: 'Inicio' }, { numero: 2, nombre: 'Monitoreo y control' }, { numero: 3, nombre: 'Cierre' },
    ])!;
    expect(svg).toContain('Etapa 2 · Monitoreo y control');
    expect(svg).toContain('Acompaña a las demás etapas');
    expect(buildLifecycleSvg([])).toBeNull();
  });

  it('parte textos largos y numera las figuras en orden', () => {
    expect(wrapText('uno dos tres cuatro cinco seis', 9, 2)).toEqual(['uno dos', 'tres…']);
    const a = { diagram: { svg: '' } };
    const b = {};
    const c = { diagram: { svg: '' } };
    const numbers = figureNumbers([{ subsections: [a, b] }, { subsections: [c] }]);
    expect([numbers.get(a), numbers.get(b), numbers.get(c)]).toEqual([1, undefined, 2]);
  });
});
