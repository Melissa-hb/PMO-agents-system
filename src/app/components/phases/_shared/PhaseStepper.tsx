import { useNavigate } from 'react-router';
import { Check } from 'lucide-react';
import type { Phase } from '../../../context/AppContext';
import { shortPhaseName, usePhaseConfig } from '../../../lib/phaseConfig';

const ACCENT = '#5454e9';

/**
 * Indicador de progreso de las fases (1 → 8): completadas con check, la actual resaltada
 * y las pendientes en gris, unidas por una linea que se va llenando. Usa el nombre corto de
 * cada fase (Administracion > Fases y agentes) y muestra el completo como tooltip.
 */
export default function PhaseStepper({ projectId, phases, currentPhase }: {
  projectId: string;
  phases: Phase[];
  currentPhase: number;
}) {
  const navigate = useNavigate();
  const config = usePhaseConfig();

  return (
    <nav aria-label="Progreso de fases" className="border-t border-neutral-200/60 bg-white/60 backdrop-blur-sm select-none overflow-x-auto print:hidden">
      <ol className="max-w-[1100px] mx-auto px-6 pt-2.5 pb-2 flex items-start min-w-[640px]">
        {phases.map((p, i) => {
          const isCurrent = p.number === currentPhase;
          const isCompleted = p.status === 'completado';
          const isProcessing = p.status === 'procesando';
          const label = shortPhaseName(p.number, p.name, config);
          const status = isCompleted ? 'completada' : isCurrent ? 'actual' : isProcessing ? 'en proceso' : 'pendiente';

          return (
            <li key={p.number} className="flex-1 relative flex flex-col items-center min-w-0">
              {/* Linea hacia la fase anterior: llena si esa fase ya se completo. */}
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute top-[11px] right-1/2 w-full h-px"
                  style={{ background: phases[i - 1].status === 'completado' ? ACCENT : '#e5e5e5' }}
                />
              )}
              <button
                type="button"
                onClick={() => navigate(`/dashboard/project/${projectId}/phase/${p.number}`)}
                title={`${p.number}. ${p.name} · ${status}`}
                aria-current={isCurrent ? 'step' : undefined}
                className="group relative z-10 flex flex-col items-center gap-1 px-1 outline-none rounded-md focus-visible:ring-2 focus-visible:ring-[#5454e9]/40"
              >
                <span
                  className={`w-[23px] h-[23px] rounded-full flex items-center justify-center text-[11px] tabular-nums transition-colors ${
                    isCurrent
                      ? 'text-white ring-4 ring-[#5454e9]/15'
                      : isCompleted
                      ? 'text-white'
                      : 'bg-white border border-neutral-300 text-neutral-500 group-hover:border-neutral-400'
                  }`}
                  style={isCurrent || isCompleted ? { background: ACCENT, fontWeight: 500 } : undefined}
                >
                  {isCompleted && !isCurrent ? <Check size={12} strokeWidth={2.5} /> : p.number}
                </span>
                <span
                  className={`text-[11.5px] leading-tight truncate max-w-full ${
                    isCurrent ? 'text-neutral-900' : isCompleted ? 'text-neutral-600' : 'text-neutral-400 group-hover:text-neutral-600'
                  }`}
                  style={{ fontWeight: isCurrent ? 500 : 400 }}
                >
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
