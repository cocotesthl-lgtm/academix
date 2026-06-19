'use client';

import type { LandingTemplate } from '@/lib/courses/landing';

/**
 * Mini-mockup CSS-only del layout de cada plantilla. Sirve como preview
 * visual rápida en el picker antes de elegir una. ~120×80px.
 */
export function TemplateMockup({ template, primary }: {
  template: LandingTemplate;
  primary?: string;
}) {
  const accent = primary ?? '#a855f7';

  if (template === 'classic') {
    // 2 columnas: contenido + sidebar precio
    return (
      <svg viewBox="0 0 120 80" className="w-full h-auto rounded border border-white/10 bg-white/[0.06]">
        <rect x="6" y="6" width="68" height="6" rx="1.5" fill="#fff" opacity="0.85" />
        <rect x="6" y="16" width="50" height="3" rx="1" fill="#fff" opacity="0.4" />
        <rect x="6" y="22" width="58" height="3" rx="1" fill="#fff" opacity="0.4" />
        <rect x="6" y="32" width="68" height="36" rx="2" fill="#fff" opacity="0.08" stroke="#fff" strokeOpacity="0.18" />
        <rect x="10" y="38" width="32" height="3" rx="1" fill="#fff" opacity="0.5" />
        <rect x="10" y="44" width="46" height="3" rx="1" fill="#fff" opacity="0.3" />
        <rect x="10" y="50" width="46" height="3" rx="1" fill="#fff" opacity="0.3" />
        <rect x="10" y="56" width="40" height="3" rx="1" fill="#fff" opacity="0.3" />
        {/* Sidebar */}
        <rect x="80" y="6" width="34" height="50" rx="2" fill="#fff" opacity="0.1" stroke="#fff" strokeOpacity="0.2" />
        <rect x="84" y="12" width="20" height="5" rx="1" fill="#fff" />
        <rect x="84" y="22" width="26" height="10" rx="1.5" fill={accent} />
      </svg>
    );
  }

  if (template === 'hotmart') {
    // Banner grande arriba + bullets + sidebar precio sticky
    return (
      <svg viewBox="0 0 120 80" className="w-full h-auto rounded border border-white/10 bg-white/[0.06]">
        <rect x="6" y="6" width="108" height="20" rx="2" fill={accent} opacity="0.85" />
        <rect x="10" y="12" width="60" height="4" rx="1" fill="#fff" />
        <rect x="10" y="19" width="40" height="3" rx="1" fill="#fff" opacity="0.7" />
        {/* Bullets */}
        <circle cx="10" cy="34" r="1.5" fill="#fff" opacity="0.7" />
        <rect x="14" y="32" width="50" height="3" rx="1" fill="#fff" opacity="0.5" />
        <circle cx="10" cy="42" r="1.5" fill="#fff" opacity="0.7" />
        <rect x="14" y="40" width="58" height="3" rx="1" fill="#fff" opacity="0.5" />
        <circle cx="10" cy="50" r="1.5" fill="#fff" opacity="0.7" />
        <rect x="14" y="48" width="46" height="3" rx="1" fill="#fff" opacity="0.5" />
        <circle cx="10" cy="58" r="1.5" fill="#fff" opacity="0.7" />
        <rect x="14" y="56" width="56" height="3" rx="1" fill="#fff" opacity="0.5" />
        {/* Sidebar sticky */}
        <rect x="80" y="30" width="34" height="42" rx="2" fill="#fff" opacity="0.12" stroke="#fff" strokeOpacity="0.25" />
        <rect x="84" y="36" width="20" height="5" rx="1" fill="#fff" />
        <rect x="84" y="46" width="26" height="9" rx="1.5" fill={accent} />
        <rect x="84" y="60" width="18" height="3" rx="1" fill="#fff" opacity="0.4" />
      </svg>
    );
  }

  if (template === 'funnel') {
    // Largo: video grande + bonos + countdown + multi CTA
    return (
      <svg viewBox="0 0 120 80" className="w-full h-auto rounded border border-white/10 bg-white/[0.06]">
        <rect x="6" y="6" width="108" height="22" rx="2" fill="#000" opacity="0.55" />
        <polygon points="56,12 56,22 66,17" fill="#fff" opacity="0.85" />
        {/* Bonus stack */}
        <rect x="6" y="32" width="34" height="18" rx="2" fill="#fff" opacity="0.1" stroke="#fff" strokeOpacity="0.2" />
        <rect x="44" y="32" width="34" height="18" rx="2" fill="#fff" opacity="0.1" stroke="#fff" strokeOpacity="0.2" />
        <rect x="82" y="32" width="32" height="18" rx="2" fill={accent} opacity="0.3" stroke={accent} />
        <rect x="10" y="38" width="20" height="3" rx="1" fill="#fff" opacity="0.6" />
        <rect x="48" y="38" width="20" height="3" rx="1" fill="#fff" opacity="0.6" />
        <rect x="86" y="38" width="20" height="3" rx="1" fill="#fff" opacity="0.8" />
        {/* CTA grande con countdown */}
        <rect x="6" y="56" width="108" height="16" rx="2" fill={accent} />
        <rect x="38" y="62" width="44" height="4" rx="1" fill="#fff" />
      </svg>
    );
  }

  // VSL: video pantalla completa + form que aparece
  return (
    <svg viewBox="0 0 120 80" className="w-full h-auto rounded border border-white/10 bg-white/[0.06]">
      <rect x="6" y="6" width="108" height="50" rx="2" fill="#000" opacity="0.75" />
      <polygon points="56,24 56,38 70,31" fill="#fff" opacity="0.9" />
      <rect x="48" y="44" width="24" height="2" rx="1" fill="#fff" opacity="0.5" />
      <rect x="6" y="60" width="108" height="12" rx="2" fill="#fff" opacity="0.08" stroke="#fff" strokeOpacity="0.2" />
      <rect x="10" y="64" width="40" height="4" rx="1" fill="#fff" opacity="0.5" />
      <rect x="86" y="63" width="24" height="6" rx="1.5" fill={accent} />
    </svg>
  );
}
