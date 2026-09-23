import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { Loader2, MoreVertical, Trash2, Edit2, Square } from 'lucide-react';
import { Project, useApp } from '../../context/AppContext';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import EditProjectModal from './EditProjectModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface ProjectActionsProps {
  project: Project;
}

/**
 * Menu ⋮ de un proyecto (editar, detener procesamiento, mover a papelera) con sus modales.
 * Se usa en la fila de la tabla y en la tarjeta compacta. El contenedor detiene la
 * propagacion de clics y teclas para que interactuar con el menu o los modales nunca
 * dispare la navegacion de la fila/tarjeta.
 */
export default function ProjectActions({ project }: ProjectActionsProps) {
  const { moveToTrash, editProject, updatePhaseStatus } = useApp();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const processingPhase = project.phases.find(p => p.status === 'procesando');

  const handleStopProcessing = async () => {
    if (!processingPhase) return;
    try {
      const { error } = await supabase
        .from('fases_estado')
        .update({
          estado_visual: 'disponible',
          updated_at: new Date().toISOString(),
        })
        .eq('proyecto_id', project.id)
        .eq('numero_fase', processingPhase.number);

      if (error) throw error;

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

  return (
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Acciones del proyecto ${project.companyName}`}
            className="w-9 h-9 rounded-full border border-transparent hover:bg-neutral-100 hover:border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-[#5454e9]/40 data-[state=open]:bg-neutral-100 data-[state=open]:text-neutral-900"
          >
            <MoreVertical size={15} strokeWidth={1.75} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 p-0 bg-white border border-neutral-200/80 rounded-xl shadow-lg overflow-hidden">
          <DropdownMenuItem
            onSelect={() => setShowEditModal(true)}
            className="rounded-none px-4 py-2.5 text-[13px] text-neutral-700 focus:bg-neutral-50 focus:text-neutral-700 gap-2 border-b border-neutral-100 cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <Edit2 size={13} className="text-neutral-700" /> Editar proyecto
          </DropdownMenuItem>
          {processingPhase && (
            <DropdownMenuItem
              onSelect={handleStopProcessing}
              className="rounded-none px-4 py-2.5 text-[13px] text-amber-600 focus:bg-amber-50 focus:text-amber-600 gap-2 border-b border-neutral-100 cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              <Square size={13} className="text-amber-600" /> Detener procesamiento
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => setShowDeleteModal(true)}
            className="rounded-none px-4 py-2.5 text-[13px] text-rose-600 focus:bg-rose-50 focus:text-rose-600 gap-2 cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <Trash2 size={14} className="text-rose-600" /> Mover a papelera
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 cursor-default">
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
              role="dialog"
              aria-modal="true"
              aria-labelledby={`delete-title-${project.id}`}
              className="relative bg-white rounded-2xl w-full max-w-md z-10 p-6 border border-neutral-200/70 text-left"
              style={{ boxShadow: '0 24px 64px -16px rgba(0,0,0,0.18)' }}
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={16} className="text-rose-600" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 id={`delete-title-${project.id}`} className="text-neutral-900 mb-1.5 tracking-tight" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>Mover a papelera</h3>
                  <p className="text-neutral-500 text-[13px] leading-relaxed">
                    ¿Estás seguro de que deseas enviar el proyecto <strong>{project.projectName}</strong> a la papelera? Podrás restaurarlo más adelante.
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
