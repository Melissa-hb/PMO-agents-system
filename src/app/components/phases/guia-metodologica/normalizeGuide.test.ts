import { describe, expect, it } from 'vitest';
import { hasUsableGuidePayload, normalizeChapters, unwrapGuidePayload, versionsFromPayload } from './normalizeGuide';

const seccion = (id: string, titulo: string, contenido: Record<string, unknown> = {}) => ({ section_id: id, section_title: titulo, contenido });

describe('capitulos de la guia metodologica (fase 7)', () => {
  it('ordena las secciones de la IA segun la estructura de la guia y omite la portada', () => {
    const guia = {
      diagnosis: {
        guide_content: [
          seccion('S01', 'Portada'),
          seccion('S07', 'Políticas', { descripcion_general: 'Reglas de gestion' }),
          seccion('S02', 'Introducción', { descripcion_general: 'Contexto de Acme' }),
          seccion('S03', 'Objetivo'),
        ],
      },
    };

    const capitulos = normalizeChapters(guia);

    expect(capitulos.map(c => c.title)).toEqual(['Introducción', 'Objetivo', 'Políticas']);
    expect(capitulos.map(c => c.number)).toEqual([1, 2, 3]);
    expect(capitulos[0].intro).toBe('Contexto de Acme');
  });

  it('una seccion sin contenido muestra un texto de respaldo', () => {
    const [capitulo] = normalizeChapters({ guide_content: [seccion('S03', 'Alcance')] });

    expect(capitulo.subsections).toEqual([{ title: 'Contenido', content: 'Contenido procesado por el Agente 7.' }]);
  });

  it('acepta el formato clasico de capitulos con secciones', () => {
    const capitulos = normalizeChapters({
      guia_metodologica: {
        capitulos: [{ numero: 1, titulo: 'Gobierno', introduccion: 'Como se decide', secciones: [{ titulo: 'Comite', contenido: 'Mensual' }] }],
      },
    });

    expect(capitulos).toHaveLength(1);
    expect(capitulos[0]).toMatchObject({ number: 1, title: 'Gobierno', intro: 'Como se decide' });
    expect(capitulos[0].subsections[0]).toMatchObject({ title: 'Comite', content: 'Mensual' });
  });

  it('con solo campos sueltos arma un capitulo con lo que haya', () => {
    const [capitulo] = normalizeChapters({ titulo: 'Guia Acme', resumen: 'Resumen corto', artefactos: ['Cronograma', 'Acta'] });

    expect(capitulo.title).toBe('Guia Acme');
    expect(capitulo.subsections.map(s => s.title)).toEqual(['Resumen ejecutivo', 'Artefactos recomendados']);
  });

  it('lee la guia aunque venga guardada como texto JSON', () => {
    expect(normalizeChapters(JSON.stringify({ guide_content: [seccion('S02', 'Introducción')] }))).toHaveLength(1);
  });

  it('sin contenido reconocible no hay capitulos', () => {
    expect(normalizeChapters({})).toEqual([]);
    expect(normalizeChapters(null)).toEqual([]);
    expect(hasUsableGuidePayload({ metadata: {} })).toBe(false);
  });
});

describe('versiones de la guia', () => {
  const v1 = { guide_content: [seccion('S02', 'Introducción')] };

  it('usa la version vigente del contenedor versionado', () => {
    expect(unwrapGuidePayload({ _current: v1, _versions: [] })).toBe(v1);
    expect(unwrapGuidePayload(v1)).toBe(v1);
  });

  it('lista las versiones guardadas y descarta las vacias', () => {
    const versiones = versionsFromPayload({
      _versions: [
        { number: 1, generatedAt: '2026-10-01', status: 'generado', data: v1 },
        { number: 2, generatedAt: '2026-10-02', status: 'revisado', comment: 'Ajustar roles', data: {} },
        { number: 3, generated_at: '2026-10-03', status: 'revisado', comment: 'Ajustar comites', data: v1 },
      ],
    });

    expect(versiones.map(v => v.number)).toEqual([1, 3]);
    expect(versiones[1]).toMatchObject({ generatedAt: '2026-10-03', status: 'revisado', comment: 'Ajustar comites' });
  });

  it('una guia sin historial cuenta como una sola version', () => {
    const [unica] = versionsFromPayload({ ...v1, _latest_version: 2, _last_comment: 'Cambiar alcance' });

    expect(unica).toMatchObject({ number: 2, status: 'revisado', comment: 'Cambiar alcance' });
    expect(versionsFromPayload(null)).toEqual([]);
  });
});

