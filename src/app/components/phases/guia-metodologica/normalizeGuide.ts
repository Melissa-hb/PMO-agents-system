import type { ElementType } from 'react';
import { buildFlowchartSvg, buildLegendSvg, buildLifecycleSvg, flowPhaseFrom, formatElemento } from './flowchart';
import { BookOpen, Shield, BarChart2, Users, Lightbulb, GitCommitHorizontal } from 'lucide-react';
import type { DocVersion, GuideChapter, GuideSubsection } from './types';

const CHAPTER_ICONS: ElementType[] = [BookOpen, Shield, GitCommitHorizontal, BarChart2, Users, Lightbulb];
const TECHNICAL_KEYS = new Set([
  'error',
  'metadata',
  'agent_id',
  'project_id',
  'timestamp',
  'generated_at',
  'processing_time_seconds',
  'phase',
  'status',
  'iteration',
  'section_id',
  'sections_generated',
  'generation_notes',
  'document_version',
]);
const TITLE_KEYS = new Set([
  'titulo',
  'title',
  'nombre',
  'nombre_rol',
  'rol',
  'fase',
  'dominio',
  'criterio',
  'funcion',
  'accion',
  'riesgo',
  'weakness',
]);
const INTRO_CONTENT_KEYS = new Set([
  'descripcion_general',
  'contexto_organizacional',
  'descripcion_entorno',
  'enfoque_propuesto',
  'enfoque_adoptado',
  'descripcion_del_modelo',
  'introduccion_seccion',
]);
/** Titulos de campos que no salen bien de la clave JSON. */
const FIELD_TITLES: Record<string, string> = {
  cierre_seccion: 'Consideraciones finales',
  mandato_pmo: 'Mandato de la PMO',
  proposito: 'Propósito',
  autoridad: 'Autoridad',
  alineacion_estrategica: 'Alineación estratégica',
  servicios_prioritarios: 'Servicios prioritarios',
  criterios_de_exito: 'Criterios de éxito',
};
const GUIDE_SECTION_ORDER = [
  { number: 1, matches: ['introduccion', 's1_introduccion'] },
  { number: 2, matches: ['objetivo', 's2_objetivo'] },
  { number: 3, matches: ['alcance', 's3_alcance'] },
  { number: 4, matches: ['responsables de la guia', 'responsables guia', 'responsables', 's4_responsables_guia'] },
  { number: 5, matches: ['marco conceptual', 's5_marco_conceptual'] },
  { number: 6, matches: ['marco de referencia', 's6_marco_de_referencia'] },
  { number: 7, matches: ['politicas', 'politica', 's7_politicas'] },
  { number: 8, matches: ['roles y responsabilidades', 'roles responsabilidades', 's8_roles_y_responsabilidades'] },
  { number: 9, matches: ['comites', 'comite', 's9_comites'] },
  { number: 10, matches: ['flujos de procesos', 'flujo de procesos', 'flujos', 's10_flujos_de_procesos'] },
  { number: 11, matches: ['indicadores de gestion', 'indicadores', 's11_indicadores_de_gestion'] },
  { number: 12, matches: ['documentos generados', 'documentos', 's12_documentos_generados'] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function normalizeTable(table: any): { headers: string[]; rows: string[][] } | undefined {
  const headers = table?.headers ?? table?.encabezados ?? table?.columnas;
  const rows = table?.rows ?? table?.filas;
  if (!Array.isArray(headers) || !Array.isArray(rows)) return undefined;
  return {
    headers: headers.map(String),
    rows: rows.map((row: any) => Array.isArray(row) ? row.map(String) : []),
  };
}

function parseJsonIfString(raw: any): any {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return raw; }
}

function pickFirst(...values: any[]) {
  return values.find(value => value !== undefined && value !== null);
}

function isPlainObject(value: any) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isScalar(value: any) {
  return value === null || value === undefined || ['string', 'number', 'boolean'].includes(typeof value);
}

function isSimpleTableValue(value: any) {
  return isScalar(value) || (Array.isArray(value) && value.every(isScalar));
}

function isTechnicalKey(key: string) {
  return TECHNICAL_KEYS.has(key) || key.startsWith('_');
}

/** Orden del mandato de la PMO: la base (jsonb) reordena las claves y lo dejaría antes del objetivo. */
const MANDATO_FIELD_ORDER = ['proposito', 'autoridad', 'alineacion_estrategica', 'servicios_prioritarios', 'criterios_de_exito'];

function orderMandatoEntries(entries: [string, any][]): [string, any][] {
  const keys = new Set(entries.map(([key]) => key));
  if (keys.has('mandato_pmo')) {
    return [...entries.filter(([key]) => key !== 'mandato_pmo'), ...entries.filter(([key]) => key === 'mandato_pmo')];
  }
  if (MANDATO_FIELD_ORDER.every(key => keys.has(key))) {
    const rank = (key: string) => (MANDATO_FIELD_ORDER.includes(key) ? MANDATO_FIELD_ORDER.indexOf(key) : MANDATO_FIELD_ORDER.length);
    return [...entries].sort(([a], [b]) => rank(a) - rank(b));
  }
  return entries;
}

function meaningfulEntries(value: Record<string, any>) {
  return orderMandatoEntries(Object.entries(value).filter(([key, val]) => {
    if (isTechnicalKey(key)) return false;
    if (val === null || val === undefined || val === '') return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  }));
}

function asArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function titleFromObject(value: Record<string, any>, fallback: string) {
  for (const key of TITLE_KEYS) {
    if (value[key]) return String(value[key]);
  }
  return fallback;
}

function stringifyDeep(value: any): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        if (isScalar(item)) return String(item);
        if (isPlainObject(item)) return `${titleFromObject(item, `Elemento ${index + 1}`)}: ${stringifyDeepObject(item)}`;
        return stringifyDeep(item);
      })
      .filter(Boolean)
      .join('\n');
  }
  if (isPlainObject(value)) return stringifyDeepObject(value);
  return String(value);
}

