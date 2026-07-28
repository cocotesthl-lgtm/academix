'use client';

import { useEffect, useRef, useState } from 'react';

type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

/**
 * Wrapper que anima su children cuando entra en el viewport.
 *
 * - Usa IntersectionObserver — dispara UNA sola vez para que el usuario que
 *   scrollea de vuelta no vea la animación repetida.
 * - Respeta `prefers-reduced-motion`: si el user lo pidió, se salta la
 *   animación y muestra el contenido visible inmediatamente.
 * - No requiere JS post-hidratación para el layout — el `<span className>`
 *   con `contents` no genera stacking context ni afecta grids/flex.
 *
 * Props:
 *   dir      → dirección desde la que aparece (default 'up')
 *   delay    → ms de delay antes del start (default 0)
 *   duration → ms de duración (default 700)
 *   distance → px de desplazamiento inicial (default 24)
 */
export function Reveal({
  children,
  dir = 'up',
  delay = 0,
  duration = 700,
  distance = 24,
  className = '',
  id,
  as: Tag = 'div'
}: {
  children: React.ReactNode;
  dir?: Direction;
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
  id?: string;
  as?: 'div' | 'section' | 'article' | 'span';
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    // prefers-reduced-motion: leemos al montar
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);

    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -80px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const initialTransform =
    dir === 'up' ? `translate3d(0, ${distance}px, 0)`
    : dir === 'down' ? `translate3d(0, -${distance}px, 0)`
    : dir === 'left' ? `translate3d(${distance}px, 0, 0)`
    : dir === 'right' ? `translate3d(-${distance}px, 0, 0)`
    : 'none';

  const style: React.CSSProperties = reduced
    ? { opacity: 1, transform: 'none' }
    : {
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : initialTransform,
        transition: `opacity ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        willChange: 'opacity, transform'
      };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component: any = Tag;
  return (
    <Component ref={ref} id={id} className={className} style={style}>
      {children}
    </Component>
  );
}
