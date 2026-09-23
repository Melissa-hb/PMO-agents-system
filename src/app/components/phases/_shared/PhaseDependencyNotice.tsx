import { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Info, ArrowRight, Hourglass, Play } from 'lucide-react';
import { useApp, Phase } from '../../../context/AppContext';
import { getPendingDependencies, pendingDependenciesLabel } from '../../../lib/phaseDependencies';

/**
 * Estado de dependencias de una fase, calculado a partir de la configuración en
 * lib/phaseDependencies.ts y el estado real de las fases del proyecto. Se recalcula
 * solo cuando cambian los estados, así que el aviso desaparece y la acción se
 * habilita en cuanto se completan las fases requeridas.
 */
export function usePhaseDependencies(projectId: string | undefined, phaseNumber: number) {
  const { getProject } = useApp();
  const project = projectId ? getProject(projectId) : undefined;
  const pending: Phase[] = project ? getPendingDependencies(project.phases, phaseNumber) : [];
  return {
    pending,
    // Mientras el proyecto no ha cargado no se conocen las dependencias: se trata como
    // bloqueada para que los agentes con auto-disparo (fases 4, 6 y 7) no arranquen antes
    // de poder verificarlas.
    isBlocked: !project || pending.length > 0,
    blockedReason: pending.length > 0 ? pendingDependenciesLabel(pending) : undefined,
  };
}

/** Aviso informativo (no de error) que se muestra arriba de la fase si faltan dependencias. */
export function PhaseDependencyNotice({ projectId, phaseNumber }: { projectId: string; phaseNumber: number }) {
  const navigate = useNavigate();
  const { pending } = usePhaseDependencies(projectId, phaseNumber);
  if (pending.length === 0) return null;

  return (
    <div className="max-w-[1100px] w-full mx-auto px-4 sm:px-10 pt-6 flex-shrink-0 print:hidden">
      <div
        role="status"
        className="flex items-start gap-3.5 rounded-2xl border border-[#5454e9]/20 bg-[#5454e9]/[0.05] px-5 py-4"
      >
        <div className="w-8 h-8 rounded-xl bg-white border border-[#5454e9]/20 flex items-center justify-center flex-shrink-0 text-[#5454e9]">
          <Info size={15} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-neutral-900 text-[13px]" style={{ fontWeight: 500 }}>
            Para ejecutar esta fase necesitas completar primero:
          </p>
          <ul className="mt-2 space-y-1.5">
            {pending.map(p => (
              <li key={p.number} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-neutral-700">
                <span className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-neutral-400" aria-hidden="true" />
                  <span style={{ fontWeight: 500 }}>F{p.number} – {p.name}</span>
                  <span className="text-neutral-400">({p.status === 'procesando' ? 'en progreso' : 'pendiente'})</span>
                </span>
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/project/${projectId}/phase/${p.number}`)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#5454e9]/25 text-[#5454e9] text-[12px] hover:bg-[#5454e9] hover:text-white hover:border-[#5454e9] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#5454e9]/40"
                  style={{ fontWeight: 500 }}
                >
                  Ir a F{p.number}
                  <ArrowRight size={11} strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-neutral-500 text-[12px] mt-2.5">
            Esta fase usa los resultados de esas etapas como insumo.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Envoltorio para la acción principal de una fase: cuando hay dependencias pendientes
 * muestra el motivo como tooltip (los botones deshabilitados no disparan eventos de
 * mouse, por eso el title va en el contenedor).
 */
export function BlockedActionHint({ reason, children, className = '' }: { reason?: string; children: ReactNode; className?: string }) {
  if (!reason) return <>{children}</>;
  return (
    <span title={reason} className={`inline-flex cursor-not-allowed ${className}`}>
      {children}
    </span>
  );
}

/**
 * Panel de espera para las fases cuyo agente se ejecuta automáticamente al entrar
 * (4, 6 y 7): mientras haya dependencias pendientes se muestra esto en vez de disparar
 * el agente.
 */
export function PhaseWaitingPanel({ agentLabel, reason }: { agentLabel: string; reason?: string }) {
  return (
    <div className="max-w-[1100px] w-full mx-auto px-4 sm:px-10 py-10">
      <div className="bg-white rounded-2xl border border-neutral-200/70 px-6 py-14 flex flex-col items-center text-center" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-5 text-amber-600">
          <Hourglass size={20} strokeWidth={1.75} />
        </div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>
          Requiere fases previas
        </p>
        <h2 className="text-neutral-900 tracking-tight mb-2" style={{ fontWeight: 500, fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
          {agentLabel} está en espera
        </h2>
        <p className="text-neutral-500 text-[13px] max-w-md leading-relaxed mb-6">
          El agente se ejecutará cuando las fases requeridas estén completas. Mientras tanto puedes revisar esta fase o avanzar en las pendientes desde el aviso de arriba.
        </p>
        <BlockedActionHint reason={reason}>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-white text-[13px] disabled:opacity-40 pointer-events-none"
            style={{ background: '#5454e9', fontWeight: 500 }}
          >
            <Play size={12} strokeWidth={2} fill="currentColor" />
            Ejecutar agente
          </button>
        </BlockedActionHint>
      </div>
    </div>
  );
}
