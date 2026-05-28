'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Counts up from 0 to the numeric part of `value` when the component
 * scrolls into view. Preserves prefix/suffix characters (e.g. '+', '%', '★', 'hs').
 * If no number is found, just renders the value as-is.
 */
export function AnimatedCounter({ value, color }: { value: string; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [played, setPlayed] = useState(false);
  const [current, setCurrent] = useState(0);

  // Extract first numeric run (e.g. "+2.400" → 2400)
  const match = value.match(/(-?\d{1,3}(?:[.,]\d{3})*|\d+)/);
  const numericStr = match?.[0] ?? null;
  const target = numericStr ? parseInt(numericStr.replace(/[.,]/g, ''), 10) : null;

  useEffect(() => {
    if (target === null) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !played) {
            setPlayed(true);
            const duration = 1400;
            const start = performance.now();
            const tick = (now: number) => {
              const t = Math.min(1, (now - start) / duration);
              // ease-out cubic
              const eased = 1 - Math.pow(1 - t, 3);
              setCurrent(Math.round(target * eased));
              if (t < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, played]);

  if (target === null) {
    return <div className="text-4xl font-bold" style={{ color }}>{value}</div>;
  }

  // Render: replace the matched number with the live counter, preserve surroundings
  const formattedCurrent = current.toLocaleString('es-AR');
  const rendered = value.replace(numericStr!, played ? formattedCurrent : '0');

  return (
    <div ref={ref} className="text-4xl font-bold tabular-nums" style={{ color }}>
      {rendered}
    </div>
  );
}
