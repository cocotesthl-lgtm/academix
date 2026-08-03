import Link from 'next/link';

export type AdKind = 'banner' | 'rectangle' | 'square' | 'skyscraper';

export type AdSlotProps = {
  kind: AdKind;
  imageUrl?: string;
  linkUrl?: string;
  alt?: string;
  /** Label opcional que muestra arriba del ad. Default: "PUBLICIDAD" */
  label?: string;
  /** Cuando true no renderiza el ad (útil para "toggle" desde config) */
  disabled?: boolean;
};

/**
 * Componente universal para slots de publicidad.
 *
 * Tamaños IAB estándar (aspect ratios):
 *   - banner       : 728x90     (leaderboard, aspect 8:1)
 *   - rectangle    : 300x250    (medium rectangle, aspect 6:5)
 *   - square       : 250x250    (aspect 1:1)
 *   - skyscraper   : 160x600    (aspect 4:15, sidebar tall)
 *
 * Si no viene imageUrl, renderiza placeholder gris con label —
 * pensado para que el owner vea dónde van los ads sin haber puesto
 * los suyos todavía. Reemplazar por network real (AdSense/GAM) es
 * un cambio localizado a este componente.
 */
export function AdSlot({
  kind,
  imageUrl,
  linkUrl,
  alt,
  label = 'Publicidad',
  disabled
}: AdSlotProps) {
  if (disabled) return null;

  const dims = KIND_DIMENSIONS[kind];

  const inner = imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt={alt ?? label} className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full bg-black/[0.04] border border-dashed border-black/20 flex items-center justify-center text-black/40 text-xs uppercase tracking-widest">
      Anuncio {kind}
    </div>
  );

  const content = (
    <div className="mx-auto" style={{ maxWidth: dims.maxWidthPx }}>
      <div className="text-center text-[10px] uppercase tracking-widest text-black/45 mb-1.5">
        {label}
      </div>
      <div className="w-full" style={{ aspectRatio: dims.aspect }}>
        {linkUrl && imageUrl ? (
          <a href={linkUrl} target="_blank" rel="noopener noreferrer sponsored" className="block w-full h-full">
            {inner}
          </a>
        ) : (
          inner
        )}
      </div>
    </div>
  );

  return <aside className="my-6">{content}</aside>;
}

const KIND_DIMENSIONS: Record<AdKind, { aspect: string; maxWidthPx: number }> = {
  banner:     { aspect: '728 / 90',  maxWidthPx: 728 },
  rectangle:  { aspect: '300 / 250', maxWidthPx: 300 },
  square:     { aspect: '1 / 1',     maxWidthPx: 300 },
  skyscraper: { aspect: '160 / 600', maxWidthPx: 300 }
};

export type AdConfig = {
  image_url?: string | null;
  link_url?: string | null;
  alt?: string | null;
  expires_at?: string | null;
};

/** true si el ad tiene fecha de expiración y ya pasó. */
export function isAdExpired(ad?: AdConfig | null): boolean {
  if (!ad?.expires_at) return false;
  const d = new Date(ad.expires_at);
  if (isNaN(d.getTime())) return false;
  // Comparamos con fin del día para incluir el día de expiración
  d.setHours(23, 59, 59, 999);
  return d.getTime() < Date.now();
}

/** Escapa para atributos HTML (previene inyección al inyectar image_url/link_url). */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Placeholder rectangle pequeño para insertar dentro del body_html
 * como string (via dangerouslySetInnerHTML). No usa componente React
 * porque el body ya viene como HTML crudo del artículo.
 *
 * Si el owner configuró un `ad` real (image_url), renderiza esa imagen
 * como link. Sino cae al placeholder gris "Anuncio banner".
 */
export function inlineAdHtml(
  kind: Extract<AdKind, 'banner' | 'rectangle'>,
  ad?: AdConfig | null
): string {
  const dims = KIND_DIMENSIONS[kind];
  const expired = isAdExpired(ad);
  const hasReal = !!ad?.image_url && !expired;

  const inner = hasReal
    ? `<img src="${esc(ad!.image_url!)}" alt="${esc(ad!.alt ?? '')}" style="width:100%;height:100%;object-fit:cover;display:block" />`
    : `<div style="width:100%;height:100%;background:rgba(0,0,0,0.04);border:1px dashed rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;color:rgba(0,0,0,0.4);font-size:11px;text-transform:uppercase;letter-spacing:0.1em">Anuncio ${kind}</div>`;

  const wrapped = hasReal && ad?.link_url
    ? `<a href="${esc(ad.link_url)}" target="_blank" rel="noopener noreferrer sponsored" style="display:block;width:100%;height:100%">${inner}</a>`
    : inner;

  return `<aside style="margin:32px auto;max-width:${dims.maxWidthPx}px;">
    <div style="text-align:center;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(0,0,0,0.45);margin-bottom:6px">Publicidad</div>
    <div style="width:100%;aspect-ratio:${dims.aspect};overflow:hidden">${wrapped}</div>
  </aside>`;
}

/** Pair de 2 squares lado a lado — para insertar debajo del share/antes de "Seguir leyendo". */
export function AdSquaresPair({ square1, square2 }: { square1?: AdConfig | null; square2?: AdConfig | null } = {}) {
  return (
    <div className="my-6">
      <div className="text-center text-[10px] uppercase tracking-widest text-black/45 mb-2">
        Publicidad
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-[620px] mx-auto">
        <SquareItem ad={square1} placeholder="Anuncio 1" />
        <SquareItem ad={square2} placeholder="Anuncio 2" />
      </div>
    </div>
  );
}

function SquareItem({ ad, placeholder }: { ad?: AdConfig | null; placeholder: string }) {
  const expired = isAdExpired(ad);
  const hasReal = !!ad?.image_url && !expired;
  const body = hasReal ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={ad!.image_url!} alt={ad!.alt ?? ''} className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full bg-black/[0.04] border border-dashed border-black/20 flex items-center justify-center text-black/40 text-xs uppercase tracking-widest">
      {placeholder}
    </div>
  );
  return (
    <div className="aspect-square overflow-hidden">
      {hasReal && ad?.link_url ? (
        <a href={ad.link_url} target="_blank" rel="noopener noreferrer sponsored" className="block w-full h-full">{body}</a>
      ) : body}
    </div>
  );
}

/**
 * ↳ Cuando quieras cambiar el look, es 100% aquí. Si el owner
 * conecta un ad network real, este archivo es el único punto donde
 * hay que insertar el `<script>` tag del network provider.
 */
export { Link };
