/** Sectores sugeridos; el campo acepta cualquier otro texto. */
export const SECTORES_SUGERIDOS = [
  'Tecnología y software', 'Servicios financieros y banca', 'Seguros', 'Salud', 'Educación', 'Sector público',
  'Manufactura e industria', 'Construcción e infraestructura', 'Energía y minería', 'Comercio y retail',
  'Telecomunicaciones', 'Logística y transporte', 'Agroindustria', 'Consultoría y servicios profesionales',
  'Organización sin ánimo de lucro',
];

/**
 * Perfil de la industria de la organización: una de las cuatro esquinas de la línea base del PMO
 * Value Ring. Los agentes de las fases 4 a 7 lo tienen en cuenta en sus conclusiones.
 */
export default function SectorField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="sector-organizacion" className="text-gray-700 text-sm" style={{ fontWeight: 500 }}>Sector / industria</label>
      <input
        id="sector-organizacion"
        type="text"
        list="sectores-sugeridos"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Ej: Salud, Servicios financieros, Sector público..."
        maxLength={120}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none transition-all bg-white focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
      />
      <datalist id="sectores-sugeridos">
        {SECTORES_SUGERIDOS.map(s => <option key={s} value={s} />)}
      </datalist>
    </div>
  );
}
