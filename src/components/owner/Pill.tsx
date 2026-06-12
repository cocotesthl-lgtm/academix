/**
 * Status pill / badge unificado. Antes había 5+ implementaciones distintas
 * en cada page (StatusBadge en sales, en tickets, en enrollments, etc).
 * Esta consolida en una sola con presets semánticos.
 *
 * tone determina el color base. Pasar un `label` distinto al status si
 * querés traducir (ej. status='paid' pero label='Pagada').
 */

export type PillTone =
  | 'success'   // emerald — pagado, activo, ok
  | 'warning'   // amber — pendiente, suspendido, atención
  | 'danger'    // rose — refunded, error, cancelado
  | 'info'      // sky — informativo, en proceso
  | 'accent'    // fuchsia — destacado, premium, evento
  | 'neutral';  // white/60 — default, no aplica

const TONE_CLS: Record<PillTone, string> = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  danger:  'border-rose-500/30 bg-rose-500/10 text-rose-300',
  info:    'border-sky-500/30 bg-sky-500/10 text-sky-300',
  accent:  'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300',
  neutral: 'border-white/15 bg-white/[0.03] text-white/55'
};

export function Pill({ tone = 'neutral', children, className = '' }: {
  tone?: PillTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-block text-[11px] px-2 py-0.5 rounded border ${TONE_CLS[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** Mapea un status string conocido a su tone + label correcto. */
export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { tone: PillTone; label: string }> = {
    // Sales
    paid:       { tone: 'success', label: 'Pagada' },
    refunded:   { tone: 'danger', label: 'Reembolsada' },
    pending:    { tone: 'warning', label: 'Pendiente' },
    // Enrollments / generic
    active:     { tone: 'success', label: 'activo' },
    suspended:  { tone: 'warning', label: 'suspendido' },
    cancelled:  { tone: 'neutral', label: 'cancelado' },
    // Courses
    published:  { tone: 'success', label: 'publicado' },
    draft:      { tone: 'warning', label: 'borrador' },
    archived:   { tone: 'neutral', label: 'archivado' },
    // Tickets soporte
    open:       { tone: 'info', label: 'abierto' },
    closed:     { tone: 'neutral', label: 'cerrado' },
    // Tickets evento
    confirmed:  { tone: 'success', label: 'confirmado' }
  };
  const info = map[status] ?? { tone: 'neutral' as PillTone, label: status };
  return <Pill tone={info.tone}>{info.label}</Pill>;
}
