import { useEffect, useState } from 'react';
import { Cpu, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAiModelSettings } from '../../../hooks/useAdmin';

/**
 * Modelos de Gemini disponibles para los agentes. No es una lista cerrada: cualquier nombre
 * de modelo valido del catalogo de Gemini funciona, pero estos son los candidatos recomendados
 * y aparecen como sugerencias de autocompletado. Los alias "-latest" se recomiendan sobre
 * versiones fechadas porque Google los mueve automaticamente al modelo vigente.
 */
const MODEL_SUGGESTIONS: Array<{ rank: string; slug: string; useCase: string }> = [
  { rank: '🥇', slug: 'gemini-pro-latest', useCase: 'Agentes complejos / razonamiento / planificación' },
  { rank: '🥈', slug: 'gemini-flash-latest', useCase: 'Agentes generales, rápido y económico' },
  { rank: '🥉', slug: 'gemini-flash-lite-latest', useCase: 'Agentes de alto volumen, el más económico' },
  { rank: '4', slug: 'gemini-3.1-pro-preview', useCase: 'Mayor contexto y razonamiento (preview)' },
  { rank: '5', slug: 'gemini-2.5-flash-lite', useCase: 'Alternativa estable de bajo costo' },
];

function ModelsSection() {
  const { settings, isLoading, isSaving, updateSelectedModel } = useAiModelSettings();

  const [primary, setPrimary] = useState(settings.selectedModel);
  const [fallback, setFallback] = useState(settings.fallbackModel);

  useEffect(() => {
    setPrimary(settings.selectedModel);
    setFallback(settings.fallbackModel);
  }, [settings.selectedModel, settings.fallbackModel]);

  const dirty = primary.trim() !== settings.selectedModel || fallback.trim() !== settings.fallbackModel;

  const handleSave = async () => {
    if (!primary.trim()) {
      toast.error('El modelo principal no puede estar vacío.');
      return;
    }
    try {
      await updateSelectedModel(primary.trim(), fallback.trim() || undefined);
      toast.success('Configuración de modelos actualizada', {
        description: `Principal: ${primary.trim()}${fallback.trim() ? ` · Respaldo: ${fallback.trim()}` : ''}`,
      });
    } catch (err: any) {
      toast.error('No se pudo actualizar el modelo', { description: err.message });
    }
  };

  const updatedAt = settings.updatedAt
    ? new Date(settings.updatedAt).toLocaleString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : 'Sin registro';

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-gray-900" style={{ fontWeight: 700 }}>Modelos de IA</h2>
          <p className="text-gray-500 text-sm mt-0.5">Modelo global para todos los agentes PMO, servido vía Gemini</p>
        </div>
        {(isLoading || isSaving) && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 size={14} className="animate-spin" />
            {isSaving ? 'Guardando...' : 'Cargando...'}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
        <div className="flex items-start gap-3 p-4 rounded-xl border border-[#5454e9]/20 bg-[#5454e9]/[0.06] mb-5">
          <Sparkles size={17} className="text-[#5454e9] mt-0.5" />
          <div>
            <p className="text-gray-900 text-sm" style={{ fontWeight: 700 }}>
              {settings.selectedModel || 'Sin modelo configurado'} activo
            </p>
            <p className="text-gray-500 text-xs mt-1">
              Cada modelo se identifica con su nombre de Gemini. Si el modelo principal falla,
              se reintenta automáticamente con el de respaldo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cpu size={14} className="text-gray-500" />
              <p className="text-xs uppercase tracking-wide text-gray-400" style={{ fontWeight: 800 }}>
                Modelo principal
              </p>
            </div>
            <input
              type="text"
              list="ai-model-suggestions"
              value={primary}
              onChange={e => setPrimary(e.target.value)}
              placeholder="gemini-pro-latest"
              disabled={isLoading || isSaving}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:border-[#5454e9] disabled:opacity-60"
            />
          </div>

          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cpu size={14} className="text-gray-500" />
              <p className="text-xs uppercase tracking-wide text-gray-400" style={{ fontWeight: 800 }}>
                Modelo de respaldo (fallback)
              </p>
            </div>
            <input
              type="text"
              list="ai-model-suggestions"
              value={fallback}
              onChange={e => setFallback(e.target.value)}
              placeholder="gemini-flash-latest"
              disabled={isLoading || isSaving}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:border-[#5454e9] disabled:opacity-60"
            />
          </div>
        </div>

        <datalist id="ai-model-suggestions">
          {MODEL_SUGGESTIONS.map(m => <option key={m.slug} value={m.slug} />)}
        </datalist>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <a
            href="https://ai.google.dev/gemini-api/docs/models"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#5454e9] hover:underline"
          >
            Ver catálogo de modelos de Gemini
            <ExternalLink size={12} />
          </a>
          <button
            onClick={handleSave}
            disabled={isLoading || isSaving || !dirty}
            className="px-5 py-2.5 rounded-xl text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{ background: '#5454e9', fontWeight: 700 }}
          >
            {isSaving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
          <span>
            Proveedor detectado:{' '}
            <span className="text-gray-700" style={{ fontWeight: 700 }}>{settings.provider || 'desconocido'}</span>
          </span>
          <span>Última actualización: {updatedAt}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-gray-900 text-sm mb-4" style={{ fontWeight: 700 }}>Ranking recomendado para agentes</p>
        <div className="space-y-2">
          {MODEL_SUGGESTIONS.map(m => {
            const isPrimary = m.slug === primary.trim();
            const isFallback = m.slug === fallback.trim();
            return (
              <div
                key={m.slug}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-sm ${
                  isPrimary ? 'border-[#5454e9] bg-[#5454e9]/[0.06]' : isFallback ? 'border-gray-300 bg-gray-50' : 'border-transparent'
                }`}
              >
                <span className="w-6 text-center flex-shrink-0">{m.rank}</span>
                <button
                  type="button"
                  onClick={() => setPrimary(m.slug)}
                  className="font-mono text-gray-800 text-xs hover:underline flex-shrink-0 w-56 text-left truncate"
                  title="Usar como modelo principal"
                >
                  {m.slug}
                </button>
                <span className="text-gray-500 text-xs flex-1 truncate">{m.useCase}</span>
                {isPrimary && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#5454e9] text-white flex-shrink-0" style={{ fontWeight: 700 }}>Principal</span>}
                {isFallback && !isPrimary && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-300 text-gray-700 flex-shrink-0" style={{ fontWeight: 700 }}>Respaldo</span>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export { ModelsSection };