describe('titulos generados a partir de las claves de la guia', () => {
  it('usan mayuscula solo al inicio y llevan tilde', () => {
    const [capitulo] = normalizeChapters({ guide_content: [seccion('S9', 'Comités', {
      tabla_comites: [{ comite: 'Directivo', temas_de_decision: ['Presupuesto'] }],
      consideraciones_por_enfoque: 'Formal',
    })] });

    const titulos = capitulo.subsections.map(s => s.title);
    expect(titulos).toContain('Consideraciones por enfoque');
    const tabla = capitulo.subsections.find(s => s.table)?.table;
    expect(tabla?.headers).toEqual(['Comité', 'Temas de decisión']);
  });
});

describe('secciones del Asistente 7.2 (flujos, indicadores y documentos)', () => {
  it('los flujos de procesos muestran una tabla de actividades por fase con los puntos de decisión', () => {
    const [capitulo] = normalizeChapters({ guide_content: [{
      section_id: 'S10',
      section_key: 'S10_flujos_de_procesos',
      section_title: 'Flujos de procesos',
      contenido: {
        introduccion_seccion: 'Flujos de Acme',
        fases: [{
          nombre_fase: 'Inicio',
          introduccion_fase: 'Arranque del proyecto',
          enfoque_aplicado: 'predictivo',
          actividades: [
            { orden: 1, actividad: 'Elaborar acta', es_punto_decision: false, descripcion: 'Redactar el acta', responsable: 'Director PMO', participantes: ['Sponsor', 'Lider'], entrada: 'Caso de negocio', salida: 'Acta', artefacto_relacionado: 'Acta de constitución' },
            { orden: 2, actividad: 'Aprobar acta', es_punto_decision: true, descripcion: 'Revisión', responsable: 'Sponsor', participantes: [], entrada: 'Acta', salida: 'Acta aprobada', artefacto_relacionado: '' },
          ],
          puntos_decision: [{ actividad_referencia: 'Aprobar acta', decision: '¿Se aprueba el acta?', criterio_aprobacion: 'Alcance claro', ruta_aprobado: 'Pasa a planeación', ruta_rechazado: 'Se ajusta el acta', responsable_decision: 'Sponsor', comite_si_aplica: '' }],
          criterios_salida_fase: ['Acta firmada'],
        }],
      },
    }] });

    expect(capitulo.title).toBe('Flujos de procesos');
    expect(capitulo.intro).toBe('Flujos de Acme');
    const [fase, decisiones, salida] = capitulo.subsections;
    expect(fase.title).toBe('Inicio');
    expect(fase.content).toContain('Arranque del proyecto');
    expect(fase.table?.headers).toEqual(['Actividad', 'Descripción', 'Responsable', 'Participantes', 'Entrada', 'Salida', 'Artefacto relacionado']);
    expect(fase.table?.rows[0][3]).toBe('Sponsor, Lider');
    expect(fase.table?.rows[1][0]).toBe('⬦ Aprobar acta');
    expect(decisiones.table?.rows[0]).toEqual(['⬦ ¿Se aprueba el acta?', 'Alcance claro', 'Pasa a planeación', 'Se ajusta el acta', 'Sponsor']);
    expect(salida.items).toEqual(['Acta firmada']);
  });

  it('las secciones S10-S12 van después de los comités', () => {
    const capitulos = normalizeChapters({ guide_content: [
      seccion('S12', 'Documentos generados', { artefactos: [{ artefacto: 'Acta', fase: 'Inicio' }] }),
      seccion('S9', 'Comités'),
      seccion('S11', 'Indicadores de gestión', { indicadores: [{ nombre_indicador: 'SPI', formula: 'EV/PV', herramienta_requerida: true }] }),
    ] });

    expect(capitulos.map(c => c.title)).toEqual(['Comités', 'Indicadores de gestión', 'Documentos generados']);
    expect(capitulos[1].subsections[0].table?.rows[0]).toEqual(['SPI', 'EV/PV', 'Sí']);
  });
});