function stringifyDeepObject(value: Record<string, any>) {
  return meaningfulEntries(value)
    .map(([key, val]) => `${formatFieldKey(key)}: ${stringifyDeep(val)}`)
    .join('\n');
}

function stringifyContent(value: any): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return stringifyDeep(value);
}

function normalizeSection(section: any, index: number) {
  const items = pickFirst(section?.items, section?.lista, section?.puntos, section?.actividades, section?.recomendaciones);
  return {
    title: String(pickFirst(section?.titulo, section?.title, section?.nombre, `Seccion ${index + 1}`)),
    content: stringifyContent(pickFirst(section?.contenido, section?.content, section?.descripcion, section?.detalle, section?.texto)),
    items: Array.isArray(items) ? items.map(stringifyDeep).filter(Boolean) : undefined,
    table: normalizeTable(pickFirst(section?.tabla, section?.table)),
  };
}

/** Format a snake_case/camelCase key into a human-readable title */
/** Palabras frecuentes en los campos de la guia que llevan tilde (ademas de las terminadas en -cion/-sion). */
const ACCENTED_WORDS: Record<string, string> = {
  guia: 'guía', guias: 'guías', politica: 'política', politicas: 'políticas', comite: 'comité', comites: 'comités',
  proposito: 'propósito', ambito: 'ámbito', parrafo: 'párrafo', especificos: 'específicos', especificas: 'específicas',
  tecnico: 'técnico', tecnicos: 'técnicos', tecnica: 'técnica', tecnicas: 'técnicas', metodologico: 'metodológico',
  metodologica: 'metodológica', diagnostico: 'diagnóstico', codigo: 'código', item: 'ítem', items: 'ítems', area: 'área',
  areas: 'áreas', analisis: 'análisis', critico: 'crítico', criticos: 'críticos', critica: 'crítica', criticas: 'críticas',
  numero: 'número', metrica: 'métrica', metricas: 'métricas', indice: 'índice', basico: 'básico', maximo: 'máximo',
  minimo: 'mínimo', unico: 'único', periodo: 'período', practica: 'práctica', practicas: 'prácticas',
  caracteristicas: 'características', estrategico: 'estratégico', estrategica: 'estratégica', estrategicos: 'estratégicos',
  economico: 'económico', publico: 'público', tambien: 'también', ultimo: 'último', ultima: 'última', agil: 'ágil',
  agiles: 'ágiles', hibrido: 'híbrido', hibrida: 'híbrida', rapido: 'rápido', logica: 'lógica', tipico: 'típico',
};

