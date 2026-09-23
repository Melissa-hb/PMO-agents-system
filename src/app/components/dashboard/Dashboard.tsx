import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, ChevronDown, ChevronLeft, ChevronRight, FolderOpen, CheckSquare, SlidersHorizontal, User, Layers, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import ProjectCard, { ProjectCardSkeleton } from './ProjectCard';
import ProjectTable, { ProjectTableSkeleton, SortKey, SortDir } from './ProjectTable';
import { getProjectSummary } from './projectDisplay';
import NewProjectModal from './NewProjectModal';
import IcesiLogo from '../brand/IcesiLogo';

type Tab = 'en_ejecucion' | 'completado';

const PAGE_SIZE = 10;

// ── Custom filter dropdown ─────────────────────────────────────────────────────
interface FilterOption { value: string; label: string }
interface FilterDropdownProps {
  value: string;
  onChange: (v: string) => void;
  options: FilterOption[];
  placeholder: string;
  icon: React.ReactNode;
  className?: string;
}

function FilterDropdown({ value, onChange, options, placeholder, icon, className = '' }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);
  const isActive = !!value;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full md:w-auto flex items-center gap-2 pl-3.5 pr-3 py-2.5 rounded-full text-[13px] border transition-all cursor-pointer ${
          isActive
            ? 'bg-neutral-900 text-white border-neutral-900'
            : 'bg-white text-neutral-700 border-neutral-200/80 hover:border-neutral-300'
        }`}
        style={{ fontWeight: isActive ? 500 : 400 }}
      >
        <span className={isActive ? 'text-white/70' : 'text-neutral-400'}>{icon}</span>
        <span className="flex-1 text-left truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          size={13}
          strokeWidth={2}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''} ${isActive ? 'text-white/60' : 'text-neutral-400'}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 mt-2 min-w-[180px] bg-white rounded-2xl border border-neutral-200/70 z-50 overflow-hidden"
            style={{ boxShadow: '0 4px 6px -2px rgba(0,0,0,0.04), 0 16px 40px -8px rgba(0,0,0,0.10)' }}
          >
            {/* All / reset */}
            <div className="px-2 pt-2 pb-1">
              <button
                onClick={() => { onChange(''); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-[13px] transition-colors ${
                  !value ? 'bg-neutral-50 text-neutral-900' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                }`}
                style={{ fontWeight: !value ? 500 : 400 }}
              >
                <span>Todos</span>
                {!value && <Check size={13} strokeWidth={2.25} className="text-neutral-900" />}
              </button>
            </div>

            {/* Divider capillary */}
            <div className="h-px bg-neutral-100 mx-2" />

            <div className="px-2 pt-1 pb-2">
              {options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-[13px] transition-colors ${
                    value === opt.value ? 'bg-neutral-50 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                  style={{ fontWeight: value === opt.value ? 500 : 400 }}
                >
                  <span>{opt.label}</span>
                  {value === opt.value && <Check size={13} strokeWidth={2.25} className="text-neutral-900" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { projects, currentUser, addProject, isLoading } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('en_ejecucion');
  const [search, setSearch] = useState('');
  const [filterAuditor, setFilterAuditor] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);

  // TODO: fetch('public.proyectos').select('*, profiles(*)')
  // TODO: Implementar búsqueda local (client-side filtering)
  // RF-HOME-05: Validar que el usuario actual esté en la lista de asignados o sea Admin

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchDeleted = !p.isDeleted;
      const matchTab = p.status === activeTab;
      const matchSearch = !search || p.companyName.toLowerCase().includes(search.toLowerCase()) || p.projectName.toLowerCase().includes(search.toLowerCase());
      const matchAuditor = !filterAuditor || p.auditors.some(c => c.id === filterAuditor);
      const matchEstado = !filterEstado || p.status === filterEstado;
      return matchDeleted && matchTab && matchSearch && matchAuditor && matchEstado;
    });
  }, [projects, activeTab, search, filterAuditor, filterEstado]);

  const sortedProjects = useMemo(() => {
    if (!sortKey) return filteredProjects;
    const value = (p: typeof filteredProjects[number]) =>
      sortKey === 'progreso' ? getProjectSummary(p).progress
      : sortKey === 'fecha' ? p.startDate
      : p.companyName;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filteredProjects].sort((a, b) => {
      const va = value(a), vb = value(b);
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' });
      return cmp * dir;
    });
  }, [filteredProjects, sortKey, sortDir]);

  // Volver a la primera pagina cuando cambian los filtros o el orden.
  useEffect(() => { setPage(1); }, [activeTab, search, filterAuditor, filterEstado, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedProjects.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedProjects = sortedProjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Progreso y fecha arrancan de mayor a menor (lo mas avanzado / reciente primero).
      setSortDir(key === 'proyecto' ? 'asc' : 'desc');
    }
  };

  const handleNewProject = async (data: { companyName: string; projectName: string; auditors: any[]; startDate: string; tamano?: string; mision?: string; vision?: string }) => {
    try {
      await addProject(data);
      toast.success('Proyecto creado exitosamente', {
        description: `${data.projectName} para ${data.companyName} ha sido registrado.`,
      });
    } catch (err) {
      console.error('[Dashboard] Error creando proyecto:', err);
      toast.error('Error al crear el proyecto. Inténtalo de nuevo.');
    }
  };

  const enEjecucionCount = projects.filter(p => !p.isDeleted && p.status === 'en_ejecucion').length;
  const completadosCount = projects.filter(p => !p.isDeleted && p.status === 'completado').length;

  const tabs = [
    { key: 'en_ejecucion' as Tab, label: 'En ejecución', icon: <FolderOpen size={14} strokeWidth={1.75} />, count: enEjecucionCount },
    { key: 'completado' as Tab, label: 'Completados', icon: <CheckSquare size={14} strokeWidth={1.75} />, count: completadosCount },
  ];

  // Construir opciones de filtro de auditores desde los proyectos reales
  const auditorOptions: FilterOption[] = useMemo(() => {
    const seen = new Set<string>();
    const opts: FilterOption[] = [];
    for (const p of projects) {
      for (const a of p.auditors) {
        if (!seen.has(a.id)) {
          seen.add(a.id);
          opts.push({ value: a.id, label: a.name });
        }
      }
    }
    return opts;
  }, [projects]);

  const estadoOptions: FilterOption[] = [
    { value: 'en_ejecucion', label: 'En ejecución' },
    { value: 'completado', label: 'Completado' },
  ];

  return (
    <div className="min-h-screen bg-[#f7f8ff]">
      <div className="max-w-[1440px] mx-auto px-4 py-6 sm:px-6 md:py-10 lg:px-10 lg:py-12">
        {/* Header */}
        <div className="flex flex-col items-stretch gap-5 mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6 md:mb-12">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>
              Panel principal
            </p>
            <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: 'clamp(1.75rem, 5vw, 2.25rem)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              Mis proyectos
            </h1>
            <p className="text-neutral-500 text-sm mt-3" style={{ fontWeight: 400 }}>
              Bienvenido, {currentUser.name}
              <span className="mx-2 text-neutral-300">·</span>
              <span className="text-neutral-600">{projects.length}</span> proyectos en cartera
            </p>
          </div>
          <div className="flex items-center gap-4">
            <IcesiLogo variant="positive" className="brand-logo-mark hidden md:block h-11 w-auto" />
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ y: 0 }}
              onClick={() => setShowModal(true)}
              className="brand-button-primary group flex items-center justify-center gap-2.5 pl-4 pr-5 py-3 rounded-full text-sm transition-all flex-shrink-0 flex-1 sm:flex-none"
              style={{
                fontWeight: 500,
                boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(84,84,233,0.42)',
              }}
            >
              <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center transition-colors group-hover:bg-white/15">
                <Plus size={13} strokeWidth={2.25} />
              </span>
              Nuevo proyecto
            </motion.button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="brand-kpi-strip grid-cols-3 mb-4 md:mb-8">
          {[
            { label: 'Total', value: projects.length },
            { label: 'En ejecución', value: enEjecucionCount },
            { label: 'Completados', value: completadosCount },
          ].map((s) => (
            <div key={s.label} className="brand-kpi-item flex flex-col items-start gap-0.5 max-md:px-2.5! max-md:py-2.5! md:flex-row md:items-center md:justify-between md:gap-3">
              <p className="text-[9.5px] md:text-[11px] uppercase tracking-[0.04em] md:tracking-[0.14em] text-neutral-400 truncate max-w-full" style={{ fontWeight: 500 }}>{s.label}</p>
              <p className="text-neutral-900 tabular-nums" style={{ fontWeight: 500, fontSize: '1.125rem', letterSpacing: '-0.02em' }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Toolbar — sticky on scroll */}
        <div className="md:sticky md:top-0 z-30 py-2 md:py-4 mb-4 md:mb-6 bg-[#f7f8ff]/90 md:backdrop-blur-md flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between md:gap-4 md:flex-wrap">
          {/* Tabs */}
          <div role="tablist" aria-label="Estado de los proyectos" className="flex md:inline-flex items-center gap-1 p-1 rounded-full bg-white border border-neutral-200/80" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex-1 md:flex-none justify-center flex items-center gap-2 whitespace-nowrap pl-3 pr-2.5 md:pl-3.5 md:pr-3 py-1.5 rounded-full text-[13px] transition-colors ${
                  activeTab === tab.key ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'
                }`}
                style={{ fontWeight: activeTab === tab.key ? 500 : 400 }}
              >
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="active-tab-pill"
                    className="absolute inset-0 bg-neutral-100 rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  <span className="hidden sm:inline-flex">{tab.icon}</span>
                  {tab.label}
                  <span
                    className={`tabular-nums text-[11px] px-1.5 py-px rounded-full ${
                      activeTab === tab.key ? 'bg-white text-neutral-700 border border-neutral-200/70' : 'text-neutral-400'
                    }`}
                    style={{ fontWeight: 500 }}
                  >
                    {tab.count}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {/* Search + filters */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={14} strokeWidth={1.75} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar empresa o proyecto"
                aria-label="Buscar empresa o proyecto"
                className="w-full md:w-72 pl-10 pr-4 py-2.5 bg-white border border-neutral-200/80 rounded-full text-[13px] outline-none focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100 transition-all placeholder:text-neutral-400"
              />
            </div>

            <div className="flex gap-2">
            <FilterDropdown
              className="flex-1 md:flex-none"
              value={filterAuditor}
              onChange={setFilterAuditor}
              options={auditorOptions}
              placeholder="Auditor"
              icon={<User size={13} strokeWidth={1.75} />}
            />

            <FilterDropdown
              className="flex-1 md:flex-none"
              value={filterEstado}
              onChange={setFilterEstado}
              options={estadoOptions}
              placeholder="Estado"
              icon={<Layers size={13} strokeWidth={1.75} />}
            />
            </div>
          </div>
        </div>

        {/* Listado: tabla en tablet/escritorio (>= 768px), tarjetas compactas en celular */}
        <AnimatePresence mode="wait">
          {isLoading && projects.length === 0 ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-busy="true" aria-label="Cargando proyectos">
              <div className="hidden md:block"><ProjectTableSkeleton /></div>
              <div className="md:hidden flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => <ProjectCardSkeleton key={i} />)}
              </div>
            </motion.div>
          ) : sortedProjects.length > 0 ? (
            <motion.div
              key={activeTab + search + filterAuditor + filterEstado}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="hidden md:block">
                <ProjectTable projects={pagedProjects} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              </div>
              <div className="md:hidden flex flex-col gap-2">
                {pagedProjects.map((project, i) => (
                  <ProjectCard key={project.id} project={project} index={i} />
                ))}
              </div>

              {pageCount > 1 && (
                <nav aria-label="Paginación de proyectos" className="flex items-center justify-between gap-3 mt-4">
                  <p className="text-neutral-500 text-[12px] tabular-nums">
                    {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sortedProjects.length)} de {sortedProjects.length}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      aria-label="Página anterior"
                      className="w-9 h-9 rounded-full bg-white border border-neutral-200/80 flex items-center justify-center text-neutral-600 hover:border-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#5454e9]/40"
                    >
                      <ChevronLeft size={15} strokeWidth={1.75} />
                    </button>
                    <span className="text-neutral-600 text-[12px] tabular-nums px-1.5" aria-current="page" style={{ fontWeight: 500 }}>
                      {currentPage} / {pageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage(currentPage + 1)}
                      disabled={currentPage === pageCount}
                      aria-label="Página siguiente"
                      className="w-9 h-9 rounded-full bg-white border border-neutral-200/80 flex items-center justify-center text-neutral-600 hover:border-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#5454e9]/40"
                    >
                      <ChevronRight size={15} strokeWidth={1.75} />
                    </button>
                  </div>
                </nav>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16 md:py-24 px-6 text-center bg-white rounded-2xl border border-dashed border-neutral-200"
            >
              <div className="w-14 h-14 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center mb-5">
                <SlidersHorizontal size={20} className="text-neutral-400" strokeWidth={1.5} />
              </div>
              <p className="text-neutral-900 mb-1.5" style={{ fontWeight: 500 }}>Sin resultados</p>
              <p className="text-neutral-500 text-sm max-w-xs">
                {search ? `No hay proyectos que coincidan con "${search}".` : 'Aún no hay proyectos en esta vista. Cree uno para comenzar.'}
              </p>
              {!search && (
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-6 flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-sm transition-all hover:-translate-y-px"
                  style={{ background: '#5454e9', fontWeight: 500 }}
                >
                  <Plus size={14} /> Crear proyecto
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <NewProjectModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleNewProject}
      />
    </div>
  );
}
