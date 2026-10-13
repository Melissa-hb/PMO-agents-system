import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Loader2, MessageSquare, RefreshCw, ThumbsUp } from 'lucide-react';

/**
 * Revisión del consultor al final de una fase (flujo del sistema de asistentes): aprobar el
 * entregable para avanzar, o devolverlo al agente con un comentario para reprocesarlo.
 * Ninguna fase avanza sin la aprobación explícita del consultor.
 */
interface ConsultantReviewPanelProps {
  phaseNumber: number;
  agentLabel: string;
  /** Fase que se habilita al aprobar (texto del modal). */
  nextPhaseLabel?: string;
  /** Comentario con el que se generó la versión actual (si fue reprocesada). */
  lastComment?: string | null;
  isReprocessing?: boolean;
  onReprocess: (comment: string) => void | Promise<void>;
  onApprove: () => void | Promise<void>;
}

export function ConsultantReviewPanel({
  phaseNumber,
  agentLabel,
  nextPhaseLabel,
  lastComment,
  isReprocessing,
  onReprocess,
  onApprove,
}: ConsultantReviewPanelProps) {
  const [comment, setComment] = useState('');
  const [showApprove, setShowApprove] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const handleReprocess = async () => {
    const text = comment.trim();
    if (!text) return;
    await onReprocess(text);
    setComment('');
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApprove();
      setShowApprove(false);
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <>
      <section className="rounded-[1.35rem] border border-neutral-200 bg-white overflow-hidden" style={{ boxShadow: '0 18px 44px -30px rgba(31,41,55,0.35)' }}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-neutral-50 text-neutral-700 border border-neutral-200 flex items-center justify-center">
              <MessageSquare size={18} />
            </div>
            <div>
              <p className="text-[12px] text-neutral-400 mb-1" style={{ fontWeight: 600 }}>Revisión consultor</p>
              <h2 className="text-neutral-950 text-[18px] tracking-tight" style={{ fontWeight: 600 }}>Comentarios y aprobación</h2>
            </div>
          </div>
          <p className="text-neutral-500 text-[13px] leading-relaxed mb-4">
            Revise el resultado de {agentLabel}. Si requiere ajustes, escriba sus observaciones y el agente lo reprocesará; si está
            correcto, apruébelo para continuar con el flujo.
          </p>
          {lastComment && (
            <div className="mb-3 px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200/70 text-[13px] text-neutral-600">
              <p className="text-neutral-400 text-xs mb-1" style={{ fontWeight: 600 }}>Último comentario aplicado</p>
              <p className="leading-relaxed">{lastComment}</p>
            </div>
          )}
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Agregue observaciones, contexto o ajustes al diagnóstico..."
            rows={4}
            disabled={isReprocessing}
            className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 transition-all resize-y leading-relaxed bg-white mb-3 disabled:opacity-60"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleReprocess}
              disabled={isReprocessing || !comment.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#5454e9]/25 bg-[#5454e9]/[0.08] text-[#3838b8] text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ fontWeight: 600 }}
            >
              {isReprocessing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Reprocesar con comentario
            </button>
            <div className="flex-1" />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowApprove(true)}
              disabled={isReprocessing}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm transition-all disabled:opacity-40"
              style={{ background: '#5454e9', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
            >
              <ThumbsUp size={14} />
              Aprobar diagnóstico
            </motion.button>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {showApprove && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowApprove(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6"
            >
              <div className="mb-5">
                <h3 className="text-neutral-900 mb-1.5" style={{ fontWeight: 500, fontSize: '1.0625rem', letterSpacing: '-0.01em' }}>¿Aprobar este diagnóstico?</h3>
                <p className="text-neutral-500 text-[13px] leading-relaxed">
                  La Fase {phaseNumber} quedará completada{nextPhaseLabel ? ` y se habilitará ${nextPhaseLabel}` : ''}. Si más adelante necesita cambiarla, deberá reprocesar la fase.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowApprove(false)}
                  className="flex-1 py-2.5 border border-neutral-200/80 rounded-full text-neutral-600 text-[13px] hover:bg-neutral-50 transition-colors"
                  style={{ fontWeight: 500 }}>
                  Cancelar
                </button>
                <button onClick={handleApprove} disabled={isApproving}
                  className="flex-1 py-2.5 rounded-full text-white text-[13px] flex items-center justify-center gap-2 disabled:opacity-70 transition-all"
                  style={{ background: '#5454e9', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}>
                  {isApproving
                    ? <><Loader2 size={13} className="animate-spin" /> Aprobando…</>
                    : 'Aprobar diagnóstico'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Aviso que reemplaza al panel de revisión cuando la fase ya fue aprobada. */
export function ApprovedPhaseNotice({ completedAt }: { completedAt?: string | null }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <CheckCircle2 size={15} className="text-[#5454e9]" />
      <p className="text-neutral-600 text-[13px]">
        Diagnóstico aprobado por el consultor{completedAt ? ` el ${completedAt}` : ''}.
      </p>
    </div>
  );
}
