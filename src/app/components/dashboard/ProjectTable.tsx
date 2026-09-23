import { useNavigate } from 'react-router';
import { ArrowUpRight, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Project } from '../../context/AppContext';
import ProjectActions from './ProjectActions';
import {
  getProjectSummary,
  formatProjectDate,
  StatusBadge,
  PhaseNumber,
  ProgressBar,
  AuditorAvatars,
  auditorCountLabel,
} from './projectDisplay';

export type SortKey = 'proyecto' | 'progreso' | 'fecha';
export type SortDir = 'asc' | 'desc';

interface ProjectTableProps {
  projects: Project[];
  sortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}

const TH = 'px-4 py-3 text-left text-[11px] uppercase tracking-[0.14em] text-neutral-400 whitespace-nowrap';
// Auditores y Fecha solo en escritorio (>= 1024px); en tablet se ocultan.
const DESKTOP_ONLY = 'hidden lg:table-cell';

function SortHeader({ label, column, sortKey, sortDir, onSort, className = '' }: {
  label: string;
  column: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === column;
  const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`${TH} ${className}`}
      style={{ fontWeight: 500 }}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] rounded-md -mx-1 px-1 outline-none focus-visible:ring-2 focus-visible:ring-[#5454e9]/40 transition-colors ${
          active ? 'text-neutral-700' : 'hover:text-neutral-600'
        }`}
        style={{ fontWeight: 500 }}
      >
        {label}
        <Icon size={11} strokeWidth={2} className={active ? 'text-[#5454e9]' : 'text-neutral-300'} />
      </button>
    </th>
  );
}

export default function ProjectTable({ projects, sortKey, sortDir, onSort }: ProjectTableProps) {
  const navigate = useNavigate();
  const open = (id: string) => navigate(`/dashboard/project/${id}`);

  return (
    <div className="relative bg-white rounded-2xl border border-neutral-200/70 overflow-x-auto" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-neutral-100 bg-neutral-50/40">
            <SortHeader label="Proyecto" column="proyecto" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="pl-5" />
            <th scope="col" className={TH} style={{ fontWeight: 500 }}>Estado</th>
            <th scope="col" className={TH} style={{ fontWeight: 500 }}>Fase actual</th>
            <SortHeader label="Progreso" column="progreso" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th scope="col" className={`${TH} ${DESKTOP_ONLY}`} style={{ fontWeight: 500 }}>Auditores</th>
            <SortHeader label="Fecha" column="fecha" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={DESKTOP_ONLY} />
            <th scope="col" className={`${TH} pr-5 text-right`} style={{ fontWeight: 500 }}>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project, i) => {
            const { completedCount, totalPhases, progress, currentPhase, meta } = getProjectSummary(project);
            return (
              <tr
                key={project.id}
                tabIndex={0}
                aria-label={`Abrir proyecto ${project.companyName}`}
                onClick={() => open(project.id)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open(project.id);
                  }
                }}
                className="group h-[68px] border-b border-neutral-100 last:border-b-0 cursor-pointer transition-colors hover:bg-[#5454e9]/[0.03] focus-visible:bg-[#5454e9]/[0.04] outline-none focus-visible:shadow-[inset_3px_0_0_#5454e9]"
              >
                {/* Proyecto */}
                <td className="pl-5 pr-4 py-2.5 max-w-[180px] lg:max-w-[320px]">
                  <p className="text-neutral-900 truncate tracking-tight text-[14px]" style={{ fontWeight: 600, letterSpacing: '-0.01em' }} title={project.companyName}>
                    {project.companyName}
                  </p>
                  <p className="text-neutral-500 text-[12px] truncate mt-0.5" title={project.projectName}>
                    {project.projectName}
                  </p>
                </td>

                {/* Estado */}
                <td className="px-4 py-2.5">
                  <StatusBadge meta={meta} />
                </td>

                {/* Fase actual */}
                <td className="px-4 py-2.5 max-w-[170px] lg:max-w-[240px]">
                  {currentPhase && (
                    <div className="flex items-center gap-2 min-w-0">
                      <PhaseNumber number={currentPhase.number} />
                      <span className={`text-[13px] truncate ${meta.text}`} style={{ fontWeight: 500 }} title={currentPhase.name}>
                        {currentPhase.name}
                      </span>
                      <span className="flex-shrink-0 hidden lg:inline-flex">{meta.icon}</span>
                    </div>
                  )}
                </td>

                {/* Progreso */}
                <td className="px-4 py-2.5 w-[150px] lg:w-[200px]">
                  <div className="flex items-center gap-3">
                    <ProgressBar progress={progress} index={i} className="h-1 min-w-[40px]" />
                    <span className="flex items-baseline gap-1 whitespace-nowrap">
                      <span className="text-neutral-900 text-[13px] tabular-nums" style={{ fontWeight: 500 }}>{Math.round(progress)}%</span>
                      <span className="text-neutral-400 text-[11px] tabular-nums">{completedCount}/{totalPhases} fases</span>
                    </span>
                  </div>
                </td>

                {/* Auditores */}
                <td className={`px-4 py-2.5 ${DESKTOP_ONLY}`}>
                  <div className="flex items-center gap-2.5">
                    <AuditorAvatars auditors={project.auditors} max={3} />
                    <span className="text-neutral-400 text-[11px] whitespace-nowrap">{auditorCountLabel(project.auditors.length)}</span>
                  </div>
                </td>

                {/* Fecha */}
                <td className={`px-4 py-2.5 text-neutral-500 text-[12px] tabular-nums whitespace-nowrap ${DESKTOP_ONLY}`}>
                  {formatProjectDate(project.startDate)}
                </td>

                {/* Acciones */}
                <td className="pl-2 pr-5 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <ProjectActions project={project} />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-hidden="true"
                      onClick={(e) => { e.stopPropagation(); open(project.id); }}
                      className="w-9 h-9 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-400 group-hover:bg-[#5454e9] group-hover:border-[#5454e9] group-hover:text-white transition-all duration-300"
                    >
                      <ArrowUpRight size={15} strokeWidth={1.75} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200/70 overflow-hidden" aria-hidden="true">
      <div className="h-[41px] border-b border-neutral-100 bg-neutral-50/40" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-[68px] flex items-center gap-6 px-5 border-b border-neutral-100 last:border-b-0 animate-pulse">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-3 w-40 max-w-full bg-neutral-100 rounded" />
            <div className="h-2.5 w-56 max-w-full bg-neutral-100/70 rounded" />
          </div>
          <div className="h-2.5 w-20 bg-neutral-100 rounded" />
          <div className="h-2.5 w-36 bg-neutral-100 rounded" />
          <div className="h-1 w-32 bg-neutral-100 rounded-full" />
          <div className="hidden lg:block h-6 w-6 bg-neutral-100 rounded-full" />
          <div className="hidden lg:block h-2.5 w-24 bg-neutral-100 rounded" />
          <div className="h-9 w-9 bg-neutral-100 rounded-full" />
        </div>
      ))}
    </div>
  );
}
