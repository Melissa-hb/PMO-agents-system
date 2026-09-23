import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { Loader2, Check, AlertTriangle, ArrowUpRight, RotateCcw, Square, Hourglass, Circle } from 'lucide-react';
import { Phase } from '../../context/AppContext';
import { useCancelAgent } from '../../hooks/useCancelAgent';
import { getPendingDependencies } from '../../lib/phaseDependencies';
import { PHASE_CATALOG, DEFAULT_PHASE_INFO } from './phaseCatalog';

interface PhaseCardProps {
  phase: Phase;
  /** Todas las fases del proyecto, para calcular las dependencias pendientes. */
  phases: Phase[];
  projectId: string;
  onRetry?: (phaseNumber: number) => void;
  index?: number;
}

type CardState = 'completado' | 'en_progreso' | 'disponible' | 'requiere' | 'error';

const CARD_STATE: Record<CardState, {
  label: string;
  badge: string;
  dot: React.ReactNode;
  iconWrap: string;
}> = {
  completado: {
    label: 'Completada',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    dot: <Check size={10} strokeWidth={2.5} />,
    iconWrap: 'bg-emerald-50 border-emerald-100 text-emerald-600',
  },
  en_progreso: {
    label: 'En progreso',
    badge: 'bg-sky-50 text-sky-700 border-sky-100',
    dot: <Loader2 size={10} strokeWidth={2.25} className="animate-spin" />,
    iconWrap: 'bg-sky-50 border-sky-100 text-sky-600',
  },
  disponible: {
    label: 'Disponible',
    badge: 'bg-[#5454e9]/[0.07] text-[#5454e9] border-[#5454e9]/15',
    dot: <Circle size={7} fill="currentColor" strokeWidth={0} />,
    iconWrap: 'bg-[#5454e9]/[0.07] border-[#5454e9]/15 text-[#5454e9]',
  },
  requiere: {
    label: 'Requiere fases previas',
    badge: 'bg-amber-50 text-amber-700 border-amber-100',
    dot: <Hourglass size={10} strokeWidth={2} />,
    iconWrap: 'bg-amber-50 border-amber-100 text-amber-600',
  },
  error: {
    label: 'Error',
    badge: 'bg-rose-50 text-rose-700 border-rose-100',
    dot: <AlertTriangle size={10} strokeWidth={2} />,
    iconWrap: 'bg-rose-50 border-rose-100 text-rose-600',
  },
};

const hasProgressData = (data: unknown) =>
  !!data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length > 0 && !(data as any)._error;

/**
 * Estado que muestra la tarjeta: los estados reales de la fase tienen prioridad; si la
 * fase no ha empezado y tiene dependencias sin completar se marca "Requiere fases previas".
 */
function getCardState(phase: Phase, pendingCount: number): CardState {
  if (phase.status === 'completado') return 'completado';
  if (phase.status === 'procesando') return 'en_progreso';
  if (phase.status === 'error') return 'error';
  if (pendingCount > 0) return 'requiere';
  if (hasProgressData(phase.agentData)) return 'en_progreso';
  return 'disponible';
}

