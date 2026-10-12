import type { ReactNode } from 'react';

export type PhaseReportTone = 'blue' | 'green' | 'amber' | 'orange' | 'purple' | 'red' | 'slate';

export const phaseReportToneStyles: Record<PhaseReportTone, { bg: string; text: string; border: string; soft: string; bar: string; icon: string }> = {
  blue: { bg: 'bg-[#5454e9]', text: 'text-[#3838b8]', border: 'border-[#5454e9]/20', soft: 'bg-[#5454e9]/[0.08]', bar: 'bg-[#5454e9]', icon: 'text-[#5454e9]' },
  green: { bg: 'bg-[#4cb979]', text: 'text-[#22794b]', border: 'border-[#4cb979]/25', soft: 'bg-[#4cb979]/10', bar: 'bg-[#4cb979]', icon: 'text-[#4cb979]' },
  amber: { bg: 'bg-[#e4eb60]', text: 'text-[#7a7f1e]', border: 'border-[#d7de43]/40', soft: 'bg-[#e4eb60]/25', bar: 'bg-[#d7de43]', icon: 'text-[#9aa11f]' },
  orange: { bg: 'bg-[#e9683b]', text: 'text-[#b74120]', border: 'border-[#e9683b]/25', soft: 'bg-[#e9683b]/10', bar: 'bg-[#e9683b]', icon: 'text-[#e9683b]' },
  purple: { bg: 'bg-[#865cf0]', text: 'text-[#5d3bbd]', border: 'border-[#865cf0]/25', soft: 'bg-[#865cf0]/10', bar: 'bg-[#865cf0]', icon: 'text-[#865cf0]' },
  red: { bg: 'bg-[#ef4444]', text: 'text-[#b91c1c]', border: 'border-[#ef4444]/25', soft: 'bg-[#ef4444]/10', bar: 'bg-[#ef4444]', icon: 'text-[#ef4444]' },
  slate: { bg: 'bg-neutral-900', text: 'text-neutral-800', border: 'border-neutral-200', soft: 'bg-neutral-50', bar: 'bg-neutral-900', icon: 'text-neutral-700' },
};

export const EMPTY_VALUE = 'N/A';

export function valueOrEmpty(value: unknown) {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  return String(value);
}

export function normalizeList(items?: unknown[]) {
  return Array.isArray(items) && items.length > 0 ? items.map(valueOrEmpty) : [EMPTY_VALUE];
}

function normalizeToken(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function levelTone(value: unknown): PhaseReportTone {
  const token = normalizeToken(value);
  if (token.includes('alto') || token.includes('alta') || token.includes('critico')) return 'green';
  if (token.includes('medio') || token.includes('media') || token.includes('parcial') || token.includes('semi')) return 'amber';
  if (token.includes('bajo') || token.includes('baja') || token.includes('informal')) return 'orange';
  if (token.includes('ausencia') || token.includes('faltante') || token.includes('no ')) return 'red';
  return 'blue';
}

export function PhaseReportSection({ title, eyebrow, icon, tone = 'blue', children }: { title: string; eyebrow?: string; icon: ReactNode; tone?: PhaseReportTone; children: ReactNode }) {
  // El tono ya no pinta la tarjeta (una sola tonalidad por pantalla); se conserva en la firma
  // porque las vistas lo siguen pasando.
  void tone;
  return (
    <section className="rounded-xl border border-neutral-200/80 bg-white">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-neutral-50 border border-neutral-200/80 text-neutral-500 flex items-center justify-center flex-shrink-0 [&_svg]:w-4 [&_svg]:h-4">
            {icon}
          </div>
          <div>
            {eyebrow && <p className="text-[12px] text-neutral-500 mb-0.5">{eyebrow}</p>}
            <h2 className="text-neutral-900 text-[17px]" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>{title}</h2>
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

export function PhaseReportList({ items, tone = 'blue', mapItem }: { items?: unknown[]; tone?: PhaseReportTone; mapItem?: (value: unknown) => string }) {
  void tone;
  return (
    <ul className="space-y-2.5">
      {normalizeList(items).map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-neutral-700 text-[13.5px] leading-relaxed">
          <span className="w-1 h-1 rounded-full mt-2.5 bg-neutral-400 flex-shrink-0" />
          <span>{mapItem ? mapItem(item) : item}</span>
        </li>
      ))}
    </ul>
  );
}

export function PhaseReportBadgeList({ items, tone = 'blue', mapItem }: { items?: unknown[]; tone?: PhaseReportTone; mapItem?: (value: unknown) => string }) {
  void tone;
  return (
    <div className="flex flex-wrap gap-1.5">
      {normalizeList(items).map((item, i) => (
        <span key={i} className="max-w-full px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 text-[12px]">
          {mapItem ? mapItem(item) : valueOrEmpty(item)}
        </span>
      ))}
    </div>
  );
}

export function PhaseReportMetric({ label, value, tone = 'blue', icon }: { label: string; value: unknown; tone?: PhaseReportTone; icon?: ReactNode }) {
  void tone;
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] text-neutral-500 leading-tight break-words min-w-0">{label}</p>
        {icon && <span className="text-neutral-400 flex-shrink-0">{icon}</span>}
      </div>
      <p className="mt-1.5 text-[22px] tabular-nums text-neutral-900" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>{valueOrEmpty(value)}</p>
    </div>
  );
}

