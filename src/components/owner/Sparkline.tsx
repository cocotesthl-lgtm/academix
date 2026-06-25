/**
 * Sparkline inline SVG — sin lib, render server-side.
 * Usado en KPIs del dashboard para mostrar trend de los últimos N días.
 *
 * El input es un array de números (uno por día). El componente lo
 * normaliza al alto disponible y dibuja una línea + área debajo.
 */

export function Sparkline({
  values,
  width = 120,
  height = 32,
  color = '#f97316',
  className = ''
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  if (values.length === 0) {
    return <div style={{ width, height }} className={className} />;
  }
  if (values.length === 1) {
    // 1 punto = línea horizontal al medio
    return (
      <svg width={width} height={height} className={className}>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeWidth="1.5" />
      </svg>
    );
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const padY = 2;
  const usableH = height - padY * 2;

  const step = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = padY + usableH - ((v - min) / range) * usableH;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${width.toFixed(1)} ${height} L 0 ${height} Z`;

  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-${color.replace('#', '')})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
