import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, CheckCircle2, LayoutGrid, Loader2, MessageSquare, RotateCcw, Send } from 'lucide-react';

type GuideSidebarProps = {
  adjustText: string;
  isAdjusting: boolean;
  isCompleted: boolean;
  completedAt?: string;
  onAdjustTextChange: (value: string) => void;
  /** Secciones de la version visible que se pueden ajustar por separado. */
  sectionOptions: { id: string; title: string }[];
  selectedSections: string[];
  onToggleSection: (id: string) => void;
  onRequestAdjustments: () => void;
  onReprocess: () => void;
  onApprove: () => void;
  onGoPhase6: () => void;
  onGoPhase8: () => void;
  onGoProject: () => void;
};

export function GuideSidebar({
  adjustText,
  isAdjusting,
  isCompleted,
  completedAt,
  onAdjustTextChange,
  sectionOptions,
  selectedSections,
  onToggleSection,
  onRequestAdjustments,
  onReprocess,
  onApprove,
  onGoPhase6,
  onGoPhase8,
  onGoProject,
}: GuideSidebarProps) {
  return (
    <div className="min-h-0 flex flex-col bg-[#fbfbff] border-l border-[#5454e9]/15 overflow-hidden print:hidden">

      {/* RF-F7-04: Adjustment panel — fills remaining height */}
      <div className="flex-1 px-5 pt-5 pb-4 flex flex-col overflow-hidden min-h-0">
        {!isCompleted ? (
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-1.5 flex-shrink-0">
              <div className="w-8 h-8 rounded-xl bg-[#865cf0]/10 text-[#6a45d8] flex items-center justify-center">
                <MessageSquare size={14} strokeWidth={1.85} />
              </div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-700" style={{ fontWeight: 850 }}>
                Solicitar ajustes
              </p>
            </div>
            <p className="text-neutral-500 text-[12px] mb-3 leading-relaxed flex-shrink-0">
              Describa los cambios requeridos. El Agente 7 generará una versión revisada del documento.
            </p>
            {sectionOptions.length > 0 && (
              <div className="mb-3 flex-shrink-0">
                <p className="text-[11px] text-neutral-600 mb-1.5" style={{ fontWeight: 650 }}>
                  Capítulos a ajustar <span className="text-neutral-400" style={{ fontWeight: 400 }}>(opcional)</span>
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-[88px] overflow-y-auto pr-0.5" role="group" aria-label="Capítulos a ajustar">
                  {sectionOptions.map(section => {
                    const selected = selectedSections.includes(section.id);
                    return (
                      <button
                        key={section.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onToggleSection(section.id)}
                        disabled={isAdjusting}
                        className={`px-2.5 py-1 rounded-full border text-[11px] transition-colors disabled:opacity-50 ${
                          selected
                            ? 'bg-[#865cf0] border-[#865cf0] text-white'
                            : 'bg-white border-neutral-200 text-neutral-600 hover:border-[#865cf0]/40 hover:text-[#6a45d8]'
                        }`}
                        style={{ fontWeight: 600 }}
                      >
                        {section.title}
                      </button>
                    );
                  })}
                </div>
                <p className="text-neutral-400 text-[11px] mt-1.5 leading-relaxed">
                  {selectedSections.length > 0
                    ? `Solo se regenerarán ${selectedSections.length === 1 ? 'este capítulo' : `estos ${selectedSections.length} capítulos`}; el resto se conserva. Es más rápido y consume menos.`
                    : 'Sin selección se regenera la guía completa.'}
                </p>
              </div>
            )}
            <textarea
              value={adjustText}
              onChange={e => onAdjustTextChange(e.target.value)}
              placeholder="Ej: En el capítulo 3, amplía las ceremonias ágiles con ejemplos de la industria financiera…"
              className="flex-1 min-h-[96px] w-full px-3 py-2.5 border border-neutral-200/80 rounded-xl text-[13px] outline-none focus:border-[#865cf0]/45 focus:ring-4 focus:ring-[#865cf0]/10 transition-all resize-none leading-relaxed bg-white placeholder:text-neutral-400"
            />
            <p className="text-neutral-400 text-[11px] text-right mt-1 mb-2 flex-shrink-0 tabular-nums">{adjustText.length} caracteres</p>
            <div className="flex gap-2 flex-shrink-0">
              <motion.button
                whileHover={{ y: -1 }} whileTap={{ y: 0 }}
                onClick={onRequestAdjustments}
                disabled={isAdjusting || !adjustText.trim()}
                className="flex-1 py-2.5 rounded-xl border border-[#865cf0]/25 text-[#6a45d8] bg-[#865cf0]/[0.06] text-[12px] flex items-center justify-center gap-1.5 disabled:opacity-50 hover:bg-[#865cf0]/10 transition-all"
                style={{ fontWeight: 750 }}
              >
                {isAdjusting
                  ? <><Loader2 size={12} className="animate-spin" strokeWidth={1.75} />Enviando…</>
                  : <><Send size={12} strokeWidth={1.75} />{selectedSections.length > 0 ? `Ajustar ${selectedSections.length} capítulo${selectedSections.length === 1 ? '' : 's'}` : 'Solicitar ajuste'}</>}
              </motion.button>
              <motion.button
                whileHover={{ y: -1 }} whileTap={{ y: 0 }}
                onClick={onReprocess}
                disabled={isAdjusting || !adjustText.trim()}
                className="flex-1 py-2.5 rounded-xl border border-[#5454e9]/30 text-white bg-[#5454e9] text-[12px] flex items-center justify-center gap-1.5 disabled:opacity-50 hover:bg-[#4747cf] transition-all"
                style={{ fontWeight: 750, boxShadow: '0 12px 26px -18px rgba(84,84,233,0.75)' }}
              >
                <RotateCcw size={12} strokeWidth={1.75} />
                Reprocesar
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-200/70 bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                <CheckCircle2 size={13} strokeWidth={1.75} />
              </div>
              <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500" style={{ fontWeight: 500 }}>Fase completada</span>
            </div>
            <p className="text-neutral-700 text-[13px] leading-relaxed">
              La guía fue aprobada y enviada al Agente 8 para generar los artefactos de soporte.
            </p>
            {completedAt && (
              <p className="text-neutral-400 text-[11px] mt-3 tabular-nums">Aprobado el {completedAt}</p>
            )}
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <p className="text-neutral-400 text-[11px] mb-2 leading-relaxed">¿Necesitas generar una nueva versión? Escribe instrucciones y reprocesa.</p>
              <textarea
                value={adjustText}
                onChange={e => onAdjustTextChange(e.target.value)}
                placeholder="Ej: Ajusta el capítulo de implementación para un plazo de 90 días…"
                rows={3}
                className="w-full px-3 py-2.5 border border-neutral-200/80 rounded-xl text-[12px] outline-none focus:border-[#5454e9]/45 focus:ring-4 focus:ring-[#5454e9]/10 transition-all resize-none leading-relaxed bg-white placeholder:text-neutral-400 mb-2"
              />
              <motion.button
                whileHover={{ y: -1 }} whileTap={{ y: 0 }}
                onClick={onReprocess}
                disabled={isAdjusting || !adjustText.trim()}
                className="w-full py-2.5 rounded-xl border border-[#5454e9]/30 bg-[#5454e9] text-white text-[12px] flex items-center justify-center gap-1.5 disabled:opacity-50 hover:bg-[#4747cf] transition-all"
                style={{ fontWeight: 750 }}
              >
                <RotateCcw size={12} strokeWidth={1.75} />
                Reprocesar guía metodológica
              </motion.button>
            </div>
          </div>
        )}
      </div>

      {!isCompleted && (
        <div className="px-5 pb-5 pt-4 border-t border-[#5454e9]/10 bg-white flex-shrink-0">
          <p className="text-neutral-500 text-[11px] text-center mb-3 leading-relaxed">
            Al aprobar, la Fase 7 se completará y la Fase 8 se desbloqueará.
          </p>
          <motion.button
            whileHover={{ y: -1 }} whileTap={{ y: 0 }}
            onClick={onApprove}
            className="w-full py-3 rounded-full text-white text-[13px] flex items-center justify-center gap-2 transition-all"
            style={{ background: '#5454e9', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
          >
            Aprobar guía metodológica
          </motion.button>
        </div>
      )}

      {/* Navegación al completar: mismo estilo que NextPhaseButton en las demás fases */}
      {isCompleted && (
        <div className="px-5 pb-5 pt-4 border-t border-[#5454e9]/10 bg-white flex-shrink-0 space-y-2">
          <div className="flex gap-2">
            <motion.button
              whileHover={{ y: -1 }} whileTap={{ y: 0 }}
              onClick={onGoPhase6}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-neutral-700 text-[12px] bg-white border border-neutral-200/80 transition-all"
              style={{ fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px -4px rgba(0,0,0,0.08)' }}
            >
              <ArrowLeft size={12} strokeWidth={1.75} />
              Ver la Fase 6
            </motion.button>
            <motion.button
              whileHover={{ y: -1 }} whileTap={{ y: 0 }}
              onClick={onGoPhase8}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-white text-[12px] transition-all"
              style={{ background: '#5454e9', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
            >
              Ir a la Fase 8
              <ArrowRight size={12} strokeWidth={1.75} />
            </motion.button>
          </div>
          <button
            onClick={onGoProject}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-neutral-500 text-[12px] hover:text-[#5454e9] transition-colors"
            style={{ fontWeight: 500 }}
          >
            <LayoutGrid size={12} strokeWidth={1.75} />
            Ir al proyecto
          </button>
        </div>
      )}
    </div>
  );
}
