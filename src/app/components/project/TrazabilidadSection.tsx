import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Phase } from '../../context/AppContext';
import { citasPorFase, formatElemento, getTrazabilidad, resumenTrazabilidad, type Hallazgo, type MatrizTrazabilidad } from './trazabilidad';

const PREVIEW_ROWS = 8;

/**
 * Matriz de trazabilidad del proyecto: cada hallazgo de la Exploración (fases 1, 2, 3 y 5) con las
 * decisiones de las fases 4, 6 y 7 que se apoyan en él.
 */
export default function TrazabilidadSection({ projectId, phases }: { projectId: string; phases: Phase[] }) {
  const [matriz, setMatriz] = useState<MatrizTrazabilidad | null>(null);
  const [error, setError] = useState(false);
  const [soloSinUsar, setSoloSinUsar] = useState(false);
  const [verTodos, setVerTodos] = useState(false);

  // Se recalcula cuando cambia el estado de alguna fase (p. ej. al terminar la 6 o la 7).
  const phasesKey = phases.map(p => `${p.number}:${p.status}`).join(',');
  useEffect(() => {
    let active = true;
    setError(false);
    getTrazabilidad(projectId)
      .then(data => { if (active) setMatriz(data); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [projectId, phasesKey]);

  return (
    <section aria-labelledby="trazabilidad" className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 mb-4">
        <h2 id="trazabilidad" className="text-neutral-900" style={{ fontWeight: 500, fontSize: '1.0625rem' }}>
          Trazabilidad de hallazgos
        </h2>
        <span className="text-[12px] text-neutral-400">Hallazgo de la Exploración → decisión de diseño</span>
      </div>

      {error ? (
        <p className="text-[13px] text-neutral-500">No se pudo cargar la trazabilidad del proyecto.</p>
      ) : !matriz ? (
        <p className="text-[13px] text-neutral-400 inline-flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Cargando…</p>
      ) : matriz.hallazgos.length === 0 ? (
        <p className="text-[13px] text-neutral-500">
          Los hallazgos aparecen aquí cuando las fases 1, 2, 3 y 5 tienen resultado. Cada uno recibe un código (H1-01, H2-03…) que los agentes de las fases 4, 6 y 7 citan en sus decisiones.
        </p>
      ) : (
        <Matriz matriz={matriz} soloSinUsar={soloSinUsar} setSoloSinUsar={setSoloSinUsar} verTodos={verTodos} setVerTodos={setVerTodos} />
      )}
    </section>
  );
}

function Matriz({ matriz, soloSinUsar, setSoloSinUsar, verTodos, setVerTodos }: {
  matriz: MatrizTrazabilidad;
  soloSinUsar: boolean;
  setSoloSinUsar: (v: boolean) => void;
  verTodos: boolean;
  setVerTodos: (v: boolean) => void;
}) {
  const resumen = resumenTrazabilidad(matriz);
  const filas = soloSinUsar ? matriz.hallazgos.filter(h => h.citado_por.length === 0) : matriz.hallazgos;
  const visibles = verTodos ? filas : filas.slice(0, PREVIEW_ROWS);

  return (
    <div className="bg-white rounded-xl border border-neutral-200/70">
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100">
        <p className="text-[13px] text-neutral-600">
          <span className="text-neutral-900 tabular-nums" style={{ fontWeight: 500 }}>{resumen.citados}</span> de {resumen.hallazgos} hallazgos sustentan alguna decisión
          {' · '}
          <span className="text-neutral-900 tabular-nums" style={{ fontWeight: 500 }}>{resumen.decisionesConSustento}</span> de {resumen.decisiones} decisiones citan hallazgos
          {resumen.idsNoEncontrados > 0 && (
            <span className="text-amber-700"> · {resumen.idsNoEncontrados} citas a códigos que ya no existen (se reprocesó una fase de origen)</span>
          )}
        </p>
        <div className="inline-flex rounded-full border border-neutral-200/80 p-0.5 text-[12px]" role="group" aria-label="Filtrar hallazgos">
          {[{ v: false, label: 'Todos' }, { v: true, label: `Sin usar (${resumen.sinUsar})` }].map(opt => (
            <button
              key={opt.label}
              type="button"
              onClick={() => { setSoloSinUsar(opt.v); setVerTodos(false); }}
              aria-pressed={soloSinUsar === opt.v}
              className={`px-3 py-1 rounded-full text-[12px] transition-colors ${soloSinUsar === opt.v ? 'bg-[#5454e9] text-white' : 'text-neutral-600 hover:text-neutral-900'}`}
              style={{ fontWeight: 500 }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {resumen.decisiones === 0 && (
        <p className="px-5 py-3 text-[12.5px] text-neutral-500 border-b border-neutral-100">
          Aún no hay decisiones trazadas: se registran al ejecutar o reprocesar las fases 4, 6 y 7.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.08em] text-neutral-400">
              <th className="px-5 py-2.5 w-20" style={{ fontWeight: 500 }}>Código</th>
              <th className="px-3 py-2.5" style={{ fontWeight: 500 }}>Hallazgo</th>
              <th className="px-5 py-2.5 w-[42%]" style={{ fontWeight: 500 }}>Decisiones que lo usan</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(h => <Fila key={h.id} hallazgo={h} />)}
          </tbody>
        </table>
      </div>

      {filas.length > PREVIEW_ROWS && (
        <div className="px-5 py-3 border-t border-neutral-100">
          <button type="button" onClick={() => setVerTodos(!verTodos)} className="text-[13px] text-[#5454e9] hover:underline underline-offset-2">
            {verTodos ? 'Ver menos' : `Ver los ${filas.length} hallazgos`}
          </button>
        </div>
      )}
    </div>
  );
}

function Fila({ hallazgo }: { hallazgo: Hallazgo }) {
  const grupos = citasPorFase(hallazgo.citado_por);
  return (
    <tr className="border-t border-neutral-100 align-top">
      <td className="px-5 py-3 text-neutral-900 tabular-nums whitespace-nowrap" style={{ fontWeight: 500 }}>{hallazgo.id}</td>
      <td className="px-3 py-3">
        <p className="text-[11px] text-neutral-400 mb-0.5">Fase {hallazgo.fase} · {hallazgo.tipo}</p>
        <p className="text-neutral-700 leading-relaxed">{hallazgo.texto}</p>
      </td>
      <td className="px-5 py-3">
        {grupos.length === 0 ? (
          <span className="text-neutral-400">Sin usar</span>
        ) : (
          <ul className="space-y-1.5">
            {grupos.map(g => g.citas.map((c, i) => (
              <li key={`${g.fase}-${i}`} className="leading-relaxed">
                <span className="text-[11px] text-[#5454e9] mr-1.5" style={{ fontWeight: 600 }}>F{c.fase}</span>
                <span className="text-neutral-500">{formatElemento(c.elemento)}:</span>{' '}
                <span className="text-neutral-700">{c.decision}</span>
              </li>
            )))}
          </ul>
        )}
      </td>
    </tr>
  );
}
