'use client';

import type { ProductType } from '@/lib/courses/product-types';

/**
 * Mini-mockup SVG por tipo de producto. ~200×100px. Le da al owner una
 * vista previa visual de cómo se ve la oferta cuando un comprador la abre.
 *
 * Estilizado dark-mode-friendly (rectángulos con opacity y un accent color
 * para detalles). Reusable en el wizard de creación.
 */
export function ProductTypeMockup({ type, primary = '#a855f7' }: {
  type: ProductType; primary?: string;
}) {
  const common = 'w-full h-auto rounded border border-white/10 bg-white/[0.04]';

  if (type === 'course') {
    return (
      <svg viewBox="0 0 200 100" className={common}>
        <rect x="8" y="8" width="80" height="56" rx="3" fill="#000" opacity="0.6" />
        <polygon points="40,30 40,46 56,38" fill="#fff" opacity="0.85" />
        <rect x="8" y="70" width="56" height="4" rx="1" fill="#fff" opacity="0.6" />
        <rect x="8" y="78" width="40" height="3" rx="1" fill="#fff" opacity="0.35" />
        {/* Lista lecciones */}
        <rect x="96" y="10" width="96" height="8" rx="1.5" fill="#fff" opacity="0.1" />
        <rect x="100" y="13" width="20" height="2" rx="1" fill="#fff" opacity="0.6" />
        <rect x="96" y="22" width="96" height="8" rx="1.5" fill="#fff" opacity="0.1" />
        <rect x="100" y="25" width="26" height="2" rx="1" fill="#fff" opacity="0.6" />
        <rect x="96" y="34" width="96" height="8" rx="1.5" fill={primary} opacity="0.3" />
        <rect x="100" y="37" width="22" height="2" rx="1" fill="#fff" opacity="0.8" />
        <rect x="96" y="46" width="96" height="8" rx="1.5" fill="#fff" opacity="0.1" />
      </svg>
    );
  }

  if (type === 'event') {
    return (
      <svg viewBox="0 0 200 100" className={common}>
        {/* Imagen evento */}
        <rect x="8" y="8" width="184" height="44" rx="3" fill={primary} opacity="0.55" />
        <text x="100" y="34" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">CONCIERTO 2026</text>
        {/* Tickets */}
        <rect x="8" y="60" width="58" height="32" rx="3" fill="#fff" opacity="0.08" stroke="#fff" strokeOpacity="0.2" />
        <text x="37" y="74" textAnchor="middle" fontSize="6" fill="#fff" opacity="0.7">GENERAL</text>
        <text x="37" y="84" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">$5.000</text>
        <rect x="72" y="60" width="58" height="32" rx="3" fill={primary} opacity="0.3" stroke={primary} />
        <text x="101" y="74" textAnchor="middle" fontSize="6" fill="#fff" opacity="0.9">VIP</text>
        <text x="101" y="84" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">$12.000</text>
        <rect x="136" y="60" width="56" height="32" rx="3" fill="#fff" opacity="0.08" stroke="#fff" strokeOpacity="0.2" />
        <text x="164" y="74" textAnchor="middle" fontSize="6" fill="#fff" opacity="0.7">PALCO</text>
        <text x="164" y="84" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">$30.000</text>
      </svg>
    );
  }

  if (type === 'mentorship') {
    return (
      <svg viewBox="0 0 200 100" className={common}>
        {/* Avatar */}
        <circle cx="30" cy="35" r="18" fill={primary} opacity="0.5" />
        <circle cx="30" cy="30" r="6" fill="#fff" opacity="0.8" />
        <path d="M 18 50 Q 30 38 42 50" fill="#fff" opacity="0.7" />
        {/* Info */}
        <rect x="58" y="20" width="60" height="4" rx="1" fill="#fff" opacity="0.7" />
        <rect x="58" y="28" width="40" height="3" rx="1" fill="#fff" opacity="0.35" />
        <rect x="58" y="34" width="50" height="3" rx="1" fill="#fff" opacity="0.35" />
        {/* Slots */}
        <text x="8" y="72" fontSize="6" fill="#fff" opacity="0.5">ELEGÍ HORARIO</text>
        <rect x="8" y="76" width="28" height="14" rx="2" fill="#fff" opacity="0.1" stroke="#fff" strokeOpacity="0.2" />
        <text x="22" y="86" textAnchor="middle" fontSize="6" fill="#fff" opacity="0.8">09:00</text>
        <rect x="42" y="76" width="28" height="14" rx="2" fill={primary} />
        <text x="56" y="86" textAnchor="middle" fontSize="6" fontWeight="700" fill="#fff">10:00</text>
        <rect x="76" y="76" width="28" height="14" rx="2" fill="#fff" opacity="0.1" stroke="#fff" strokeOpacity="0.2" />
        <text x="90" y="86" textAnchor="middle" fontSize="6" fill="#fff" opacity="0.8">11:00</text>
        <rect x="110" y="76" width="28" height="14" rx="2" fill="#fff" opacity="0.1" stroke="#fff" strokeOpacity="0.2" />
        <text x="124" y="86" textAnchor="middle" fontSize="6" fill="#fff" opacity="0.5">12:00</text>
      </svg>
    );
  }

  if (type === 'vip_pack') {
    return (
      <svg viewBox="0 0 200 100" className={common}>
        {/* Galería 3x2 con candados */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const x = 8 + col * 64;
          const y = 8 + row * 42;
          const unlocked = i < 2;
          return (
            <g key={i}>
              <rect x={x} y={y} width={60} height={38} rx={2} fill="#000" opacity={unlocked ? 0.45 : 0.85} />
              {!unlocked && (
                <g transform={`translate(${x + 24}, ${y + 14})`}>
                  <rect x="0" y="4" width="12" height="9" rx="1" fill={primary} />
                  <path d="M 2 4 Q 2 0 6 0 Q 10 0 10 4" stroke={primary} strokeWidth="1.5" fill="none" />
                </g>
              )}
              {unlocked && (
                <circle cx={x + 30} cy={y + 19} r="3" fill="#fff" opacity="0.8" />
              )}
            </g>
          );
        })}
      </svg>
    );
  }

  if (type === 'digital') {
    return (
      <svg viewBox="0 0 200 100" className={common}>
        {/* Stack de archivos */}
        <rect x="50" y="20" width="80" height="60" rx="4" fill="#fff" opacity="0.1" />
        <rect x="56" y="14" width="80" height="60" rx="4" fill="#fff" opacity="0.18" />
        <rect x="62" y="8" width="80" height="60" rx="4" fill="#fff" opacity="0.95" />
        <rect x="68" y="16" width="48" height="3" rx="1" fill="#0a0a0a" opacity="0.7" />
        <rect x="68" y="22" width="68" height="2" rx="1" fill="#0a0a0a" opacity="0.4" />
        <rect x="68" y="28" width="68" height="2" rx="1" fill="#0a0a0a" opacity="0.4" />
        <rect x="68" y="34" width="40" height="2" rx="1" fill="#0a0a0a" opacity="0.4" />
        <text x="68" y="52" fontSize="8" fontWeight="700" fill={primary}>PDF</text>
        {/* Download arrow */}
        <g transform="translate(155, 78)">
          <circle r="14" fill={primary} />
          <path d="M -5 -3 L 0 4 L 5 -3 M 0 4 L 0 -5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  if (type === 'physical') {
    return (
      <svg viewBox="0 0 200 100" className={common}>
        {/* Caja 3D */}
        <polygon points="50,30 100,15 150,30 100,45" fill="#fff" opacity="0.25" />
        <polygon points="50,30 100,45 100,85 50,70" fill="#fff" opacity="0.4" />
        <polygon points="150,30 100,45 100,85 150,70" fill="#fff" opacity="0.55" />
        {/* Etiqueta */}
        <rect x="68" y="52" width="20" height="20" rx="1" fill={primary} opacity="0.9" />
        <rect x="71" y="58" width="14" height="2" rx="0.5" fill="#fff" />
        <rect x="71" y="62" width="10" height="2" rx="0.5" fill="#fff" />
        {/* Camión chiquito */}
        <g transform="translate(168, 80)">
          <rect x="-10" y="-6" width="14" height="6" rx="1" fill="#fff" opacity="0.7" />
          <rect x="4" y="-4" width="6" height="4" rx="0.5" fill="#fff" opacity="0.7" />
          <circle cx="-6" cy="2" r="2" fill="#fff" />
          <circle cx="6" cy="2" r="2" fill="#fff" />
        </g>
      </svg>
    );
  }

  if (type === 'service') {
    return (
      <svg viewBox="0 0 200 100" className={common}>
        {/* Lista de entregables con checks */}
        <text x="8" y="16" fontSize="7" fontWeight="700" fill="#fff" opacity="0.8">SERVICIO INCLUYE:</text>
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(8, ${24 + i * 16})`}>
            <circle cx="6" cy="6" r="5" fill={primary} opacity="0.9" />
            <path d="M 3 6 L 5 8 L 9 4" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <rect x="16" y="3" width={i === 0 ? 100 : i === 1 ? 130 : i === 2 ? 110 : 90} height="3" rx="1" fill="#fff" opacity="0.6" />
            <rect x="16" y="8" width={i === 0 ? 70 : i === 1 ? 80 : i === 2 ? 60 : 50} height="2" rx="1" fill="#fff" opacity="0.3" />
          </g>
        ))}
      </svg>
    );
  }

  if (type === 'multi_venue') {
    return (
      <svg viewBox="0 0 200 100" className={common}>
        {/* Mapa con pins */}
        <rect x="8" y="8" width="184" height="50" rx="3" fill="#fff" opacity="0.06" />
        <path d="M 8 30 Q 50 20 90 35 T 192 25" stroke="#fff" strokeOpacity="0.15" strokeWidth="1" fill="none" />
        <path d="M 8 50 Q 60 40 100 48 T 192 45" stroke="#fff" strokeOpacity="0.15" strokeWidth="1" fill="none" />
        {/* Pins */}
        <g transform="translate(40, 28)">
          <circle r="5" fill={primary} />
          <text y="2" textAnchor="middle" fontSize="6" fontWeight="700" fill="#fff">1</text>
        </g>
        <g transform="translate(100, 38)">
          <circle r="5" fill={primary} />
          <text y="2" textAnchor="middle" fontSize="6" fontWeight="700" fill="#fff">2</text>
        </g>
        <g transform="translate(160, 30)">
          <circle r="5" fill={primary} />
          <text y="2" textAnchor="middle" fontSize="6" fontWeight="700" fill="#fff">3</text>
        </g>
        {/* Slot picker */}
        <text x="8" y="72" fontSize="6" fill="#fff" opacity="0.5">SEDE PALERMO · LUN 16</text>
        <rect x="8" y="76" width="28" height="14" rx="2" fill={primary} />
        <text x="22" y="86" textAnchor="middle" fontSize="6" fontWeight="700" fill="#fff">10h</text>
        <rect x="42" y="76" width="28" height="14" rx="2" fill="#fff" opacity="0.1" stroke="#fff" strokeOpacity="0.2" />
        <text x="56" y="86" textAnchor="middle" fontSize="6" fill="#fff" opacity="0.8">11h</text>
        <rect x="76" y="76" width="28" height="14" rx="2" fill="#fff" opacity="0.1" stroke="#fff" strokeOpacity="0.2" />
        <text x="90" y="86" textAnchor="middle" fontSize="6" fill="#fff" opacity="0.8">12h</text>
        <rect x="110" y="76" width="28" height="14" rx="2" fill="#fff" opacity="0.1" stroke="#fff" strokeOpacity="0.2" />
        <text x="124" y="86" textAnchor="middle" fontSize="6" fill="#fff" opacity="0.5">13h</text>
      </svg>
    );
  }

  if (type === 'restaurant') {
    return (
      <svg viewBox="0 0 200 100" className={common}>
        {/* Card reserva */}
        <rect x="8" y="8" width="184" height="50" rx="3" fill="#fff" opacity="0.06" stroke="#fff" strokeOpacity="0.15" />
        <text x="100" y="22" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff" opacity="0.85">RESERVÁ TU MESA</text>
        <text x="100" y="34" textAnchor="middle" fontSize="6" fill="#fff" opacity="0.5">Sábado 14 jun · 21:00 hs · 4 personas</text>
        <rect x="40" y="42" width="120" height="10" rx="2" fill={primary} />
        <text x="100" y="49" textAnchor="middle" fontSize="6" fontWeight="700" fill="#fff">CONFIRMAR RESERVA</text>
        {/* Iconos cocina */}
        <text x="30" y="80" fontSize="14">🍽️</text>
        <text x="60" y="80" fontSize="14">🍷</text>
        <text x="90" y="80" fontSize="14">🥂</text>
        <text x="120" y="80" fontSize="14">🍝</text>
        <text x="150" y="80" fontSize="14">🍰</text>
      </svg>
    );
  }

  if (type === 'topup') {
    return (
      <svg viewBox="0 0 200 100" className={common}>
        {/* Wallet card */}
        <rect x="20" y="14" width="160" height="58" rx="6" fill={primary} opacity="0.85" />
        <text x="32" y="32" fontSize="6" fill="#fff" opacity="0.8" letterSpacing="1">SALDO DISPONIBLE</text>
        <text x="32" y="56" fontSize="20" fontWeight="800" fill="#fff">$ 5.000</text>
        {/* Chip */}
        <rect x="148" y="22" width="20" height="14" rx="2" fill="#fff" opacity="0.4" />
        <rect x="151" y="25" width="14" height="2" rx="0.5" fill="#fff" opacity="0.6" />
        <rect x="151" y="29" width="14" height="2" rx="0.5" fill="#fff" opacity="0.6" />
        <rect x="151" y="33" width="14" height="2" rx="0.5" fill="#fff" opacity="0.6" />
        {/* +$ */}
        <g transform="translate(178, 84)">
          <circle r="10" fill="#fff" />
          <text y="3" textAnchor="middle" fontSize="10" fontWeight="800" fill={primary}>+$</text>
        </g>
      </svg>
    );
  }

  return null;
}
