'use client';

import { useActionState, useState, useEffect } from 'react';
import { updateEmailBrandingAction, type BrandingResult } from '@/lib/branding/actions';
import { showToast } from './ToastBus';

/**
 * Form para personalizar los emails que sale a los compradores.
 *
 * 3 inputs URL-only + 1 textarea:
 *  - Header image URL (banner top)
 *  - Banner image URL (strip mid-email, ej sponsors)
 *  - Footer message (texto libre, soporta \n para saltos)
 *
 * Live preview a la derecha mostrando un ejemplo de email.
 */

export function EmailBrandingForm({
  initialHeader,
  initialBanner,
  initialFooter,
  brandColor,
  brandName,
  logoUrl
}: {
  initialHeader: string;
  initialBanner: string;
  initialFooter: string;
  brandColor: string;
  brandName: string;
  logoUrl?: string;
}) {
  const [state, formAction, pending] = useActionState<BrandingResult | null, FormData>(
    updateEmailBrandingAction,
    null
  );
  const [header, setHeader] = useState(initialHeader);
  const [banner, setBanner] = useState(initialBanner);
  const [footer, setFooter] = useState(initialFooter);

  useEffect(() => {
    if (!state) return;
    if (state.ok) showToast('Cambios guardados', 'success');
    else showToast(state.error, 'error', 4500);
  }, [state]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* ── Form ── */}
      <form action={formAction} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Banner superior (URL)</label>
          <input
            type="url"
            name="email_header_image_url"
            value={header}
            onChange={(e) => setHeader(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
          />
          <p className="text-[11px] text-white/45 mt-1">
            Aparece arriba del email, ancho completo. Ideal 1200×400px.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Banner medio (URL)</label>
          <input
            type="url"
            name="email_banner_image_url"
            value={banner}
            onChange={(e) => setBanner(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
          />
          <p className="text-[11px] text-white/45 mt-1">
            Strip entre el contenido y el footer. Bueno para sponsors o promos.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Mensaje de footer</label>
          <textarea
            name="email_footer_message"
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Seguinos: @miacademia · WhatsApp +54 9 11..."
            className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40 font-mono"
          />
          <p className="text-[11px] text-white/45 mt-1">
            Texto libre. Saltos de línea se respetan. {footer.length}/500
          </p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90 disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Guardar'}
        </button>

        {state?.ok && (
          <p className="text-xs text-emerald-300">✓ Guardado. Los próximos emails usan estos cambios.</p>
        )}
        {state && !state.ok && (
          <p className="text-xs text-rose-300">✗ {state.error}</p>
        )}
      </form>

      {/* ── Preview ── */}
      <div className="lg:sticky lg:top-4 self-start">
        <div className="text-[10px] uppercase tracking-wider text-white/45 mb-2">
          Vista previa
        </div>
        <div className="rounded-xl border border-white/10 bg-[#f5f5f7] p-4 overflow-hidden">
          <div className="bg-white rounded-lg overflow-hidden text-black text-xs shadow-sm max-w-[400px] mx-auto">
            {header && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={header} alt="" className="w-full h-auto block"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <div className="p-4 border-b border-black/10 text-center" style={{ background: brandColor }}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={brandName} className="h-7 mx-auto" />
              ) : (
                <div className="text-white font-bold text-sm">{brandName}</div>
              )}
            </div>
            <div className="p-4">
              <p className="font-semibold mb-1">¡Hola Juan! 🎫</p>
              <p className="text-black/65 leading-relaxed">
                Tus 2 tickets para <strong>Tu Evento</strong> están confirmados.
              </p>
            </div>
            {banner && (
              <div className="px-4 pb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={banner} alt="" className="w-full h-auto block rounded"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
            {footer && (
              <div className="px-4 py-3 border-t border-black/10 text-center text-black/70 whitespace-pre-line">
                {footer}
              </div>
            )}
            <div className="px-4 py-2 border-t border-black/10 bg-black/[0.03] text-center text-[10px] text-black/50">
              Enviado por <strong>{brandName}</strong> a través de Curplat.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
