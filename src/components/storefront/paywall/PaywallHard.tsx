/**
 * Paywall HARD: bloqueante y no dismisseable. El resto del artículo
 * NO se pre-renderiza en el HTML (a diferencia del soft), así que
 * view-source no filtra el contenido — es efectivamente un gate.
 *
 * Server component: no requiere JS, funciona sin hidratación.
 */
export function PaywallHard({
  title,
  message,
  ctaLabel,
  ctaHref,
  primaryColor
}: {
  title: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
  primaryColor: string;
}) {
  return (
    <div className="border-2 rounded-lg p-8 md:p-12 my-6 shadow-lg text-center relative overflow-hidden"
      style={{ borderColor: primaryColor, background: `${primaryColor}10` }}>
      {/* Barra decorativa arriba */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: primaryColor }} />

      <div className="text-4xl mb-3">🔒</div>
      <div className="text-xs uppercase tracking-widest font-bold mb-2"
        style={{ color: primaryColor }}>
        Contenido para suscriptores
      </div>
      <h3 className="font-serif text-2xl md:text-3xl font-bold mb-3 max-w-xl mx-auto">{title}</h3>
      <p className="text-black/70 mb-6 max-w-lg mx-auto">{message}</p>
      <a href={ctaHref}
        className="inline-block px-8 py-3 rounded font-semibold text-white transition hover:opacity-90"
        style={{ background: primaryColor }}>
        {ctaLabel}
      </a>
      <div className="text-xs text-black/50 mt-4">
        ¿Ya sos suscriptor? <a href="/login" className="underline hover:text-black">Iniciar sesión</a>
      </div>
    </div>
  );
}