export function PhaseReportKeyValueGrid({ rows, compact = false }: { rows: { label: string; value: unknown; tone?: PhaseReportTone }[]; compact?: boolean }) {
  return (
    <div className={`grid grid-cols-1 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'md:grid-cols-2'} gap-2.5`}>
      {rows.map((row) => {
        // El nivel (alto/medio/bajo) se indica con un punto de color, no pintando toda la tarjeta.
        const toneClass = phaseReportToneStyles[row.tone ?? levelTone(row.value)];
        return (
          <div key={row.label} className="rounded-lg bg-neutral-50 border border-neutral-100 px-3.5 py-3 min-w-0 overflow-hidden flex flex-col justify-center">
            <p className="text-[12px] text-neutral-500 mb-1">{row.label}</p>
            <p className="flex items-center gap-2 text-[13.5px] leading-snug break-words text-neutral-900" style={{ fontWeight: 500 }}>
              <span className={`w-1.5 h-1.5 rounded-full ${toneClass.bar} flex-shrink-0`} aria-hidden="true" />
              {valueOrEmpty(row.value)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function PhaseReportProgressBar({ label, value, max, tone = 'blue' }: { label: string; value: number; max: number; tone?: PhaseReportTone }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12.5px] text-neutral-600">{label}</span>
        <span className="text-[12.5px] tabular-nums text-neutral-500">{valueOrEmpty(value)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
        <div className={`h-full rounded-full ${phaseReportToneStyles[tone].bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function PhaseReportEvidenceCard({ title, subtitle, description, references, badge, tone, mapText, mapReference }: {
  title: unknown;
  subtitle?: unknown;
  description: unknown;
  references?: unknown[];
  badge?: unknown;
  tone: PhaseReportTone;
  mapText?: (value: unknown) => string;
  mapReference?: (value: unknown) => string;
}) {
  const toneClass = phaseReportToneStyles[tone];
  return (
    <article className="rounded-xl border border-neutral-200/80 bg-white">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-neutral-900 text-[14.5px] leading-snug" style={{ fontWeight: 500 }}>{valueOrEmpty(title)}</p>
            {subtitle && <p className="mt-1 text-[12px] text-neutral-500">{valueOrEmpty(subtitle).replace(/_/g, ' ')}</p>}
          </div>
          {badge && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-neutral-600 flex-shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${toneClass.bar}`} aria-hidden="true" />
              {valueOrEmpty(badge).replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <p className="mt-3 text-neutral-600 text-[13.5px] leading-relaxed">{mapText ? mapText(description) : valueOrEmpty(description)}</p>
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <p className="text-[12px] text-neutral-500 mb-2">Fuentes documentales</p>
          <PhaseReportBadgeList items={references} mapItem={mapReference} tone={tone} />
        </div>
      </div>
    </article>
  );
}

export function PhaseReportMiniList({ title, items, tone, mapItem }: { title: string; items?: unknown[]; tone: PhaseReportTone; mapItem?: (value: unknown) => string }) {
  const toneClass = phaseReportToneStyles[tone];
  return (
    <article className="rounded-xl border border-neutral-200/80 bg-white">
      <div className="p-4">
        <p className="flex items-center gap-2 text-[13px] text-neutral-900 mb-2.5" style={{ fontWeight: 500 }}>
          <span className={`w-1.5 h-1.5 rounded-full ${toneClass.bar} flex-shrink-0`} aria-hidden="true" />
          {title}
        </p>
        <PhaseReportList items={items} tone={tone} mapItem={mapItem} />
      </div>
    </article>
  );
}
