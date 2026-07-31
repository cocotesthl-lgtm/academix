/**
 * Opiniones del producto — estilo Amazon/ML.
 * Header con puntuación grande + estrellas + total. Debajo, barras
 * horizontales por estrella (5⭐ 4⭐ 3⭐ 2⭐ 1⭐) con el porcentaje relativo.
 *
 * Todo manual (no hay reviews reales todavía) — el owner configura desde
 * el editor: `rating`, `reviews_count` y `reviews_breakdown`.
 */

function starGlyphs(rating: number): Array<'full' | 'half' | 'empty'> {
  const out: Array<'full' | 'half' | 'empty'> = [];
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) out.push('full');
    else if (rating >= i - 0.5) out.push('half');
    else out.push('empty');
  }
  return out;
}

export function ProductReviews({
  rating,
  reviewsCount,
  breakdown
}: {
  rating: number | null | undefined;
  reviewsCount: number;
  breakdown: number[] | undefined;
}) {
  // No mostrar si no hay rating ni breakdown
  if (!rating || rating <= 0 || !breakdown || breakdown.length !== 5) return null;
  const total = breakdown.reduce((s, n) => s + n, 0);
  if (total === 0) return null;

  return (
    <section className="mt-10 border-t border-black/10 pt-8">
      <h2 className="text-xl font-bold mb-5">Opiniones del producto</h2>
      <div className="flex flex-col md:flex-row items-start gap-8">
        {/* Score gigante + estrellas */}
        <div className="text-left">
          <div className="text-6xl font-bold text-blue-600 leading-none">
            {rating.toFixed(1)}
          </div>
          <div className="flex items-center gap-0.5 mt-2" aria-label={`Rating ${rating} de 5`}>
            {starGlyphs(rating).map((g, i) => (
              <svg key={i} width="18" height="18" viewBox="0 0 24 24"
                className={g === 'empty' ? 'text-black/15' : 'text-blue-600'}
                fill="currentColor" aria-hidden="true">
                {g === 'half' ? (
                  <>
                    <defs>
                      <linearGradient id={`rev-half-${i}`}>
                        <stop offset="50%" stopColor="currentColor" />
                        <stop offset="50%" stopColor="rgba(0,0,0,0.15)" />
                      </linearGradient>
                    </defs>
                    <polygon fill={`url(#rev-half-${i})`}
                      points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </>
                ) : (
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                )}
              </svg>
            ))}
          </div>
          <div className="text-sm text-black/55 mt-1">
            {reviewsCount.toLocaleString('es-AR')} calificaciones
          </div>
          <div className="text-xs text-black/45 mt-3 flex items-start gap-1.5 max-w-[220px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-black/40 shrink-0 mt-px">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Incluye opiniones de otros países.</span>
          </div>
        </div>

        {/* Barras 5..1 */}
        <div className="flex-1 max-w-md w-full space-y-1.5">
          {[5, 4, 3, 2, 1].map((stars, i) => {
            const count = breakdown[i] ?? 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={stars} className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
                  <div className="h-full bg-black/70" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-sm text-black/60 shrink-0 flex items-center gap-1 w-8">
                  <span>{stars}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-black/50">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
