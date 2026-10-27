import { useEffect, useState } from 'react';
import { Check, Minus, Loader2 } from 'lucide-react';
import type { Phase } from '../../context/AppContext';
import {
  coberturaValueRing, ETAPAS, getAlineacion, rangoFases,
  type Alineacion, type CriterioPmi, type ElementoCobertura, type EstadoPaso,
} from './alineacion';

const ESTADO: Record<EstadoPaso, { label: string; className: string }> = {
  cubierto: { label: 'Cubierto', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  en_curso: { label: 'En curso', className: 'bg-sky-50 text-sky-700 border-sky-100' },
  pendiente: { label: 'Pendiente', className: 'bg-neutral-50 text-neutral-500 border-neutral-200/80' },
  fuera: { label: 'Fuera de la plataforma', className: 'bg-amber-50 text-amber-700 border-amber-100' },
};

/**
 * Alineación metodológica del proyecto: qué etapas y pasos del PMO Value Ring cubre la plataforma,
 * sus componentes estructurales y línea base, y la verificación de la guía contra el PMBOK 8.
 */
export default function AlineacionSection({ projectId, phases }: { projectId: string; phases: Phase[] }) {
  const [alineacion, setAlineacion] = useState<Alineacion | null>(null);
  const [error, setError] = useState(false);
  const pasos = coberturaValueRing(phases);

  const phasesKey = phases.map(p => `${p.number}:${p.status}`).join(',');
  useEffect(() => {
    let active = true;
    setError(false);
    getAlineacion(projectId)
      .then(data => { if (active) setAlineacion(data); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [projectId, phasesKey]);

  return (
    <section aria-labelledby="alineacion" className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 mb-4">
        <h2 id="alineacion" className="text-neutral-900" style={{ fontWeight: 500, fontSize: '1.0625rem' }}>
          Alineación metodológica
        </h2>
        <span className="text-[12px] text-neutral-400">PMO Value Ring y PMBOK® 8</span>
      </div>

      {/* Ciclo de experiencia del cliente: 5 etapas, 10 pasos */}
      <div className="bg-white rounded-xl border border-neutral-200/70 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 lg:divide-x divide-neutral-100">
        {ETAPAS.map(etapa => (
          <div key={etapa} className="px-5 py-4">
            <p className="text-[12.5px] text-neutral-500 mb-3">{etapa}</p>
            <ul className="space-y-3">
              {pasos.filter(p => p.etapa === etapa).map(p => (
                <li key={p.paso}>
                  <p className="text-[13px] text-neutral-800 leading-snug">
                    <span className="text-neutral-400 tabular-nums">{p.paso}.</span> {p.nombre}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] ${ESTADO[p.estado].className}`} style={{ fontWeight: 500 }}>
                      {ESTADO[p.estado].label}
                    </span>
                    {p.fases.length > 0 && <span className="text-[11px] text-neutral-400">{rangoFases(p.fases)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {error ? (
        <p className="text-[13px] text-neutral-500 mt-4">No se pudo cargar la verificación metodológica del proyecto.</p>
      ) : !alineacion ? (
        <p className="text-[13px] text-neutral-400 inline-flex items-center gap-2 mt-4"><Loader2 size={13} className="animate-spin" /> Cargando…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Lista titulo="Componentes estructurales" items={alineacion.componentes} />
            <Lista titulo="Línea base organizativa" items={alineacion.linea_base} />
          </div>
          <VerificacionPmi pmi={alineacion.pmi} />
        </>
      )}
    </section>
  );
}

function Marca({ ok }: { ok: boolean }) {
  return ok
    ? <Check size={13} strokeWidth={2.25} className="text-emerald-600 flex-shrink-0" aria-label="Cubierto" />
    : <Minus size={13} strokeWidth={2.25} className="text-neutral-300 flex-shrink-0" aria-label="Sin cubrir" />;
}

function Lista({ titulo, items }: { titulo: string; items: ElementoCobertura[] }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200/70 px-5 py-4">
      <p className="text-[12.5px] text-neutral-500 mb-3">{titulo}</p>
      <ul className="space-y-2.5">
        {items.map(item => (
          <li key={item.clave} className="flex items-start gap-2.5">
            <span className="mt-0.5"><Marca ok={item.cubierto} /></span>
            <div>
              <p className="text-[13px] text-neutral-800" style={{ fontWeight: 500 }}>{item.nombre}</p>
              <p className="text-[12px] text-neutral-500 leading-relaxed">{item.evidencia}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VerificacionPmi({ pmi }: { pmi: Alineacion['pmi'] }) {
  const conIndicador = pmi.dominios.filter(d => d.con_indicador).length;
  const enFlujos = pmi.areas_enfoque.filter(a => a.en_flujos).length;
  return (
    <div className="bg-white rounded-xl border border-neutral-200/70 mt-4">
      <div className="px-5 py-4 border-b border-neutral-100 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] text-neutral-600">
          Verificación de la guía contra el {pmi.referencia}
          {pmi.guia_generada && (
            <>
              {': '}
              <span className="text-neutral-900 tabular-nums" style={{ fontWeight: 500 }}>{conIndicador} de {pmi.dominios.length}</span> dominios con indicador
              {' · '}
              <span className="text-neutral-900 tabular-nums" style={{ fontWeight: 500 }}>{enFlujos} de {pmi.areas_enfoque.length}</span> áreas de enfoque en los flujos
            </>
          )}
        </p>
        {pmi.marco_principal && (
          <span className="text-[12px] text-neutral-400">
            Marco de la guía: {pmi.marco_principal}{pmi.marco_secundario ? ` + ${pmi.marco_secundario}` : ''}
          </span>
        )}
      </div>
      {!pmi.guia_generada ? (
        <p className="px-5 py-4 text-[13px] text-neutral-500">La verificación se hace sobre la guía metodológica: aparece cuando la fase 7 tiene resultado.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x divide-neutral-100">
            <TablaCriterios titulo="Dominios de desempeño" extra="Indicador en la guía" criterios={pmi.dominios} extraKey="con_indicador" evidenceKey="indicadores" />
            <TablaCriterios titulo="Áreas de enfoque" extra="Fase de los flujos" criterios={pmi.areas_enfoque} extraKey="en_flujos" evidenceKey="fases_flujo" />
          </div>
          <p className="px-5 py-3 border-t border-neutral-100 text-[12px] text-neutral-400 leading-relaxed">
            Verificación automática: "Mencionado en" indica en qué secciones aparece cada criterio; la última columna exige un indicador propio (sección 11) o una fase de los flujos (sección 10). El consultor confirma si el tratamiento es suficiente.
          </p>
        </>
      )}
    </div>
  );
}

function TablaCriterios({ titulo, extra, criterios, extraKey, evidenceKey }: {
  titulo: string;
  extra: string;
  criterios: CriterioPmi[];
  extraKey: 'con_indicador' | 'en_flujos';
  evidenceKey: 'indicadores' | 'fases_flujo';
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-[0.08em] text-neutral-400">
            <th className="px-5 py-2.5" style={{ fontWeight: 500 }}>{titulo}</th>
            <th className="px-3 py-2.5" style={{ fontWeight: 500 }}>Mencionado en</th>
            <th className="px-5 py-2.5" style={{ fontWeight: 500 }}>{extra}</th>
          </tr>
        </thead>
        <tbody>
          {criterios.map(c => (
            <tr key={c.nombre} className="border-t border-neutral-100">
              <td className="px-5 py-2.5">
                <span className="inline-flex items-center gap-2 text-neutral-800"><Marca ok={c.cubierto} /> {c.nombre}</span>
              </td>
              <td className="px-3 py-2.5 text-neutral-500 tabular-nums">{c.secciones.length ? c.secciones.join(', ') : '—'}</td>
              <td className="px-5 py-2.5">
                <span className="inline-flex items-start gap-2">
                  <span className="mt-0.5"><Marca ok={!!c[extraKey]} /></span>
                  <span className="text-neutral-600">{c[evidenceKey]?.length ? c[evidenceKey]!.join(', ') : <span className="text-neutral-400">Sin {extraKey === 'con_indicador' ? 'indicador' : 'fase'}</span>}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
