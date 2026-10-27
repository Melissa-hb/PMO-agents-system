/**
 * Diagramas de la sección de flujos de la guía (S10), dibujados como SVG a partir de los datos del
 * Asistente 7.2, con la estructura de las guías de referencia (DEVIM, LCDA): flujograma de carriles
 * por rol para cada etapa, ciclo de vida general y simbología. Son funciones puras que devuelven el
 * SVG como texto, para usarlo igual en el visor y en la descarga HTML/PDF.
 */

const ACCENT = '#5454e9';
const INK = '#1f2937';
const MUTED = '#6b7280';
const LINE = '#374151';
const LANE_BORDER = '#d1d5db';
const FONT = "font-family=\"Inter, 'Segoe UI', Arial, sans-serif\"";

export interface FlowActivity {
  numero: string;
  actividad: string;
  responsable: string;
  esDecision: boolean;
  registro: string;
}

export interface FlowPhase {
  numero: number;
  nombre: string;
  entrada: string;
  salida: string;
  actividades: FlowActivity[];
}

function textOf(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Parte un texto en líneas de hasta maxChars; si no cabe en maxLines, la última termina en "…". */
export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines.map(l => (l.length > maxChars ? `${l.slice(0, maxChars - 1)}…` : l));
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] = `${last.length > maxChars - 1 ? last.slice(0, maxChars - 1) : last}…`;
  return kept;
}

function textLines(lines: string[], x: number, y: number, lineHeight: number, attrs: string): string {
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  return lines
    .map((line, i) => `<text x="${x}" y="${startY + i * lineHeight}" ${attrs} text-anchor="middle" dominant-baseline="middle">${escapeXml(line)}</text>`)
    .join('');
}

/** Datos del flujograma a partir de una fase de S10 (null si no tiene actividades). */
export function flowPhaseFrom(fase: any, index: number): FlowPhase | null {
  const actividades = Array.isArray(fase?.actividades) ? fase.actividades : [];
  if (actividades.length === 0) return null;
  const numero = Number(fase?.numero_fase) || index + 1;
  const list = (value: unknown) => (Array.isArray(value) ? value.map(textOf).filter(Boolean) : [textOf(value)].filter(Boolean));
  return {
    numero,
    nombre: textOf(fase?.nombre_fase) || `Fase ${numero}`,
    entrada: list(fase?.criterios_entrada_fase)[0] ?? textOf(actividades[0]?.entrada),
    salida: list(fase?.criterios_salida_fase)[0] ?? textOf(actividades[actividades.length - 1]?.salida),
    actividades: actividades.map((a: any, i: number) => ({
      numero: `${numero}.${Number(a?.orden) || i + 1}`,
      actividad: textOf(a?.actividad).replace(/^⬦\s*/, ''),
      responsable: textOf(a?.responsable) || 'Sin responsable',
      esDecision: a?.es_punto_decision === true,
      registro: textOf(a?.artefacto_relacionado),
    })),
  };
}

/**
 * Nombre legible de un elemento trazado: "S10_flujos_de_procesos.fases[Inicio]" →
 * "S10 · Flujos de procesos · Inicio"; lo que ya es legible queda igual.
 */
