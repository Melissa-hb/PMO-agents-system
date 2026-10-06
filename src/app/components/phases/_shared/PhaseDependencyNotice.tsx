import { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Info, ArrowRight, Hourglass, Play } from 'lucide-react';
import { useApp, Phase } from '../../../context/AppContext';
import { getPendingDependencies, pendingDependenciesLabel } from '../../../lib/phaseDependencies';
import { usePhaseConfig } from '../../../lib/phaseConfig';

/**
 * Estado de dependencias de una fase, calculado a partir de la configuración de fases
 * (tabla fases, cargada en lib/phaseConfig.ts) y el estado real de las fases del proyecto. Se recalcula
 * solo cuando cambian los estados, así que el aviso desaparece y la acción se
 * habilita en cuanto se completan las fases requeridas.
 */
export function usePhaseDependencies(projectId: string | undefined, phaseNumber: number) {
  const { getProject } = useApp();
  const project = projectId ? getProject(projectId) : undefined;
  const phaseConfig = usePhaseConfig();
  const pending: Phase[] = project ? getPendingDependencies(project.phases, phaseNumber, phaseConfig) : [];
  return {
    pending,
    // Mientras el proyecto o la configuracion de fases no han cargado no se conocen las
    // dependencias: se trata como bloqueada para que los agentes con auto-disparo (fases 4, 6
    // y 7) no arranquen antes de poder verificarlas.
    isBlocked: !project || !phaseConfig.loaded || pending.length > 0,
    blockedReason: pending.length > 0 ? pendingDependenciesLabel(pending, phaseConfig) : undefined,
  };
}

/**
 * Aviso de una linea arriba de la fase cuando faltan dependencias. Solo aparece si la fase
 * todavia no tiene resultados: si ya los tiene, el bloqueo solo afecta a reprocesar y eso lo
 * explica el tooltip del boton (BlockedActionHint).
 */
export function PhaseDependencyNotice({ projectId, phaseNumber }: { projectId: string; phaseNumber: number }) {
  const navigate = useNavigate();
  const { getProject } = useApp();
  const { pending } = usePhaseDependencies(projectId, phaseNumber);
  const phase = getProject(projectId)?.phases.find(p => p.number === phaseNumber);
  const hasResults = phase?.status === 'completado' || hasAgentResult(phase?.agentData);
  if (pending.length === 0 || hasResults) return null;

  return (
    <div className="max-w-[1100px] w-full mx-auto px-4 sm:px-10 pt-5 flex-shrink-0 print:hidden">
      <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-neutral-500">
        <Info size={14} strokeWidth={1.75} className="text-neutral-400 flex-shrink-0" aria-hidden="true" />
        <span>Esta fase usa los resultados de</span>
        {pending.map((p, i) => (
          <span key={p.number} className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate(`/dashboard/project/${projectId}/phase/${p.number}`)}
              className="inline-flex items-center gap-0.5 text-[13px] text-[#5454e9] hover:underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-[#5454e9]/40 rounded"
              title={p.status === 'procesando' ? 'En progreso' : 'Pendiente'}
            >
              F{p.number} {p.name}
              <ArrowRight size={11} strokeWidth={2} />
            </button>
            {i < pending.length - 1 && <span>{i === pending.length - 2 ? ' y' : ','}</span>}
          </span>
        ))}
        <span>— complétala{pending.length > 1 ? 's' : ''} para ejecutar el agente.</span>
      </p>
    </div>
  );
}

function hasAgentResult(agentData: unknown): boolean {
  if (!agentData || typeof agentData !== 'object') return false;
  const data = agentData as Record<string, unknown>;
  if (data._processing || data._error) return false;
  return Object.keys(data).some(k => !k.startsWith('_') || k === '_current');
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
        <p className="text-[12px] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>
          Requiere fases previas
        </p>
        <h2 className="text-neutral-900 tracking-tight mb-2" style={{ fontWeight: 500, fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
          {agentLabel} está en espera
        </h2>
        <p className="text-neutral-500 text-[13px] max-w-md leading-relaxed mb-6">
          El agente se ejecutará cuando las fases requeridas estén completas. Mientras tanto puedes revisar esta fase o avanzar en las fases pendientes desde el enlace de arriba.
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
