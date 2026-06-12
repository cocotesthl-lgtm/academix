/**
 * Bar chart inline SVG server-rendered. Sin lib externa.
 * Pensado para mostrar series tipo "ventas por día" o "tickets por evento".
 *
 * Recibe array de {label, value} y dibuja barras verticales con etiquetas
 * abajo. Tooltip en hover (CSS title attr) muestra el valor exacto.
 */

export function BarChart({
  data,
  height = 120,
  color = '#a855f7',
  formatValue = (v: number) => v.toLocaleString('es-AR'),
  emptyText = 'Sin datos en este período'
}: {
  data: Array<{ label: string; value: number; subLabel?: string }>;
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
  emptyText?: string;
}) {
  if (data.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed border-white/15 grid place-items-center text-sm text-white/40"
        style={{ height }}
      >
        {emptyText}
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          const isZero = d.value === 0;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col justify-end items-center group min-w-0"
              title={`${d.label}: ${formatValue(d.value)}${d.subLabel ? ' · ' + d.subLabel : ''}`}
            >
              <div
                className="w-full rounded-t transition-all duration-100 group-hover:opacity-80"
                style={{
                  height: isZero ? '2px' : `${Math.max(pct, 1.5)}%`,
                  background: isZero ? 'rgba(255,255,255,0.05)' : color,
                  minHeight: isZero ? '2px' : '4px'
                }}
              />
            </div>
          );
        })}
      </div>
      {/* Eje X — solo mostramos primer, medio y último label para no saturar */}
      <div className="flex items-end gap-1 mt-2 text-[10px] text-white/40">
        {data.map((d, i) => {
          const show = i === 0 || i === Math.floor(data.length / 2) || i === data.length - 1;
          return (
            <div key={i} className="flex-1 text-center min-w-0 truncate">
              {show ? d.label : ''}
            </div>
          );
        })}
      </div>
      {/* Footer total */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
        <span className="text-white/45">Total</span>
        <span className="font-mono font-semibold text-white">{formatValue(total)}</span>
      </div>
    </div>
  );
}