function accentWord(word: string): string {
  const lower = word.toLowerCase();
  if (ACCENTED_WORDS[lower]) return ACCENTED_WORDS[lower];
  if (/[cs]ion$/.test(lower)) return lower.replace(/ion$/, 'ión');
  return lower;
}

/** "temas_de_decision" → "Temas de decisión": titulos legibles y con ortografia a partir de las claves del JSON. */
function formatFieldKey(key: string): string {
  if (FIELD_TITLES[key]) return FIELD_TITLES[key];
  const words = key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(w => (/^[A-Z0-9]{2,}$/.test(w) ? w : accentWord(w)));
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function guideSectionOrderIndex(section: any, fallbackIndex: number): number {
  const titleText = normalizeSearchText([
    section?.section_title,
    section?.title,
    section?.titulo,
    section?.nombre,
    section?.section_key,
  ].filter(Boolean).join(' '));

  const titleMatch = GUIDE_SECTION_ORDER.findIndex(order =>
    order.matches.some(match => titleText.includes(normalizeSearchText(match)))
  );
  if (titleMatch >= 0) return titleMatch;

  const idText = String(section?.section_id ?? section?.section_key ?? '');
  const sectionNumber = idText.match(/^s0?(\d+)/i)?.[1];
  const numericMatch = GUIDE_SECTION_ORDER.findIndex(order => order.number === Number(sectionNumber));
  return numericMatch >= 0 ? numericMatch : GUIDE_SECTION_ORDER.length + fallbackIndex;
}

function tableFromObjectArray(values: any[]): GuideSubsection['table'] | undefined {
  if (!values.length || !values.every(isPlainObject)) return undefined;
  const keys = Array.from(new Set(
    values.flatMap(value =>
      meaningfulEntries(value)
        .filter(([_, val]) => isSimpleTableValue(val))
        .map(([key]) => key)
    )
  ));
  if (keys.length < 2) return undefined;

  return {
    headers: keys.map(formatFieldKey),
    rows: values.map(value => keys.map(key => stringifyDeep(value[key]))),
  };
}

function complexSubsectionsFromObjectArray(values: any[], title: string): GuideSubsection[] {
  if (!values.length || !values.every(isPlainObject)) return [];

  return values.flatMap((item, index) => {
    const itemTitle = titleFromObject(item, `Elemento ${index + 1}`);
    return meaningfulEntries(item)
      .filter(([_, val]) => !isSimpleTableValue(val))
      .flatMap(([key, val]) => {
        const nestedTitle = `${title} - ${itemTitle} - ${formatFieldKey(key)}`;

        if (Array.isArray(val)) {
          if (val.length === 0) return [];
          if (val.every(isPlainObject)) {
            const table = tableFromObjectArray(val);
            return [{
              title: nestedTitle,
              content: '',
              items: table ? undefined : objectArrayToItems(val),
              table,
            }];
          }
          return [{ title: nestedTitle, content: '', items: val.map(stringifyDeep).filter(Boolean) }];
        }

        if (isPlainObject(val)) return objectToNestedSubsections(val, nestedTitle);

        return [{ title: nestedTitle, content: stringifyDeep(val) }];
      });
  });
}

function groupFlattenedPhaseFields(value: Record<string, any>) {
  const result: Record<string, any> = { ...value };
  const groups = new Map<string, Record<string, any>>();
  const suffixes = ['nombre', 'introduccion', 'descripcion', 'objetivo', 'entrada', 'salida', 'responsable', 'participantes'];

  for (const [key, val] of meaningfulEntries(value)) {
    const normalizedKey = key.toLowerCase();
    const suffix = suffixes.find(candidate => normalizedKey.endsWith(`_${candidate}`));
    if (!suffix) continue;

    const prefix = key.slice(0, -(suffix.length + 1));
    if (!/^(fase|etapa)_/i.test(prefix)) continue;

    const group = groups.get(prefix) ?? {};
    group[suffix] = val;
    groups.set(prefix, group);
  }

  for (const [prefix, group] of groups) {
    if (Object.keys(group).length < 2) continue;
    for (const suffix of Object.keys(group)) {
      delete result[`${prefix}_${suffix}`];
    }
    result[prefix] = {
      ...(isPlainObject(result[prefix]) ? result[prefix] : {}),
      ...group,
    };
  }

  return result;
}

function objectArrayToItems(values: any[]) {
  return values
    .map((item, index) => {
      if (!isPlainObject(item)) return stringifyDeep(item);
      const title = titleFromObject(item, `Elemento ${index + 1}`);
      const details = meaningfulEntries(item)
        .filter(([key]) => !TITLE_KEYS.has(key))
        .map(([key, val]) => `${formatFieldKey(key)}: ${stringifyDeep(val)}`)
        .join('\n');
      return details ? `${title}\n${details}` : title;
    })
    .filter(Boolean);
}

function objectToNestedSubsections(value: Record<string, any>, titlePrefix = ''): GuideSubsection[] {
  return meaningfulEntries(value).flatMap(([key, val]) => {
    const title = titlePrefix ? `${titlePrefix} - ${formatFieldKey(key)}` : formatFieldKey(key);

    if (Array.isArray(val)) {
      if (val.length === 0) return [];
      if (val.every(isPlainObject)) {
        const table = tableFromObjectArray(val);
        return [{
          title,
          content: '',
          items: table ? undefined : objectArrayToItems(val),
          table,
        }, ...complexSubsectionsFromObjectArray(val, title)];
      }
      return [{ title, content: '', items: val.map(stringifyDeep).filter(Boolean) }];
    }

    if (isPlainObject(val)) {
      const scalarContent = meaningfulEntries(val)
        .filter(([_, nestedVal]) => isScalar(nestedVal))
        .map(([nestedKey, nestedVal]) => `${formatFieldKey(nestedKey)}: ${stringifyDeep(nestedVal)}`)
        .join('\n');
      const nestedObject = Object.fromEntries(meaningfulEntries(val).filter(([_, nestedVal]) => !isScalar(nestedVal)));
      return [
        ...(scalarContent ? [{ title, content: scalarContent }] : []),
        ...objectToNestedSubsections(nestedObject, title),
      ];
    }

    return [{ title, content: stringifyDeep(val) }];
  });
}

/**
 * Converts a guide_content item's "contenido" object into flat subsections.
 * Handles strings, arrays of strings, arrays of objects, and nested objects.
 */
function contenidoToSubsections(contenido: any): GuideChapter['subsections'] {
  if (!contenido || typeof contenido !== 'object') return [];
  const normalizedContenido = groupFlattenedPhaseFields(contenido);

  return meaningfulEntries(normalizedContenido)
    .filter(([key]) => !INTRO_CONTENT_KEYS.has(key))
    .map(([key, val]: [string, any]) => {
      const title = formatFieldKey(key);

      if (Array.isArray(val)) {
        if (val.length === 0) return null;
        // Array of primitives
        if (!isPlainObject(val[0])) {
          return { title, content: '', items: val.map(stringifyDeep).filter(Boolean) };
        }
        // Array of objects — extract most descriptive field per item
        const table = tableFromObjectArray(val);
        return [{
          title,
          content: '',
          items: table ? undefined : objectArrayToItems(val),
          table,
        }, ...complexSubsectionsFromObjectArray(val, title)];
      }

      if (isPlainObject(val)) {
        const nested = objectToNestedSubsections(val, title);
        return nested.length > 0 ? nested : { title, content: stringifyContent(val) };
      }

      return { title, content: String(val) };
    })
    .flat()
    .filter(Boolean) as GuideChapter['subsections'];
}

function textOf(value: any): string {
  return stringifyDeep(value).trim();
}

/**
 * S10 Flujos de procesos (Asistente 7.2): por cada fase del ciclo de vida, su introducción, la
 * tabla de actividades (los puntos de decisión llevan ⬦), las rutas de aprobado/rechazado de cada
 * decisión y los criterios de entrada y salida, como lo describe el documento de la metodología.
 */
function processFlowSubsections(contenido: any): GuideSubsection[] {
  const fases = Array.isArray(contenido?.fases) ? contenido.fases : [];
  const list = (value: unknown) => (Array.isArray(value) ? value.map(textOf).filter(Boolean) : [textOf(value)].filter(Boolean));

  // Como en las guías de referencia: ciclo de vida general y simbología antes de las etapas.
  const overview: GuideSubsection[] = [];
  const lifecycle = buildLifecycleSvg(fases.map((fase: any, index: number) => ({
    numero: Number(fase?.numero_fase) || index + 1,
    nombre: textOf(fase?.nombre_fase) || `Fase ${index + 1}`,
    nombrePropio: textOf(fase?.nombre_propio_organizacion),
  })));
  if (lifecycle) {
    overview.push({ title: 'Ciclo de vida del proyecto', content: '', diagram: { svg: lifecycle, caption: 'Ciclo de vida del proyecto y etapas de la guía' } });
    overview.push({
      title: 'Simbología de los flujogramas',
      content: 'Cada etapa se presenta con su ficha (entrada, salida, regla de decisión y registros), sus actividades y su flujograma. El número de cada actividad es el mismo en la tabla y en el flujograma, y cada carril corresponde al rol responsable.',
      diagram: { svg: buildLegendSvg(), caption: 'Simbología de los flujogramas' },
    });
  }

  return [...overview, ...fases.flatMap((fase: any, index: number) => {
    const numero = Number(fase?.numero_fase) || index + 1;
    const nombre = textOf(fase?.nombre_fase) || `Fase ${index + 1}`;
    const propio = textOf(fase?.nombre_propio_organizacion);
    const title = `Etapa ${numero}. ${nombre}${propio && normalizeSearchText(propio) !== normalizeSearchText(nombre) ? ` (${propio})` : ''}`;
    const contexto = [
      textOf(fase?.enfoque_aplicado) && `Enfoque: ${textOf(fase.enfoque_aplicado)}`,
      textOf(fase?.nivel_madurez_fase) && `Nivel de madurez: ${textOf(fase.nivel_madurez_fase)}`,
    ].filter(Boolean).join(' · ');

    const actividades = Array.isArray(fase?.actividades) ? fase.actividades : [];
    const decisiones = Array.isArray(fase?.puntos_decision) ? fase.puntos_decision.filter((d: any) => textOf(d?.decision) || textOf(d?.actividad_referencia)) : [];
    const registros = [...new Set(actividades.map((a: any) => textOf(a?.artefacto_relacionado)).filter(Boolean))] as string[];
    const bullets = (values: string[]) => values.map(v => (values.length > 1 ? `• ${v}` : v)).join('\n');

    // Ficha de la etapa: entrada, salida, regla de decisión y registros.
    const ficha: string[][] = [
      ['Entrada', bullets(list(fase?.criterios_entrada_fase))],
      ['Salida', bullets(list(fase?.criterios_salida_fase))],
      ['Regla de decisión', decisiones.map((d: any) => {
        const pregunta = textOf(d?.decision) || textOf(d?.actividad_referencia);
        return [pregunta, textOf(d?.ruta_aprobado) && `Sí: ${textOf(d.ruta_aprobado)}`, textOf(d?.ruta_rechazado) && `No: ${textOf(d.ruta_rechazado)}`]
          .filter(Boolean).join(' ');
      }).join('\n')],
      ['Registros', registros.join(' · ')],
    ].filter(([, value]) => value);

    const subsections: GuideSubsection[] = [{
      title,
      content: [textOf(fase?.introduccion_fase), contexto].filter(Boolean).join('\n\n'),
      table: ficha.length > 0 ? { headers: ['Ficha de la etapa', 'Detalle'], rows: ficha } : undefined,
    }];

    if (actividades.length > 0) {
      subsections.push({
        title: `Etapa ${numero} - Actividades`,
        content: '',
        table: {
          headers: ['N.°', 'Actividad', 'Descripción', 'Responsable', 'Participantes', 'Entrada', 'Salida', 'Registro'],
          rows: actividades.map((a: any, i: number) => [
            `${numero}.${Number(a?.orden) || i + 1}`,
            `${a?.es_punto_decision ? '⬦ ' : ''}${textOf(a?.actividad).replace(/^⬦\s*/, '')}`,
            textOf(a?.descripcion),
            textOf(a?.responsable),
            Array.isArray(a?.participantes) ? a.participantes.map(textOf).join(', ') : textOf(a?.participantes),
            textOf(a?.entrada),
            textOf(a?.salida),
            textOf(a?.artefacto_relacionado),
          ]),
        },
      });
    }

    const flow = flowPhaseFrom(fase, index);
    if (flow) {
      subsections.push({
        title: `Etapa ${numero} - Flujograma`,
        content: '',
        diagram: { svg: buildFlowchartSvg(flow), caption: `Flujograma de la etapa ${numero}: ${nombre.toLowerCase()}` },
      });
    }

    if (decisiones.length > 0) {
      subsections.push({
        title: `Etapa ${numero} - Puntos de decisión`,
        content: '',
        table: {
          headers: ['Decisión', 'Criterio de aprobación', '→ Aprobado', '→ Rechazado / Observaciones', 'Responsable'],
          rows: decisiones.map((d: any) => [
            `⬦ ${textOf(d?.decision) || textOf(d?.actividad_referencia)}`,
            textOf(d?.criterio_aprobacion),
            textOf(d?.ruta_aprobado),
            textOf(d?.ruta_rechazado),
            [textOf(d?.responsable_decision), textOf(d?.comite_si_aplica)].filter(Boolean).join(' · '),
          ]),
        },
      });
    }
    return subsections;
  })];
}

function isProcessFlowSection(section: any) {
  return /^s0?10\b|^s10_/i.test(String(section?.section_key ?? section?.section_id ?? ''))
    && Array.isArray(section?.contenido?.fases);
}

/**
 * Normalizes the Gemini Agent 7 guide_content format (sections S01-S16)
 * into GuideChapter objects for the DocumentRenderer.
 */
function normalizeGuideContent(guideContent: any[]): GuideChapter[] {
  // Skip S01 (Portada) — it's just document metadata, not a renderable chapter
  const sections = guideContent
    .filter((s: any) => s.section_id !== 'S01')
    .map((section: any, originalIndex: number) => ({ section, originalIndex }))
    .sort((a, b) =>
      guideSectionOrderIndex(a.section, a.originalIndex) - guideSectionOrderIndex(b.section, b.originalIndex) ||
      a.originalIndex - b.originalIndex
    )
    .map(({ section }) => section);
  if (sections.length === 0) return [];

  return sections.map((section: any, index: number) => {
    const contenido = section.contenido ?? {};
    const subsections = isProcessFlowSection(section) ? processFlowSubsections(contenido) : contenidoToSubsections(contenido);

    // Extract a meaningful intro from common summary fields
    const intro = stringifyContent(
      contenido?.descripcion_general ??
      contenido?.contexto_organizacional ??
      contenido?.descripcion_entorno ??
      contenido?.enfoque_propuesto ??
      contenido?.enfoque_adoptado ??
      contenido?.descripcion_del_modelo ??
      contenido?.introduccion_seccion ??
      contenido?.analisis_integrado?.coherencia_entre_fuentes ??
      ''
    );

    return {
      number: index + 1,
      icon: CHAPTER_ICONS[index % CHAPTER_ICONS.length],
      title: String(section.section_title ?? `Sección ${index + 1}`),
      intro,
      subsections: subsections.length > 0
        ? subsections
        : [{ title: 'Contenido', content: 'Contenido procesado por el Agente 7.' }],
    };
  });
}



/**
 * Capítulo final de trazabilidad entre el diagnóstico y la guía (como el anexo de las guías de
 * referencia): cada hallazgo de la Exploración con las decisiones de la guía que lo atienden. Sale de
 * trazabilidad_hallazgos y del registro de hallazgos que el backend guarda con la guía; si la guía
 * no tiene el registro (versiones anteriores), se listan las decisiones con sus códigos.
 */
function traceabilityChapter(diagnosis: any, number: number): GuideChapter | null {
  const trace = Array.isArray(diagnosis?.trazabilidad_hallazgos) ? diagnosis.trazabilidad_hallazgos : [];
  if (trace.length === 0) return null;
  const registry = Array.isArray(diagnosis?.registro_hallazgos) ? diagnosis.registro_hallazgos : [];
  const elemento = (e: any) => formatElemento(textOf(e?.elemento));

  const rows: string[][] = registry
    .map((h: any) => {
      const id = textOf(h?.id);
      const respuestas = trace
        .filter((e: any) => Array.isArray(e?.hallazgos_origen) && e.hallazgos_origen.map(textOf).includes(id))
        .map((e: any) => `• ${elemento(e)}: ${textOf(e?.decision)}`);
      return respuestas.length > 0 ? [`${id}. ${textOf(h?.texto)}`, `Fase ${textOf(h?.fase)} · ${textOf(h?.tipo)}`, respuestas.join('\n')] : null;
    })
    .filter(Boolean);

  const subsection: GuideSubsection = rows.length > 0
    ? { title: 'Hallazgos del diagnóstico y respuesta de la guía', content: '', table: { headers: ['Hallazgo del diagnóstico', 'Origen', 'Respuesta de la guía'], rows } }
    : {
      title: 'Decisiones de la guía y hallazgos que las sustentan',
      content: '',
      table: {
        headers: ['Elemento de la guía', 'Decisión', 'Hallazgos de origen'],
        rows: trace.map((e: any) => [elemento(e), textOf(e?.decision), Array.isArray(e?.hallazgos_origen) ? e.hallazgos_origen.map(textOf).join(', ') : '']),
      },
    };

  return {
    number,
    icon: CHAPTER_ICONS[(number - 1) % CHAPTER_ICONS.length],
    title: 'Trazabilidad entre el diagnóstico y la guía',
    intro: 'Relación entre los hallazgos del diagnóstico (registro documental, entrevistas, encuesta de idoneidad y diagnóstico de madurez) y los elementos de la guía que los atienden. Cada hallazgo conserva el código con el que se registró en la plataforma.',
    subsections: [subsection],
  };
}

function normalizeChapters(raw: any): GuideChapter[] {
  const parsed = parseJsonIfString(raw);

  // ── Priority 1: Gemini Agent 7 native format: guide_content sections array ──
  const guideContent =
    parsed?.diagnosis?.guide_content ??
    parsed?.guide_content ??
    parsed?.diagnosis?.guideContent ??
    parsed?.guideContent;
  if (Array.isArray(guideContent) && guideContent.length > 0) {
    const chapters = normalizeGuideContent(guideContent);
    const annex = traceabilityChapter(parsed?.diagnosis ?? parsed, chapters.length + 1);
    return annex ? [...chapters, annex] : chapters;
  }

  // ── Priority 2: Classic chapters/capitulos format ──────────────────────────
  const deepSearch = (obj: any) => pickFirst(
    obj?.capitulos,
    obj?.chapters,
    obj?.guia?.capitulos,
    obj?.guia_metodologica?.capitulos,
    obj?.guiaMetodologica?.capitulos,
    obj?.documento?.capitulos,
    obj?.contenido?.capitulos,
    obj?.estructura?.capitulos,
    obj?.guia_metodologica?.chapters,
    obj?.guia?.chapters,
    obj?.documento?.chapters,
  );
  const candidateKeys = ['guia_metodologica', 'guia', 'documento', 'resultado', 'result', 'data'];
  const source = deepSearch(parsed)
    ?? candidateKeys.reduce((found: any, key: string) => found ?? deepSearch(parsed?.[key]), undefined);
  const chapterList = asArray(source);

  if (chapterList.length === 0) {
    // Fallback: treat secciones as a single chapter
    const sectionList = asArray(pickFirst(parsed?.secciones, parsed?.sections, parsed?.apartados, parsed?.contenido?.secciones));
    if (sectionList.length > 0) {
      return [{
        number: 1,
        icon: CHAPTER_ICONS[0],
        title: String(pickFirst(parsed?.titulo, parsed?.title, 'Guia metodologica')),
        intro: stringifyContent(pickFirst(parsed?.resumen_ejecutivo, parsed?.resumen, parsed?.introduccion, parsed?.intro)),
        subsections: sectionList.map(normalizeSection).filter(section => section.title || section.content || section.items?.length),
      }];
    }

    // Last resort: build chapter from top-level fields
    const derivedSections = [
      { titulo: 'Resumen ejecutivo', contenido: pickFirst(parsed?.resumen_ejecutivo, parsed?.resumen, parsed?.sintesis) },
      { titulo: 'Criterios de implementacion', items: pickFirst(parsed?.criterios_implementacion, parsed?.criterios, parsed?.implementation_criteria) },
      { titulo: 'Artefactos recomendados', items: pickFirst(parsed?.artefactos_recomendados, parsed?.artefactos, parsed?.artifacts) },
      { titulo: 'Riesgos de adopcion', items: pickFirst(parsed?.riesgos_adopcion, parsed?.riesgos, parsed?.adoption_risks) },
      { titulo: 'Metricas de seguimiento', items: pickFirst(parsed?.metricas_seguimiento, parsed?.metricas, parsed?.metrics) },
    ].filter(section => section.contenido || (Array.isArray(section.items) && section.items.length > 0));

    if (derivedSections.length > 0) {
      return [{
        number: 1,
        icon: CHAPTER_ICONS[0],
        title: String(pickFirst(parsed?.titulo, parsed?.title, 'Guia metodologica')),
        intro: stringifyContent(pickFirst(parsed?.introduccion, parsed?.intro, parsed?.tipo_pmo)),
        subsections: derivedSections.map(normalizeSection),
      }];
    }

    return [];
  }

  return chapterList.map((chapter: any, index: number) => {
    const sections = pickFirst(chapter.secciones, chapter.subsections, chapter.apartados, chapter.sections, chapter.contenidos, []);
    const normalizedSections = asArray(sections).map(normalizeSection).filter(section => section.title || section.content || section.items?.length);
    if (normalizedSections.length === 0) {
      const chapterContent = pickFirst(chapter.contenido, chapter.content, chapter.descripcion, chapter.detalle, chapter.texto);
      if (chapterContent) {
        normalizedSections.push(normalizeSection({ titulo: 'Contenido', contenido: chapterContent }, 0));
      }
    }
    return {
      number: Number(chapter.numero ?? chapter.number ?? index + 1),
      icon: CHAPTER_ICONS[index % CHAPTER_ICONS.length],
      title: String(pickFirst(chapter.titulo, chapter.title, chapter.nombre, `Capitulo ${index + 1}`)),
      intro: stringifyContent(pickFirst(chapter.introduccion, chapter.intro, chapter.resumen, chapter.descripcion)),
      subsections: normalizedSections,
    };
  });
}


function unwrapGuidePayload(raw: any) {
  const parsed = parseJsonIfString(raw);
  // Return _current if wrapped by the edge function versioning logic.
  // We intentionally keep the full Gemini response (including 'diagnosis' key)
  // so that normalizeChapters can find diagnosis.guide_content.
  return parsed?._current ?? parsed;
}

function hasUsableGuidePayload(raw: any) {
  return normalizeChapters(unwrapGuidePayload(raw)).length > 0;
}

function versionsFromPayload(raw: any): DocVersion[] {
  if (Array.isArray(raw?._versions) && raw._versions.length > 0) {
    return raw._versions
      .filter((version: any) => hasUsableGuidePayload(version.data))
      .map((version: any, index: number) => ({
        number: Number(version.number ?? index + 1),
        generatedAt: String(version.generatedAt ?? version.generated_at ?? raw?._generated_at ?? new Date().toISOString()),
        comment: version.comment ?? undefined,
        status: version.status === 'revisado' ? 'revisado' : 'generado',
        data: version.data,
      }));
  }

  if (!raw) return [];
  if (!hasUsableGuidePayload(raw)) return [];
  return [{
    number: Number(raw?._latest_version ?? 1),
    generatedAt: String(raw?._generated_at ?? new Date().toISOString()),
    comment: raw?._last_comment ?? undefined,
    status: Number(raw?._latest_version ?? 1) > 1 ? 'revisado' : 'generado',
    data: unwrapGuidePayload(raw),
  }];
}

export { hasUsableGuidePayload, normalizeChapters, unwrapGuidePayload, versionsFromPayload };
