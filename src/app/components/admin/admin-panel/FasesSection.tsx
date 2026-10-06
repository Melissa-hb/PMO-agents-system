import { useEffect, useState, type ReactNode } from 'react';
import { BookOpen, Bot, FolderTree, GitBranch, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFasesConfig, type AgentConfig, type ReferenceGuide } from '../../../hooks/useFasesConfig';
import type { DocumentCategoryDefinition, PhaseDefinition } from '../../../lib/phaseConfig';

type Tab = 'fases' | 'agentes' | 'categorias' | 'guias';

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'fases', label: 'Fases', icon: <GitBranch size={14} /> },
  { id: 'agentes', label: 'Agentes', icon: <Bot size={14} /> },
  { id: 'categorias', label: 'Categorías de documentos', icon: <FolderTree size={14} /> },
  { id: 'guias', label: 'Guías de la fase 7', icon: <BookOpen size={14} /> },
];

const input = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#5454e9] disabled:opacity-60';
const label = 'block text-xs uppercase tracking-wide text-gray-400 mb-1.5';

const sameList = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

function SaveButton({ disabled, onClick, children = 'Guardar' }: { disabled: boolean; onClick: () => void; children?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: '#5454e9', fontWeight: 700 }}
    >
      <Save size={13} />
      {children}
    </button>
  );
}

/** Selector de fases como etiquetas que se activan y desactivan. */
function PhasePicker({ fases, selected, exclude, onChange, disabled }: {
  fases: PhaseDefinition[]; selected: number[]; exclude: number; onChange: (v: number[]) => void; disabled: boolean;
}) {
  const toggle = (n: number) =>
    onChange(selected.includes(n) ? selected.filter(x => x !== n) : [...selected, n].sort((a, b) => a - b));
  return (
    <div className="flex flex-wrap gap-1.5">
      {fases.filter(f => f.numero !== exclude).map(f => {
        const on = selected.includes(f.numero);
        return (
          <button
            key={f.numero}
            type="button"
            disabled={disabled}
            onClick={() => toggle(f.numero)}
            title={f.nombre}
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
              on ? 'bg-[#5454e9] border-[#5454e9] text-white' : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
            style={{ fontWeight: 700 }}
          >
            {f.codigo}
          </button>
        );
      })}
    </div>
  );
}

// ── Fases ─────────────────────────────────────────────────────────────────────────────────────

function PhaseRow({ fase, fases, disabled, onSave }: {
  fase: PhaseDefinition; fases: PhaseDefinition[]; disabled: boolean;
  onSave: (changes: Partial<PhaseDefinition>) => Promise<boolean>;
}) {
  const [nombre, setNombre] = useState(fase.nombre);
  const [requiere, setRequiere] = useState(fase.requiereCompletas);
  const [lee, setLee] = useState(fase.leeResultadoDe);
  useEffect(() => { setNombre(fase.nombre); setRequiere(fase.requiereCompletas); setLee(fase.leeResultadoDe); }, [fase]);

  const dirty = nombre.trim() !== fase.nombre || !sameList(requiere, fase.requiereCompletas) || !sameList(lee, fase.leeResultadoDe);

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="px-2 py-0.5 rounded-md bg-[#5454e9]/10 text-[#5454e9] text-xs" style={{ fontWeight: 800 }}>{fase.codigo}</span>
        <input className={input} value={nombre} onChange={e => setNombre(e.target.value)} disabled={disabled} />
        {!fase.visible && <span className="text-[11px] text-gray-400 whitespace-nowrap">Sin tarjeta propia</span>}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <span className={label} style={{ fontWeight: 800 }}>Debe estar completo antes</span>
          <PhasePicker fases={fases} selected={requiere} exclude={fase.numero} onChange={setRequiere} disabled={disabled} />
        </div>
        <div>
          <span className={label} style={{ fontWeight: 800 }}>El agente lee el resultado de</span>
          <PhasePicker fases={fases} selected={lee} exclude={fase.numero} onChange={setLee} disabled={disabled} />
        </div>
      </div>
      {dirty && (
        <div className="mt-3 flex justify-end">
          <SaveButton disabled={disabled || !nombre.trim()}
            onClick={() => onSave({ nombre: nombre.trim(), requiereCompletas: requiere, leeResultadoDe: lee })} />
        </div>
      )}
    </div>
  );
}

