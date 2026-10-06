import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, X, Sparkles, MoreVertical, Edit2, Trash2, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import { apiPost } from '../../lib/api';
import PhaseCard from './PhaseCard';
import ExecutiveOverview from './ExecutiveOverview';
import { usePhaseConfig } from '../../lib/phaseConfig';
import EditProjectModal from '../dashboard/EditProjectModal';
import { LoadingRouteState, MissingProjectState } from '../layout/RouteState';

export default function ProjectDetailView() {
  // useParams() extrae :id desde la URL dinámica (TODO: usar para queries a Supabase)
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, reprocessPhase, editProject, moveToTrash, updatePhaseStatus, isLoading } = useApp();
  const [showSummary, setShowSummary] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const phaseConfig = usePhaseConfig();

  // TODO: Realtime - subscribe to 'fases_estado' where proyecto_id = current_id
  // RF-PROJ-04: Mapear el ENUM de base de datos 'public.estado_fase' a las props del componente
  // TODO: fetch('fases_estado').order('numero_fase', { ascending: true })
  // TODO: Lógica de cliente para determinar disponibilidad basado en el array de estados

  const project = getProject(projectId!);

  if (!project) {
    if (isLoading) return <LoadingRouteState message="Cargando el proyecto..." />;
    return <MissingProjectState />;
  }

  /*
    return (
      <div className="min-h-screen bg-[#f7f8ff] flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-500 text-sm mb-4">Proyecto no encontrado.</p>
          <button onClick={() => navigate('/dashboard')} className="text-neutral-900 hover:underline text-sm" style={{ fontWeight: 500 }}>
            ← Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  */
  const handleRetry = async (phaseNumber: number) => {
    await reprocessPhase(project.id, phaseNumber);
    toast.success(`Fase ${phaseNumber} reiniciada`, { description: 'Se restablecieron esta fase y las que usan su resultado.' });
  };

  const processingPhase = project.phases.find(p => p.status === 'procesando');

  const handleStopProcessing = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (!processingPhase) return;
    try {
      // El backend deja la fase en 'disponible' y descarta el resultado si el agente termina despues.
      await apiPost(`/api/projects/${project.id}/phases/${processingPhase.number}/cancel`);
      updatePhaseStatus(project.id, processingPhase.number, 'disponible');
      toast.info('Procesamiento detenido exitosamente');
    } catch (err: any) {
      toast.error('Error al detener procesamiento', { description: err.message });
    }
  };

  const handleEditProject = async (data: { companyName: string; projectName: string; auditorId: string }) => {
    try {
      await editProject(project.id, data);
      toast.success('Proyecto actualizado exitosamente');
    } catch (err: any) {
      toast.error('Error al actualizar el proyecto', { description: err.message });
    }
  };

  const completedPhasesWithDiagnosis = project.phases.filter(
    p => p.status === 'completado' && p.agentDiagnosis
  );

  const startDate = new Date(project.startDate).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const consultants = project.auditors.map(a => a.name).filter(name => name && name !== 'Sin asignar');

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Encabezado */}
      <div className="bg-white border-b border-neutral-200/70">
        <div className="max-w-[1100px] mx-auto px-10 pt-6 pb-7">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-1.5 text-neutral-500 hover:text-neutral-900 text-[13px] transition-colors mb-6"
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            Proyectos
          </button>

          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="min-w-0">
              <p className="text-[13px] text-neutral-500 mb-1.5">{project.companyName}</p>
              <h1 className="text-neutral-900" style={{ fontWeight: 500, fontSize: '1.75rem', lineHeight: 1.15, letterSpacing: '-0.015em' }}>
                {project.projectName}
              </h1>
              <p className="mt-3 text-[13px] text-neutral-500">
                Inicio: {startDate}
                {consultants.length > 0 && <> · Consultor{consultants.length > 1 ? 'es' : ''}: {consultants.join(', ')}</>}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSummary(s => !s)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:text-neutral-900 transition-colors"
              >
                Diagnósticos por fase
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  aria-label="Más acciones"
                  className="w-9 h-9 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 flex items-center justify-center text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  <MoreVertical size={16} strokeWidth={1.75} />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-neutral-200/80 rounded-xl shadow-lg z-20 overflow-hidden">
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowEditModal(true);
                        }}
                        className="w-full text-left px-4 py-3 text-[13px] text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 border-b border-neutral-100"
                        style={{ fontWeight: 500 }}
                      >
                        <Edit2 size={13} /> Editar proyecto
                      </button>
                      {processingPhase && (
                        <button
                          onClick={handleStopProcessing}
                          className="w-full text-left px-4 py-3 text-[13px] text-amber-600 hover:bg-amber-50 flex items-center gap-2 border-b border-neutral-100"
                          style={{ fontWeight: 500 }}
                        >
                          <Square size={13} /> Detener procesamiento
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowDeleteModal(true);
                        }}
                        className="w-full text-left px-4 py-3 text-[13px] text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                        style={{ fontWeight: 500 }}
                      >
                        <Trash2 size={14} /> Mover a papelera
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Body */}
      <div className="max-w-[1100px] mx-auto px-10 py-10">
        {/* Diagnoses panel */}
        <AnimatePresence>
          {showSummary && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="mb-10 overflow-hidden"
            >
              <div className="bg-white rounded-2xl border border-neutral-200/70" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-neutral-50 border border-neutral-200/80 flex items-center justify-center">
                      <Sparkles size={13} className="text-neutral-700" strokeWidth={1.75} />
                    </div>
                    <h3 className="text-neutral-900 text-[13px]" style={{ fontWeight: 500 }}>Diagnósticos por fase</h3>
                  </div>
                  <button onClick={() => setShowSummary(false)} className="w-7 h-7 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-700 transition-colors">
                    <X size={14} strokeWidth={1.75} />
                  </button>
                </div>
                {completedPhasesWithDiagnosis.length === 0 ? (
                  <div className="px-6 py-12 text-center text-neutral-400 text-sm">
                    Aún no hay diagnósticos completados para mostrar.
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {completedPhasesWithDiagnosis.map(phase => (
                      <div key={phase.number} className="px-6 py-5">
                        <div className="flex items-center gap-2.5 mb-2">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] tabular-nums" style={{ fontWeight: 600 }}>
                            {phase.number}
                          </span>
                          <span className="text-[13px] text-neutral-900" style={{ fontWeight: 500 }}>
                            {phase.name}
                          </span>
                          <span className="text-[11px] text-neutral-400 ml-auto">{phase.completedAt}</span>
                        </div>
                        <p className="text-neutral-600 text-[13px] leading-relaxed pl-7">{phase.agentDiagnosis}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ExecutiveOverview projectId={project.id} phases={project.phases} config={phaseConfig} />

        {/* Fases del proyecto: tarjetas (formato pedido por el profesor). Cualquier fase se puede
            abrir; las dependencias se indican en cada tarjeta. */}
        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 mb-4">
            <h2 className="text-neutral-900" style={{ fontWeight: 500, fontSize: '1.0625rem' }}>Fases del proyecto</h2>
            <span className="text-[12px] text-neutral-400">Haga clic en cualquier fase para ingresar</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {project.phases.map((phase, i) => (
              <PhaseCard
                key={phase.number}
                phase={phase}
                phases={project.phases}
                projectId={project.id}
                onRetry={handleRetry}
                index={i}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)} 
              className="absolute inset-0 bg-neutral-900/30 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative bg-white rounded-2xl w-full max-w-md z-10 p-6 border border-neutral-200/70 shadow-2xl"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={16} className="text-rose-600" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-neutral-900 mb-1.5 tracking-tight" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>Mover a papelera</h3>
                  <p className="text-neutral-500 text-[13px] leading-relaxed">
                    ¿Estás seguro de que deseas enviar el proyecto <strong>{project.projectName}</strong> a la papelera? Podrás restaurarlo más adelante desde la papelera.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowDeleteModal(false)} 
                  className="flex-1 py-2.5 border border-neutral-200/80 rounded-full text-neutral-700 text-[13px] hover:bg-neutral-50 transition-colors" 
                  style={{ fontWeight: 500 }}
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await moveToTrash(project.id);
                      toast.success('Proyecto movido a la papelera');
                      navigate('/dashboard');
                    } catch (error) {
                      toast.error('Error al mover a la papelera');
                    } finally {
                      setIsDeleting(false);
                      setShowDeleteModal(false);
                    }
                  }} 
                  disabled={isDeleting}
                  className="flex-1 py-2.5 rounded-full text-white text-[13px] flex items-center justify-center gap-2 disabled:opacity-70 hover:-translate-y-px transition-all"
                  style={{ background: '#e11d48', fontWeight: 500 }}
                >
                  {isDeleting ? <><Loader2 size={13} className="animate-spin" /> Moviendo…</> : 'Sí, mover a papelera'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <EditProjectModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEditProject}
        project={project}
      />
    </div>
  );
}
