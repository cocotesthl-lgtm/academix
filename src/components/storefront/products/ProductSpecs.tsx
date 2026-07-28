/**
 * Grid de especificaciones estilo MercadoLibre.
 * Renderiza pares "Label: Valor" con ícono de check, en 2 columnas.
 * Se oculta si no hay specs.
 */
export function ProductSpecs({
  specs
}: {
  specs: Array<{ label: string; value: string }>;
}) {
  if (!specs || specs.length === 0) return null;
  return (
    <section className="mt-10 border-t border-black/10 pt-8">
      <h2 className="text-xl font-bold mb-5">Características del producto</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        {specs.map((s, i) => (
          <div key={i} className="flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-black/40 shrink-0 mt-0.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="9 12 12 15 15 10" />
            </svg>
            <div className="text-sm text-black/75 leading-snug">
              <span className="text-black/60">{s.label}:</span>{' '}
              <strong className="font-semibold text-black">{s.value}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