export function formatElemento(elemento: string): string {
  const m = /^(S\d+)[_ ·]+([^.[]+?)\s*(?:\.?fases?\s*\[([^\]]+)\])?$/i.exec(elemento.trim());
  if (!m || !/_|\[/.test(elemento)) return elemento.trim();
  const text = m[2].replace(/_/g, ' ').trim();
  return [m[1], text.charAt(0).toUpperCase() + text.slice(1), m[3]?.trim()].filter(Boolean).join(' · ');
}

/** Ancho natural (viewBox) de un SVG generado aquí. */
export function svgWidth(svg: string): number {
  const m = /viewBox="0 0 ([\d.]+) /.exec(svg);
  return m ? Number(m[1]) : 0;
}

/** Número de figura de cada diagrama de la guía, en orden de aparición. */
export function figureNumbers<T extends { diagram?: unknown }>(chapters: Array<{ subsections: T[] }>): Map<T, number> {
  const numbers = new Map<T, number>();
  chapters.forEach(ch => ch.subsections.forEach(sec => { if (sec.diagram) numbers.set(sec, numbers.size + 1); }));
  return numbers;
}

// ── Flujograma de carriles ───────────────────────────────────────────────────

const LANE_LABEL_W = 150;
const COL_W = 210;
const BOX_W = 162;
const BOX_H = 76;
const DIAMOND_W = 168;
const DIAMOND_H = 100;
const LANE_H = 170;
const BAND_H = 64;
const MARGIN_X = 24;

function arrowHead(id: string): string {
  return `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${LINE}"/></marker>`;
}

/**
 * Flujograma de carriles de una etapa: un carril por responsable, actividades numeradas como en la
 * tabla, rombo en los puntos de decisión (Sí → siguiente actividad, No → conector que regresa a la
 * actividad anterior), inicio y fin con la entrada y la salida de la etapa, y el registro que deja
 * cada actividad.
 */
export function buildFlowchartSvg(phase: FlowPhase): string {
  const lanes: string[] = [];
  phase.actividades.forEach(a => { if (!lanes.includes(a.responsable)) lanes.push(a.responsable); });
  const n = phase.actividades.length;
  // Si la etapa termina en una decision, el "Sí" va a una columna extra con el fin (el "No" sale hacia abajo).
  const endsInDecision = phase.actividades[n - 1].esDecision;
  const width = LANE_LABEL_W + MARGIN_X + (n + (endsInDecision ? 1 : 0)) * COL_W + MARGIN_X;
  const height = BAND_H + lanes.length * LANE_H + BAND_H;
  const markerId = `flecha-${phase.numero}`;

  const colX = (i: number) => LANE_LABEL_W + MARGIN_X + i * COL_W + COL_W / 2;
  const laneTop = (lane: number) => BAND_H + lane * LANE_H;
  const centerY = (i: number) => laneTop(lanes.indexOf(phase.actividades[i].responsable)) + 76;
  const halfW = (i: number) => (phase.actividades[i].esDecision ? DIAMOND_W : BOX_W) / 2;
  const halfH = (i: number) => (phase.actividades[i].esDecision ? DIAMOND_H : BOX_H) / 2;

  const parts: string[] = [];
  parts.push(`<defs>${arrowHead(markerId)}</defs>`);
  parts.push(`<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#fff" stroke="${INK}" stroke-width="1.5"/>`);

  // Bandas de entradas y salidas, y carriles.
  const band = (y: number, label: string) =>
    `<rect x="14" y="${y + 14}" width="${LANE_LABEL_W - 28}" height="${BAND_H - 28}" rx="3" fill="${ACCENT}"/>`
    + `<text x="${LANE_LABEL_W / 2}" y="${y + BAND_H / 2}" fill="#fff" font-size="12" font-weight="700" text-anchor="middle" dominant-baseline="middle">${label}</text>`;
  parts.push(band(0, 'ENTRADAS'));
  parts.push(band(height - BAND_H, 'SALIDAS'));
  [BAND_H, ...lanes.map((_, l) => laneTop(l) + LANE_H)].forEach(y =>
    parts.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${LANE_BORDER}" stroke-width="1.2"/>`));
  parts.push(`<line x1="${LANE_LABEL_W}" y1="0" x2="${LANE_LABEL_W}" y2="${height}" stroke="${LANE_BORDER}" stroke-width="1.2"/>`);
  lanes.forEach((lane, l) => {
    if (l % 2 === 1) parts.push(`<rect x="${LANE_LABEL_W}" y="${laneTop(l)}" width="${width - LANE_LABEL_W}" height="${LANE_H}" fill="#f9fafb"/>`);
    parts.push(textLines(wrapText(lane.toUpperCase(), 18, 4), LANE_LABEL_W / 2, laneTop(l) + LANE_H / 2, 15,
      `fill="${INK}" font-size="11.5" font-weight="700"`));
  });

  const arrow = (d: string, dashed = false) =>
    `<path d="${d}" fill="none" stroke="${LINE}" stroke-width="1.6"${dashed ? ' stroke-dasharray="5 4"' : ''} marker-end="url(#${markerId})"/>`;
  const terminal = (cx: number, cy: number, label: string) =>
    `<rect x="${cx - 52}" y="${cy - 17}" width="104" height="34" rx="17" fill="#fff" stroke="${INK}" stroke-width="1.6"/>`
    + `<text x="${cx}" y="${cy}" fill="${INK}" font-size="12.5" font-weight="700" text-anchor="middle" dominant-baseline="middle">${label}</text>`;

  // Inicio → primera actividad.
  const startX = colX(0);
  parts.push(terminal(startX, BAND_H / 2, 'INICIO'));
  if (phase.entrada) {
    parts.push(`<text x="${startX + 64}" y="${BAND_H / 2}" fill="${MUTED}" font-size="11" font-style="italic" dominant-baseline="middle">${escapeXml(wrapText(phase.entrada, 110, 1)[0])}</text>`);
  }
  parts.push(arrow(`M${startX},${BAND_H / 2 + 17} L${startX},${centerY(0) - halfH(0)}`));

  // Conexiones entre actividades consecutivas (en un decisión, la salida "Sí").
  let connector = 0;
  const connectorsByTarget = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const a = phase.actividades[i];
    const x = colX(i);
    const y = centerY(i);
    if (i < n - 1) {
      const nx = colX(i + 1) - halfW(i + 1);
      const ny = centerY(i + 1);
      const sx = x + halfW(i);
      const mid = sx + (nx - sx) / 2;
      parts.push(arrow(ny === y ? `M${sx},${y} L${nx},${ny}` : `M${sx},${y} L${mid},${y} L${mid},${ny} L${nx},${ny}`));
      if (a.esDecision) parts.push(`<text x="${sx + 6}" y="${y - 8}" fill="${INK}" font-size="11" font-weight="700">Sí</text>`);
    }
    if (a.esDecision && i > 0) {
      // "No": conector numerado bajo el rombo y el mismo conector sobre la actividad a la que
      // regresa (la anterior que no es una decision); si varias regresan a la misma, van lado a lado.
      connector += 1;
      let target = i - 1;
      while (target > 0 && phase.actividades[target].esDecision) target -= 1;
      const slot = connectorsByTarget.get(target) ?? 0;
      connectorsByTarget.set(target, slot + 1);
      const cyNo = y + halfH(i) + 26;
      parts.push(arrow(`M${x},${y + halfH(i)} L${x},${cyNo - 12}`));
      parts.push(`<text x="${x + 8}" y="${y + halfH(i) + 12}" fill="${INK}" font-size="11" font-weight="700">No</text>`);
      const circle = (cx: number, cy: number) =>
        `<circle cx="${cx}" cy="${cy}" r="12" fill="${ACCENT}" stroke="#3b3bb3" stroke-width="1.2"/>`
        + `<text x="${cx}" y="${cy}" fill="#fff" font-size="11" font-weight="700" text-anchor="middle" dominant-baseline="middle">${connector}</text>`;
      parts.push(circle(x, cyNo));
      const tx = (phase.actividades[target].esDecision ? colX(target) : colX(target) - halfW(target) + 30) + slot * 28;
      const ty = centerY(target) - halfH(target);
      parts.push(circle(tx, ty - 30));
      parts.push(arrow(`M${tx},${ty - 18} L${tx},${ty}`));
    }
  }

  // Última actividad → fin.
  const endY = height - BAND_H / 2;
  let lastX = colX(n - 1);
  if (endsInDecision) {
    const sx = lastX + halfW(n - 1);
    lastX = colX(n);
    parts.push(arrow(`M${sx},${centerY(n - 1)} L${lastX},${centerY(n - 1)} L${lastX},${endY - 17}`));
    parts.push(`<text x="${sx + 6}" y="${centerY(n - 1) - 8}" fill="${INK}" font-size="11" font-weight="700">Sí</text>`);
  } else {
    parts.push(arrow(`M${lastX},${centerY(n - 1) + halfH(n - 1)} L${lastX},${endY - 17}`));
  }
  parts.push(terminal(lastX, endY, 'FIN'));
  if (phase.salida) {
    const lines = wrapText(phase.salida, 60, 1);
    parts.push(`<text x="${lastX - 64}" y="${endY}" fill="${MUTED}" font-size="11" font-style="italic" text-anchor="end" dominant-baseline="middle">${escapeXml(lines[0])}</text>`);
  }

  // Actividades y decisiones encima de las líneas.
  phase.actividades.forEach((a, i) => {
    const x = colX(i);
    const y = centerY(i);
    if (a.esDecision) {
      const hw = DIAMOND_W / 2;
      const hh = DIAMOND_H / 2;
      parts.push(`<polygon points="${x},${y - hh} ${x + hw},${y} ${x},${y + hh} ${x - hw},${y}" fill="#fff" stroke="${INK}" stroke-width="1.6"/>`);
      const question = /[?¿]/.test(a.actividad) ? a.actividad : `¿${a.actividad}?`;
      parts.push(textLines(wrapText(question, 21, 3), x, y + 2, 12.5, `fill="${INK}" font-size="10" font-weight="600"`));
    } else {
      parts.push(`<rect x="${x - BOX_W / 2}" y="${y - BOX_H / 2}" width="${BOX_W}" height="${BOX_H}" rx="9" fill="#fff" stroke="${INK}" stroke-width="1.6"/>`);
      parts.push(textLines(wrapText(a.actividad, 24, 4), x, y + 2, 13, `fill="${INK}" font-size="10.5" font-weight="600"`));
    }
    const bx = x - halfW(i) + (a.esDecision ? 34 : 4);
    const by = y - halfH(i) + (a.esDecision ? 12 : 2);
    parts.push(`<circle cx="${bx}" cy="${by}" r="15" fill="${ACCENT}" stroke="#3b3bb3" stroke-width="1.2"/>`);
    parts.push(`<text x="${bx}" y="${by}" fill="#fff" font-size="10.5" font-weight="700" text-anchor="middle" dominant-baseline="middle">${escapeXml(a.numero)}</text>`);
    // En los rombos el registro se omite (va en la tabla): debajo sale el "No".
    if (a.registro && !a.esDecision) {
      // Registro: hoja con borde ondulado bajo la actividad.
      const label = wrapText(a.registro, 24, 2);
      const w = 132;
      const h = label.length === 1 ? 24 : 36;
      const rx = x - w / 2 + 14;
      const ry = y + halfH(i) + 8;
      parts.push(`<path d="M${rx},${ry} h${w} v${h - 5} q${-w / 4},10 ${-w / 2},0 t${-w / 2},0 z" fill="#eef0ff" stroke="${ACCENT}" stroke-width="1"/>`);
      parts.push(textLines(label, rx + w / 2, ry + (h - 5) / 2, 11, `fill="#2f2f8f" font-size="9.5"`));
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${escapeXml(`Flujograma de la etapa ${phase.numero}. ${phase.nombre}`)}" ${FONT}>${parts.join('')}</svg>`;
}

// ── Ciclo de vida ────────────────────────────────────────────────────────────

const isMonitoring = (nombre: string) => /monitoreo|control/i.test(nombre) && !/^(inicio|cierre)/i.test(nombre);

/**
 * Ciclo de vida de la guía: las etapas en secuencia y, si hay una de monitoreo y control, una
 * franja que acompaña a las demás (como en la guía DEVIM).
 */
export function buildLifecycleSvg(phases: Array<{ numero: number; nombre: string; nombrePropio?: string }>): string | null {
  if (phases.length === 0) return null;
  const monitoring = phases.find(p => isMonitoring(p.nombre));
  const main = phases.filter(p => p !== monitoring);
  const boxW = 176;
  const gap = 38;
  const width = 40 + main.length * boxW + (main.length - 1) * gap;
  const height = monitoring ? 300 : 170;
  const markerId = 'flecha-ciclo';
  const parts: string[] = [`<defs>${arrowHead(markerId)}</defs>`];

  main.forEach((p, i) => {
    const x = 20 + i * (boxW + gap);
    parts.push(`<rect x="${x}" y="24" width="${boxW}" height="110" rx="12" fill="#eef0ff" stroke="${ACCENT}" stroke-width="1.6"/>`);
    parts.push(`<text x="${x + boxW / 2}" y="48" fill="${MUTED}" font-size="12" font-weight="600" text-anchor="middle">Etapa ${p.numero}</text>`);
    parts.push(textLines(wrapText(p.nombre, 18, 2), x + boxW / 2, 76, 17, `fill="${INK}" font-size="15" font-weight="700"`));
    if (p.nombrePropio) parts.push(textLines(wrapText(p.nombrePropio, 26, 2), x + boxW / 2, 112, 12, `fill="${MUTED}" font-size="10" font-style="italic"`));
    if (i < main.length - 1) {
      parts.push(`<path d="M${x + boxW + 4},79 L${x + boxW + gap - 4},79" stroke="${LINE}" stroke-width="2" marker-end="url(#${markerId})"/>`);
    }
  });

  if (monitoring) {
    const x = 20;
    const w = width - 40;
    parts.push(`<rect x="${x}" y="200" width="${w}" height="76" rx="12" fill="#fff7e6" stroke="#b7791f" stroke-width="1.6"/>`);
    parts.push(`<text x="${x + w / 2}" y="228" fill="#5f370e" font-size="15" font-weight="700" text-anchor="middle">Etapa ${monitoring.numero} · ${escapeXml(monitoring.nombre)}</text>`);
    parts.push(`<text x="${x + w / 2}" y="254" fill="#5f370e" font-size="11.5" text-anchor="middle">Acompaña a las demás etapas en cada corte de seguimiento</text>`);
    main.forEach((_, i) => {
      const cx = 20 + i * (boxW + gap) + boxW / 2;
      parts.push(`<path d="M${cx},140 L${cx},194" stroke="#b7791f" stroke-width="1.5" stroke-dasharray="4 4" marker-end="url(#${markerId})" marker-start="url(#${markerId})"/>`);
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Ciclo de vida de los proyectos" ${FONT}>${parts.join('')}</svg>`;
}

// ── Simbología ───────────────────────────────────────────────────────────────

/** Simbología de los flujogramas, dibujada con las mismas formas. */
export function buildLegendSvg(): string {
  const items: Array<{ shape: string; label: string; detail: string }> = [
    { shape: `<rect x="-40" y="-14" width="80" height="28" rx="14" fill="#fff" stroke="${INK}" stroke-width="1.5"/><text x="0" y="0" font-size="10" font-weight="700" fill="${INK}" text-anchor="middle" dominant-baseline="middle">INICIO</text>`, label: 'Inicio / Fin', detail: 'Comienzo y final de la etapa' },
    { shape: `<rect x="-40" y="-18" width="80" height="36" rx="7" fill="#fff" stroke="${INK}" stroke-width="1.5"/><circle cx="-38" cy="-16" r="10" fill="${ACCENT}"/><text x="-38" y="-16" font-size="8" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="middle">1.1</text>`, label: 'Actividad', detail: 'Trabajo del rol del carril; el número es el de la tabla' },
    { shape: `<polygon points="0,-22 40,0 0,22 -40,0" fill="#fff" stroke="${INK}" stroke-width="1.5"/>`, label: 'Decisión', detail: 'Punto de aprobación: Sí continúa, No regresa' },
    { shape: `<circle cx="0" cy="0" r="12" fill="${ACCENT}"/><text x="0" y="0" font-size="10" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="middle">1</text>`, label: 'Conector', detail: 'Une el "No" con la actividad a la que regresa' },
    { shape: `<path d="M-40,-12 h80 v20 q-20,10 -40,0 t-40,0 z" fill="#eef0ff" stroke="${ACCENT}"/>`, label: 'Registro', detail: 'Documento o formato que deja la actividad' },
    { shape: `<rect x="-40" y="-14" width="80" height="28" rx="3" fill="${ACCENT}"/><text x="0" y="0" font-size="8.5" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="middle">CARRIL</text>`, label: 'Carril', detail: 'Rol responsable de las actividades de la franja' },
  ];
  const colW = 310;
  const rowH = 64;
  const cols = 3;
  const rows = Math.ceil(items.length / cols);
  const parts = items.map((item, i) => {
    const x = 20 + (i % cols) * colW;
    const y = 16 + Math.floor(i / cols) * rowH;
    return `<g transform="translate(${x + 44},${y + rowH / 2})">${item.shape}</g>`
      + `<text x="${x + 100}" y="${y + rowH / 2 - 8}" font-size="12" font-weight="700" fill="${INK}">${item.label}</text>`
      + wrapText(item.detail, 32, 2)
        .map((line, li) => `<text x="${x + 100}" y="${y + rowH / 2 + 9 + li * 13}" font-size="10" fill="${MUTED}">${escapeXml(line)}</text>`)
        .join('');
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${20 + cols * colW} ${32 + rows * rowH}" width="100%" role="img" aria-label="Simbología de los flujogramas" ${FONT}>${parts.join('')}</svg>`;
}
