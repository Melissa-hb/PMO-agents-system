import { useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';
import type { Phase } from '../../context/AppContext';
import type { PhaseConfig } from '../../lib/phaseConfig';
import { buildExecutiveSummary, type ExecutiveFact, type NextStep } from './executiveSummary';

const ACCENT = '#5454e9';

/**
 * Portada ejecutiva del proyecto: tipo de PMO, nivel de madurez, enfoque de la guia,
 * avance y proximos pasos, como la primera pagina de un informe de consultoria.
 */
export default function ExecutiveOverview({ projectId, phases, config }: {
  projectId: string;
  phases: Phase[];
  config: PhaseConfig;
}) {
  const navigate = useNavigate();
  const summary = buildExecutiveSummary(phases, config);
  const pct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
  const goTo = (phaseNumber: number) => navigate(`/dashboard/project/${projectId}/phase/${phaseNumber}`);

  return (
    <>
      <section aria-labelledby="resumen-ejecutivo">
        <h2 id="resumen-ejecutivo" className="text-neutral-900 mb-4" style={{ fontWeight: 500, fontSize: '1.0625rem' }}>
          Resumen ejecutivo
        </h2>
        <div className="bg-white rounded-xl border border-neutral-200/70 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x divide-neutral-100">
          <Fact label="Tipo de PMO" fact={summary.pmoType} source="Fase 4" onOpen={() => goTo(4)} />
          <Fact label="Nivel de madurez" fact={summary.maturity} source="Fase 5" onOpen={() => goTo(5)} />
          <Fact label="Enfoque de la guía" fact={summary.approach} source="Fase 6" onOpen={() => goTo(6)} />
          <div className="px-6 py-5">
            <p className="text-[12.5px] text-neutral-500">Avance</p>
            <p className="text-neutral-900 mt-1.5" style={{ fontWeight: 500, fontSize: '1.125rem', letterSpacing: '-0.01em' }}>
              {summary.completed} de {summary.total} fases
            </p>
            <div className="mt-3 h-1 rounded-full bg-neutral-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ACCENT }} />
            </div>
            <p className="text-[12.5px] text-neutral-500 mt-2 tabular-nums">{pct}% completado</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="proximos-pasos" className="mt-12">
        <h2 id="proximos-pasos" className="text-neutral-900 mb-4" style={{ fontWeight: 500, fontSize: '1.0625rem' }}>
          Próximos pasos
        </h2>
        {summary.nextSteps.length === 0 ? (
          <p className="text-[14px] text-neutral-600">
            Todas las fases están completas. La guía metodológica (fase 7) y los artefactos (fase 8) están listos para entregar.
          </p>
        ) : (
          <ol className="space-y-2.5">
            {summary.nextSteps.map((step, i) => (
              <StepItem key={step.phaseNumber} step={step} index={i + 1} onOpen={() => goTo(step.phaseNumber)} />
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function Fact({ label, fact, source, onOpen }: { label: string; fact: ExecutiveFact | null; source: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="text-left px-6 py-5 hover:bg-neutral-50/70 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5454e9]/30">
      <p className="text-[12.5px] text-neutral-500">{label}</p>
      {fact ? (
        <>
          <p className="text-neutral-900 mt-1.5" style={{ fontWeight: 500, fontSize: '1.125rem', letterSpacing: '-0.01em' }}>
            {fact.value}
          </p>
          {fact.detail && <p className="text-[12.5px] text-neutral-500 mt-1.5">{fact.detail}</p>}
          {!fact.approved && <p className="text-[12px] text-neutral-400 mt-1">Preliminar: {source} sin aprobar</p>}
        </>
      ) : (
        <>
          <p className="text-neutral-400 mt-1.5" style={{ fontSize: '1.125rem' }}>Pendiente</p>
          <p className="text-[12.5px] text-neutral-400 mt-1.5">Se obtiene en la {source.toLowerCase()}</p>
        </>
      )}
    </button>
  );
}

function StepItem({ step, index, onOpen }: { step: NextStep; index: number; onOpen: () => void }) {
  const muted = step.kind === 'requiere';
  return (
    <li className="flex items-baseline gap-3 text-[14px]">
      <span className="text-neutral-400 tabular-nums w-4 flex-shrink-0">{index}.</span>
      <span className={muted ? 'text-neutral-500' : step.kind === 'error' ? 'text-rose-700' : 'text-neutral-800'}>{step.text}</span>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-1 text-[13px] text-[#5454e9] hover:underline underline-offset-2 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-[#5454e9]/40 rounded"
      >
        Abrir fase <ArrowRight size={12} strokeWidth={2} />
      </button>
    </li>
  );
}
