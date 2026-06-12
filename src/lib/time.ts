/**
 * Formato de tiempo relativo "hace X" para feeds y timestamps recientes.
 * Para fechas viejas (>30 días) cae a fecha absoluta corta.
 *
 * Pensado para feed de actividad / "última ventas" — la sensación de
 * "hace 5 minutos" es mucho más viva que "08/06/2026 14:32".
 */

export function relativeTime(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'recién';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'ayer';
  if (diffD < 7) return `hace ${diffD} días`;
  if (diffD < 14) return 'hace 1 semana';
  if (diffD < 30) return `hace ${Math.floor(diffD / 7)} semanas`;
  // Fechas viejas → absoluta corta
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

/** Versión absoluta legible para tooltips. */
export function absoluteTime(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-AR', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
