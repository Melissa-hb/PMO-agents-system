import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { Project } from '../../context/AppContext';
import ProjectActions from './ProjectActions';
import { getProjectSummary, formatProjectDate, ProgressBar, AuditorAvatars } from './projectDisplay';

interface ProjectCardProps {
  project: Project;
  index: number;
}

/** Tarjeta compacta del listado para celular (< 768px). Toda la tarjeta abre el proyecto. */
export default function ProjectCard({ project, index }: ProjectCardProps) {
  const navigate = useNavigate();
  const { completedCount, totalPhases, progress, currentPhase, meta } = getProjectSummary(project);
  const open = () => navigate(`/dashboard/project/${project.id}`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      role="link"
      tabIndex={0}
      aria-label={`Abrir proyecto ${project.companyName}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      className="bg-white rounded-2xl border border-neutral-200/70 cursor-pointer transition-colors active:bg-neutral-50 hover:border-neutral-300/80 outline-none focus-visible:ring-2 focus-visible:ring-[#5454e9]/40 pl-3.5 pr-1.5 py-3"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
    >
      {/* Fila 1: nombre + menu */}
      <div className="flex items-center gap-2 -my-1.5">
        <h3 className="flex-1 min-w-0 text-neutral-900 truncate tracking-tight text-[14px]" style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>
          {project.companyName}
        </h3>
        <ProjectActions project={project} />
      </div>

      <div className="pr-2">
        {/* Fila 2: descripcion */}
        <p className="text-neutral-500 text-[12px] truncate">{project.projectName}</p>

        {/* Fila 3: fase + estado */}
        {currentPhase && (
          <div className="flex items-center gap-1.5 mt-1.5 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dot}`} aria-hidden="true" />
            <span className="sr-only">{meta.label}.</span>
            <span className={`text-[12px] truncate ${meta.text}`} style={{ fontWeight: 500 }}>
              Fase {currentPhase.number} · {currentPhase.name}
            </span>
          </div>
        )}

        {/* Fila 4: progreso */}
        <div className="flex items-center gap-2.5 mt-2">
          <ProgressBar progress={progress} index={index} className="h-[3px]" />
          <span className="text-neutral-500 text-[11px] tabular-nums whitespace-nowrap">
            <span className="text-neutral-900" style={{ fontWeight: 500 }}>{Math.round(progress)}%</span> · {completedCount}/{totalPhases}
          </span>
        </div>

        {/* Fila 5: auditor + fecha */}
        <div className="flex items-center justify-between gap-2 mt-2">
          <AuditorAvatars auditors={project.auditors} max={3} size="w-5 h-5 text-[9px]" />
          <span className="text-neutral-400 text-[11px] tabular-nums">{formatProjectDate(project.startDate)}</span>
        </div>
      </div>
    </motion.div>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200/70 p-3.5 animate-pulse" aria-hidden="true">
      <div className="h-3.5 w-2/3 bg-neutral-100 rounded" />
      <div className="h-2.5 w-4/5 bg-neutral-100/70 rounded mt-2.5" />
      <div className="h-2.5 w-1/2 bg-neutral-100 rounded mt-2.5" />
      <div className="h-[3px] w-full bg-neutral-100 rounded-full mt-3" />
    </div>
  );
}
