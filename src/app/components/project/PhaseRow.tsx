import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { Loader2, Check, AlertTriangle, ChevronRight, RotateCcw, Square, Circle } from 'lucide-react';
import { Phase } from '../../context/AppContext';
import { useCancelAgent } from '../../hooks/useCancelAgent';
import { getPendingDependencies } from '../../lib/phaseDependencies';
import { usePhaseConfig } from '../../lib/phaseConfig';
import { PHASE_CATALOG, DEFAULT_PHASE_INFO } from './phaseCatalog';

interface PhaseRowProps {
  phase: Phase;
  /** Todas las fases del proyecto, para calcular las dependencias pendientes. */
  phases: Phase[];
  projectId: string;
  onRetry?: (phaseNumber: number) => void;
  index?: number;
}

type CardState = 'completado' | 'en_progreso' | 'disponible' | 'requiere' | 'error';

const CARD_STATE: Record<CardState, { label: string; text: string; dot: React.ReactNode }> = {
  completado: { label: 'Completada', text: 'text-neutral-700', dot: <Check size={12} strokeWidth={2.25} className="text-[#5454e9]" /> },
  en_progreso: { label: 'En progreso', text: 'text-[#5454e9]', dot: <Loader2 size={12} strokeWidth={2} className="animate-spin" /> },
  disponible: { label: 'Disponible', text: 'text-neutral-700', dot: <Circle size={6} fill="currentColor" strokeWidth={0} className="text-neutral-400" /> },
  requiere: { label: 'Requiere fases previas', text: 'text-neutral-500', dot: <Circle size={6} strokeWidth={2} className="text-neutral-300" /> },
  error: { label: 'Error', text: 'text-rose-700', dot: <AlertTriangle size={12} strokeWidth={2} /> },
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
/** Fila de la tabla "Avance por fase" de la portada del proyecto. */
export default function PhaseRow({ phase, phases, projectId, onRetry, index = 0 }: PhaseRowProps) {
  const navigate = useNavigate();
  const [showResetModal, setShowResetModal] = useState(false);

  const phaseConfig = usePhaseConfig();
  const pending = getPendingDependencies(phases, phase.number, phaseConfig);
  const state = getCardState(phase, pending.length);
  const meta = CARD_STATE[state];
  const { description } = PHASE_CATALOG[phase.number] ?? DEFAULT_PHASE_INFO;

  const open = () => navigate(`/dashboard/project/${projectId}/phase/${phase.number}`);

  const statusDetail =
    state === 'completado' && phase.completedAt ? phase.completedAt
    : state === 'requiere' ? `Requiere ${pending.map(p => `F${p.number}`).join(', ')}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.02, duration: 0.25 }}
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
      className="group grid grid-cols-[32px_minmax(0,1fr)_auto] md:grid-cols-[32px_minmax(0,1fr)_190px_auto] items-center gap-x-4 px-5 py-4 cursor-pointer transition-colors hover:bg-neutral-50/80 outline-none focus-visible:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5454e9]/30"
    >
      <span className="text-[13px] tabular-nums text-neutral-400">{String(phase.number).padStart(2, '0')}</span>

      <div className="min-w-0">
        <p className="text-neutral-900 text-[14px] truncate" style={{ fontWeight: 500 }}>{phase.name}</p>
        <p className="text-[12.5px] text-neutral-500 truncate mt-0.5">{description}</p>
      </div>

      <div className={`hidden md:flex items-center gap-2 text-[13px] ${meta.text}`}>
        <span className="w-3.5 flex justify-center flex-shrink-0">{meta.dot}</span>
        <span className="truncate">
          {meta.label}
          {statusDetail && <span className="text-neutral-400"> · {statusDetail}</span>}
        </span>
      </div>

      <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
        {phase.status === 'procesando' && (
          <CancelButton projectId={projectId} phaseNumber={phase.number} />
        )}

        {phase.status === 'error' && onRetry && (
          <button
            onClick={() => setShowResetModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-rose-700 text-[12px] hover:bg-rose-50 transition-colors"
          >
            <RotateCcw size={11} strokeWidth={2} />
            Reintentar
          </button>
        )}

        {phase.status === 'completado' && onRetry && (
          <button
            onClick={() => setShowResetModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-neutral-500 text-[12px] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-neutral-100 hover:text-neutral-900 transition-all"
          >
            <RotateCcw size={11} strokeWidth={2} />
            Reprocesar
          </button>
        )}

        <ChevronRight size={16} strokeWidth={1.75} className="text-neutral-300 group-hover:text-neutral-600 transition-colors" aria-hidden="true" />
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