// ── Agentes ───────────────────────────────────────────────────────────────────────────────────

function AgentForm({ agente, disabled, onSave }: {
  agente: AgentConfig; disabled: boolean; onSave: (changes: Partial<AgentConfig>) => Promise<boolean>;
}) {
  const initial = () => ({
    nombreFase: agente.nombreFase ?? '',
    modelo: agente.modelo ?? '',
    temperatura: agente.temperatura ?? 1,
    maxOutputTokens: agente.maxOutputTokens,
    timeoutSeg: Math.round(agente.timeoutMs / 1000),
    sinRazonamiento: agente.sinRazonamiento,
    instruccionesSalida: agente.instruccionesSalida ?? '',
    promptSistema: agente.promptSistema ?? '',
    esquemaSalida: agente.esquemaSalida ? JSON.stringify(agente.esquemaSalida, null, 2) : '',
  });
  const [form, setForm] = useState(initial);
  useEffect(() => { setForm(initial()); }, [agente]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof ReturnType<typeof initial>>(key: K, value: ReturnType<typeof initial>[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial());

  const handleSave = () => {
    if (!form.promptSistema.trim()) { toast.error('El prompt del agente no puede quedar vacío.'); return; }
    let esquemaSalida: Record<string, unknown> | null = null;
    if (form.esquemaSalida.trim()) {
      try {
        esquemaSalida = JSON.parse(form.esquemaSalida);
      } catch {
        toast.error('El esquema de salida no es un JSON válido.');
        return;
      }
    }
    onSave({
      esquemaSalida,
      nombreFase: form.nombreFase,
      modelo: form.modelo,
      temperatura: Number(form.temperatura),
      maxOutputTokens: Number(form.maxOutputTokens),
      timeoutMs: Number(form.timeoutSeg) * 1000,
      sinRazonamiento: form.sinRazonamiento,
      instruccionesSalida: form.instruccionesSalida,
      promptSistema: form.promptSistema,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <span className={label} style={{ fontWeight: 800 }}>Nombre</span>
          <input className={input} value={form.nombreFase} onChange={e => set('nombreFase', e.target.value)} disabled={disabled} />
        </div>
        <div>
          <span className={label} style={{ fontWeight: 800 }}>Modelo (vacío = modelo global)</span>
          <input className={`${input} font-mono`} value={form.modelo} placeholder="gemini-flash-latest"
            onChange={e => set('modelo', e.target.value)} disabled={disabled} />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <span className={label} style={{ fontWeight: 800 }}>Temperatura (0–2)</span>
          <input type="number" min={0} max={2} step={0.1} className={input} value={form.temperatura}
            onChange={e => set('temperatura', Number(e.target.value))} disabled={disabled} />
        </div>
        <div>
          <span className={label} style={{ fontWeight: 800 }}>Tokens de salida máx.</span>
          <input type="number" min={1} max={65536} step={1024} className={input} value={form.maxOutputTokens}
            onChange={e => set('maxOutputTokens', Number(e.target.value))} disabled={disabled} />
        </div>
        <div>
          <span className={label} style={{ fontWeight: 800 }}>Tiempo de espera (s)</span>
          <input type="number" min={10} max={600} className={input} value={form.timeoutSeg}
            onChange={e => set('timeoutSeg', Number(e.target.value))} disabled={disabled} />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={form.sinRazonamiento} onChange={e => set('sinRazonamiento', e.target.checked)}
            disabled={disabled} className="accent-[#5454e9] w-4 h-4" />
          Sin razonamiento interno
        </label>
      </div>
      <p className="text-xs text-gray-400 -mt-2">
        Sin razonamiento conviene en fases que solo clasifican: Gemini cobra el razonamiento como tokens de salida.
      </p>
      <div>
        <span className={label} style={{ fontWeight: 800 }}>Instrucciones de salida (se agregan al final del prompt)</span>
        <textarea className={`${input} font-mono text-xs`} rows={6} value={form.instruccionesSalida}
          onChange={e => set('instruccionesSalida', e.target.value)} disabled={disabled} />
      </div>
      <div>
        <span className={label} style={{ fontWeight: 800 }}>Esquema de salida (JSON Schema, vacío = sin esquema)</span>
        <textarea className={`${input} font-mono text-xs`} rows={8} value={form.esquemaSalida}
          placeholder='{"type": "object", "properties": { ... }}'
          onChange={e => set('esquemaSalida', e.target.value)} disabled={disabled} />
        <p className="text-xs text-gray-400 mt-1">
          Con esquema, Gemini solo puede responder JSON válido con esa forma. Evita respuestas rotas en fases largas como la 7.
        </p>
      </div>
      <div>
        <span className={label} style={{ fontWeight: 800 }}>Prompt de sistema</span>
        <textarea className={`${input} font-mono text-xs`} rows={14} value={form.promptSistema}
          onChange={e => set('promptSistema', e.target.value)} disabled={disabled} />
        <p className="text-xs text-gray-400 mt-1">{form.promptSistema.length.toLocaleString('es-CO')} caracteres</p>
      </div>
      <div className="flex justify-end">
        <SaveButton disabled={disabled || !dirty} onClick={handleSave}>Guardar agente</SaveButton>
      </div>
    </div>
  );
}

function AgentsTab({ agentes, disabled, onSave }: {
  agentes: AgentConfig[]; disabled: boolean; onSave: (fase: number, changes: Partial<AgentConfig>) => Promise<boolean>;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const agente = agentes.find(a => a.faseNumero === selected) ?? agentes[0];
  if (!agente) return <p className="text-sm text-gray-400">No hay agentes configurados.</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
      <div className="space-y-1">
        {agentes.map(a => (
          <button
            key={a.faseNumero}
            onClick={() => setSelected(a.faseNumero)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              a.faseNumero === agente.faseNumero ? 'bg-[#5454e9]/10 text-[#5454e9]' : 'text-gray-600 hover:bg-gray-50'
            }`}
            style={{ fontWeight: a.faseNumero === agente.faseNumero ? 700 : 500 }}
          >
            <span className="text-xs text-gray-400 mr-1.5">{a.faseNumero}</span>
            {a.nombreFase}
          </button>
        ))}
      </div>
      <AgentForm agente={agente} disabled={disabled} onSave={changes => onSave(agente.faseNumero, changes)} />
    </div>
  );
}

// ── Categorias de documentos ──────────────────────────────────────────────────────────────────

function CategoryRow({ categoria, disabled, onSave, onDelete }: {
  categoria: DocumentCategoryDefinition; disabled: boolean;
  onSave: (changes: { nombre: string; esVisual: boolean }) => void; onDelete: () => void;
}) {
  const [nombre, setNombre] = useState(categoria.nombre);
  const [esVisual, setEsVisual] = useState(categoria.esVisual);
  useEffect(() => { setNombre(categoria.nombre); setEsVisual(categoria.esVisual); }, [categoria]);
  const dirty = nombre.trim() !== categoria.nombre || esVisual !== categoria.esVisual;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className="w-12 text-xs text-gray-500 font-mono" style={{ fontWeight: 700 }}>{categoria.codigo}</span>
      <input className={input} value={nombre} onChange={e => setNombre(e.target.value)} disabled={disabled} />
      <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap cursor-pointer"
        title="El PDF se envía completo al agente, nunca como texto (organigramas, mapas de procesos)">
        <input type="checkbox" checked={esVisual} onChange={e => setEsVisual(e.target.checked)}
          disabled={disabled || categoria.esOtros} className="accent-[#5454e9]" />
        Visual
      </label>
      <div className="w-24 flex justify-end gap-1">
        {dirty && <SaveButton disabled={disabled || !nombre.trim()} onClick={() => onSave({ nombre: nombre.trim(), esVisual })}>OK</SaveButton>}
        {!categoria.esOtros && !dirty && (
          <button onClick={onDelete} disabled={disabled} title="Eliminar categoría"
            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function CategoriesTab({ categorias, disabled, onSave, onDelete }: {
  categorias: DocumentCategoryDefinition[]; disabled: boolean;
  onSave: (codigo: string, changes: { nombre: string; esVisual?: boolean }) => Promise<boolean>;
  onDelete: (codigo: string) => Promise<boolean>;
}) {
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const sugerido = `D${String(Math.max(0, ...categorias.map(c => Number(c.codigo.slice(1)) || 0)) + 1).padStart(2, '0')}`;

  const agregar = async () => {
    const codigo = (nuevoCodigo || sugerido).toUpperCase();
    if (await onSave(codigo, { nombre: nuevoNombre.trim(), esVisual: false })) { setNuevoCodigo(''); setNuevoNombre(''); }
  };

  return (
    <>
      {categorias.map(c => (
        <CategoryRow key={c.codigo} categoria={c} disabled={disabled} onSave={changes => onSave(c.codigo, changes)}
          onDelete={() => { if (confirm(`¿Eliminar la categoría ${c.codigo} (${c.nombre})?`)) onDelete(c.codigo); }} />
      ))}
      <div className="flex items-center gap-3 pt-4 mt-2 border-t border-gray-200">
        <input className={`${input} w-24 font-mono`} placeholder={sugerido} value={nuevoCodigo}
          onChange={e => setNuevoCodigo(e.target.value)} disabled={disabled} />
        <input className={input} placeholder="Nombre de la nueva categoría" value={nuevoNombre}
          onChange={e => setNuevoNombre(e.target.value)} disabled={disabled} />
        <button onClick={agregar} disabled={disabled || !nuevoNombre.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#5454e9] text-[#5454e9] text-sm whitespace-nowrap disabled:opacity-40"
          style={{ fontWeight: 700 }}>
          <Plus size={14} /> Agregar
        </button>
      </div>
    </>
  );
}

// ── Guias de referencia ───────────────────────────────────────────────────────────────────────

function GuideRow({ guia, disabled, onSave, onDelete }: {
  guia: ReferenceGuide; disabled: boolean;
  onSave: (changes: { nombre: string; url: string; activa: boolean }) => void; onDelete: () => void;
}) {
  const [nombre, setNombre] = useState(guia.nombre);
  const [url, setUrl] = useState(guia.url);
  const [activa, setActiva] = useState(guia.activa);
  useEffect(() => { setNombre(guia.nombre); setUrl(guia.url); setActiva(guia.activa); }, [guia]);
  const dirty = nombre.trim() !== guia.nombre || url.trim() !== guia.url || activa !== guia.activa;

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 font-mono w-44 truncate" title={guia.clave}>{guia.clave}</span>
        <input className={input} value={nombre} onChange={e => setNombre(e.target.value)} disabled={disabled} />
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={activa} onChange={e => setActiva(e.target.checked)} disabled={disabled} className="accent-[#5454e9]" />
          Activa
        </label>
        <button onClick={onDelete} disabled={disabled} title="Eliminar guía"
          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40">
          <Trash2 size={14} />
        </button>
      </div>
      <input className={`${input} font-mono text-xs`} value={url} onChange={e => setUrl(e.target.value)} disabled={disabled} />
      {dirty && (
        <div className="flex justify-end">
          <SaveButton disabled={disabled || !nombre.trim() || !url.trim()} onClick={() => onSave({ nombre: nombre.trim(), url: url.trim(), activa })} />
        </div>
      )}
    </div>
  );
}

function GuidesTab({ guias, disabled, onSave, onDelete }: {
  guias: ReferenceGuide[]; disabled: boolean;
  onSave: (clave: string, changes: { nombre: string; url: string; activa?: boolean }) => Promise<boolean>;
  onDelete: (clave: string) => Promise<boolean>;
}) {
  const [nueva, setNueva] = useState({ clave: '', nombre: '', url: '' });
  const agregar = async () => {
    if (await onSave(nueva.clave.trim(), { nombre: nueva.nombre.trim(), url: nueva.url.trim(), activa: true })) {
      setNueva({ clave: '', nombre: '', url: '' });
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        El agente de la fase 7 recibe el contenido completo de las guías activas, en este orden. Deben ser archivos de texto o markdown accesibles por URL.
      </p>
      {guias.map(g => (
        <GuideRow key={g.clave} guia={g} disabled={disabled} onSave={changes => onSave(g.clave, changes)}
          onDelete={() => { if (confirm(`¿Eliminar la guía "${g.nombre}"?`)) onDelete(g.clave); }} />
      ))}
      <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-2">
        <div className="flex gap-3">
          <input className={`${input} w-44 font-mono`} placeholder="clave_unica" value={nueva.clave}
            onChange={e => setNueva({ ...nueva, clave: e.target.value })} disabled={disabled} />
          <input className={input} placeholder="Nombre de la guía" value={nueva.nombre}
            onChange={e => setNueva({ ...nueva, nombre: e.target.value })} disabled={disabled} />
        </div>
        <input className={`${input} font-mono text-xs`} placeholder="https://..." value={nueva.url}
          onChange={e => setNueva({ ...nueva, url: e.target.value })} disabled={disabled} />
        <div className="flex justify-end">
          <button onClick={agregar} disabled={disabled || !nueva.clave.trim() || !nueva.nombre.trim() || !nueva.url.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#5454e9] text-[#5454e9] text-sm disabled:opacity-40"
            style={{ fontWeight: 700 }}>
            <Plus size={14} /> Agregar guía
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Seccion ───────────────────────────────────────────────────────────────────────────────────

function FasesSection() {
  const { config, isLoading, isSaving, updatePhase, updateAgent, saveCategory, deleteCategory, saveGuide, deleteGuide } = useFasesConfig();
  const [tab, setTab] = useState<Tab>('fases');
  const busy = isLoading || isSaving;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-gray-900" style={{ fontWeight: 700 }}>Fases y agentes</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            Configuración de cada fase guardada en la base de datos: un cambio aquí se aplica en toda la plataforma.
          </p>
        </div>
        {busy && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 size={14} className="animate-spin" />
            {isSaving ? 'Guardando...' : 'Cargando...'}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm border transition-colors ${
              tab === t.id ? 'bg-[#5454e9] border-[#5454e9] text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            style={{ fontWeight: tab === t.id ? 700 : 500 }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        {tab === 'fases' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              "Debe estar completo antes" bloquea la acción principal de la fase hasta que esas fases terminen.
              "El agente lee el resultado de" define qué fases se invalidan al reprocesar otra.
            </p>
            {config.fases.map(f => (
              <PhaseRow key={f.numero} fase={f} fases={config.fases} disabled={busy} onSave={changes => updatePhase(f.numero, changes)} />
            ))}
          </div>
        )}
        {tab === 'agentes' && <AgentsTab agentes={config.agentes} disabled={busy} onSave={updateAgent} />}
        {tab === 'categorias' && (
          <CategoriesTab categorias={config.categoriasDocumento} disabled={busy} onSave={saveCategory} onDelete={deleteCategory} />
        )}
        {tab === 'guias' && <GuidesTab guias={config.guiasReferencia} disabled={busy} onSave={saveGuide} onDelete={deleteGuide} />}
      </div>
    </>
  );
}

export { FasesSection };