// ── Sub-componente: botón cancelar inline ────────────────────────────────────
function CancelButton({ projectId, phaseNumber }: { projectId: string; phaseNumber: number }) {
  const { cancel, isCancelling } = useCancelAgent(projectId, phaseNumber);
  const [confirm, setConfirm] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // no navegar al hacer click en el botón
    if (!confirm) { setConfirm(true); return; }
    cancel();
    setConfirm(false);
  };

  const handleBlur = () => setTimeout(() => setConfirm(false), 200);

  return (
    <button
      onClick={handleClick}
      onBlur={handleBlur}
      disabled={isCancelling}
      title={confirm ? 'Click de nuevo para confirmar' : 'Detener agente'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border transition-all ${
        confirm
          ? 'bg-red-600 border-red-600 text-white'
          : 'bg-white border-amber-200 text-amber-700 hover:border-red-300 hover:text-red-600'
      }`}
      style={{ fontWeight: 500 }}
    >
      {isCancelling
        ? <Loader2 size={10} className="animate-spin" />
        : <Square size={8} fill="currentColor" strokeWidth={0} />
      }
      {isCancelling ? 'Cancelando…' : confirm ? '¿Confirmar?' : 'Detener'}
    </button>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function PhaseCard({ phase, phases, projectId, onRetry, index = 0 }: PhaseCardProps) {
  const navigate = useNavigate();
  const [showResetModal, setShowResetModal] = useState(false);

  const pending = getPendingDependencies(phases, phase.number);
  const state = getCardState(phase, pending.length);
  const meta = CARD_STATE[state];
  const { icon: Icon, description } = PHASE_CATALOG[phase.number] ?? DEFAULT_PHASE_INFO;

  const open = () => navigate(`/dashboard/project/${projectId}/phase/${phase.number}`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      role="link"
      tabIndex={0}
      aria-label={`Ingresar a la fase ${phase.number}: ${phase.name}. Estado: ${meta.label}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      className="group relative flex flex-col h-full bg-white rounded-2xl border border-neutral-200/70 p-5 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:border-neutral-300/80 hover:shadow-[0_12px_32px_-12px_rgba(84,84,233,0.22)] outline-none focus-visible:ring-2 focus-visible:ring-[#5454e9]/40"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
    >
      {/* Código + estado */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-400 tabular-nums" style={{ fontWeight: 500 }}>
          F{phase.number}
        </span>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] whitespace-nowrap ${meta.badge}`} style={{ fontWeight: 500 }}>
          {meta.dot}
          {meta.label}
        </span>
      </div>

      {/* Ícono */}
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 transition-colors ${meta.iconWrap}`}>
        <Icon size={18} strokeWidth={1.75} />
      </div>

      {/* Nombre + descripción */}
      <h3 className="text-neutral-900 tracking-tight mb-1.5" style={{ fontWeight: 500, fontSize: '0.9375rem', letterSpacing: '-0.005em' }}>
        {phase.name}
      </h3>
      <p className="text-[12px] text-neutral-500 leading-relaxed line-clamp-2">
        {description}
      </p>

      {pending.length > 0 && (
        <p className="text-[11px] text-amber-700 mt-2.5" style={{ fontWeight: 500 }}>
          Requiere: {pending.map(p => `F${p.number}`).join(', ')}
        </p>
      )}
      {state === 'completado' && phase.completedAt && (
        <p className="text-[11px] text-neutral-400 mt-2.5">Completada el {phase.completedAt}</p>
      )}

      {/* Acciones */}
      <div className="mt-auto pt-4 flex items-center justify-end gap-2" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
        {phase.status === 'procesando' && (
          <CancelButton projectId={projectId} phaseNumber={phase.number} />
        )}

        {phase.status === 'error' && onRetry && (
          <button
            onClick={() => setShowResetModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[11px] hover:bg-rose-100 transition-colors border border-rose-100"
            style={{ fontWeight: 500 }}
          >
            <RotateCcw size={10} strokeWidth={2} />
            Reintentar
          </button>
        )}

        {phase.status === 'completado' && onRetry && (
          <button
            onClick={() => setShowResetModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-50 text-neutral-600 text-[11px] hover:bg-neutral-100 hover:text-neutral-900 transition-colors border border-neutral-200/80"
            style={{ fontWeight: 500 }}
          >
            <RotateCcw size={10} strokeWidth={2} />
            Reprocesar
          </button>
        )}

        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={open}
          className="w-8 h-8 rounded-full border border-neutral-200/70 flex items-center justify-center text-neutral-400 group-hover:bg-[#5454e9] group-hover:border-[#5454e9] group-hover:text-white transition-all"
        >
          <ArrowUpRight size={13} strokeWidth={1.75} />
        </button>
      </div>

      {/* Modal de confirmación de Reprocesar */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 cursor-default" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetModal(false)}
              className="absolute inset-0 bg-neutral-900/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              role="dialog"
              aria-modal="true"
              className="relative bg-white rounded-2xl w-full max-w-md z-10 p-6 border border-neutral-200/70"
              style={{ boxShadow: '0 24px 64px -16px rgba(0,0,0,0.18)' }}
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                  <RotateCcw size={16} className="text-amber-600" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-neutral-900 mb-1.5 tracking-tight" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>
                    Confirmar reinicio de fase
                  </h3>
                  <p className="text-neutral-500 text-[13px] leading-relaxed">
                    ¿Estás seguro de que deseas reiniciar la <strong>Fase {phase.number}: {phase.name}</strong>? Se restablecerán los datos de esta fase y los de las fases que usan su resultado.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 py-2.5 border border-neutral-200/80 rounded-full text-neutral-700 text-[13px] hover:bg-neutral-50 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (onRetry) onRetry(phase.number);
                    setShowResetModal(false);
                  }}
                  className="flex-1 py-2.5 rounded-full text-white text-[13px] hover:-translate-y-px transition-all"
                  style={{ background: '#5454e9', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
                >
                  Sí, reiniciar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
