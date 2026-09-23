import { motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Loader2, Circle } from 'lucide-react';
import { Project, PhaseStatus, Auditor } from '../../context/AppContext';

/**
 * Piezas visuales compartidas del listado de proyectos (tabla de escritorio y tarjeta
 * compacta de celular). Mismos estilos que tenia la tarjeta original.
 */

export const STATUS_META: Record<PhaseStatus, { label: string; dot: string; text: string; icon: React.ReactNode }> = {
  bloqueado: { label: 'No iniciada', dot: 'bg-neutral-300', text: 'text-neutral-500', icon: <Circle size={9} className="text-neutral-300" fill="currentColor" /> },
  disponible: { label: 'Disponible', dot: 'bg-neutral-900', text: 'text-neutral-800', icon: <Circle size={9} className="text-neutral-900" fill="currentColor" /> },
  procesando: { label: 'En proceso', dot: 'bg-amber-500', text: 'text-amber-700', icon: <Loader2 size={10} className="animate-spin text-amber-600" /> },
  completado: { label: 'Completada', dot: 'bg-emerald-500', text: 'text-emerald-700', icon: <CheckCircle2 size={10} className="text-emerald-600" /> },
  error: { label: 'Error', dot: 'bg-rose-500', text: 'text-rose-700', icon: <AlertCircle size={10} className="text-rose-600" /> },
};

export function getProjectSummary(project: Project) {
  const completedCount = project.phases.filter(p => p.status === 'completado').length;
  const totalPhases = project.phases.length;
  const progress = totalPhases ? (completedCount / totalPhases) * 100 : 0;

  const currentPhase =
    project.phases.find(p => p.status === 'procesando' || p.status === 'disponible' || p.status === 'error') ||
    project.phases[project.phases.length - 1];

  const meta = STATUS_META[currentPhase?.status || 'bloqueado'] || STATUS_META.bloqueado;

  return { completedCount, totalPhases, progress, currentPhase, meta };
}

// Append T12:00:00 to prevent timezone offset shift when formatting YYYY-MM-DD
export function formatProjectDate(startDate: string) {
  return new Date(startDate + 'T12:00:00').toLocaleDateString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function StatusBadge({ meta }: { meta: (typeof STATUS_META)[PhaseStatus] }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dot}`} />
      <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-400 whitespace-nowrap" style={{ fontWeight: 500 }}>
        {meta.label}
      </span>
    </span>
  );
}

export function PhaseNumber({ number }: { number: number }) {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 flex-shrink-0 rounded-md bg-neutral-50 border border-neutral-200/80 text-[10px] text-neutral-600 tabular-nums" style={{ fontWeight: 500 }}>
      {number}
    </span>
  );
}

export function ProgressBar({ progress, index = 0, className = 'h-1' }: { progress: number; index?: number; className?: string }) {
  return (
    <div
      className={`w-full bg-neutral-100 rounded-full overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.9, delay: index * 0.05 + 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="h-full rounded-full"
        style={{ background: progress === 100 ? '#10b981' : '#5454e9' }}
      />
    </div>
  );
}

export function AuditorAvatars({ auditors, max = 4, size = 'w-6 h-6 text-[10px]' }: { auditors: Auditor[]; max?: number; size?: string }) {
  return (
    <div className="flex -space-x-1.5">
      {auditors.slice(0, max).map(a => (
        <div
          key={a.id}
          title={a.name}
          className={`${size} rounded-full flex items-center justify-center text-white ring-2 ring-white flex-shrink-0`}
          style={{ background: a.color, fontWeight: 600 }}
        >
          {a.initials}
        </div>
      ))}
      {auditors.length > max && (
        <div className={`${size} rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 ring-2 ring-white`} style={{ fontWeight: 600 }}>
          +{auditors.length - max}
        </div>
      )}
    </div>
  );
}

export function auditorCountLabel(count: number) {
  return `${count} auditor${count !== 1 ? 'es' : ''}`;
}
