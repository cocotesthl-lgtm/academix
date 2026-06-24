/**
 * Loading skeleton del panel owner.
 * Next.js lo renderiza automáticamente mientras la nueva page
 * se está bloqueando en data fetching server-side. El layout
 * (sidebar) sigue visible — sólo el contenido principal muestra esto.
 *
 * Sin esto, el usuario clickea un link y la UI queda "muerta" con el
 * contenido viejo hasta que llega la nueva. Con esto: feedback inmediato.
 */
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3 text-white/55">
        <div className="w-10 h-10 rounded-full border-2 border-white/15 border-t-white animate-spin" />
        <div className="text-xs uppercase tracking-widest">Cargando…</div>
      </div>
    </div>
  );
}
