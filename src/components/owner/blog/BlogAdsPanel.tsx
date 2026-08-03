'use client';

import { useState, useTransition } from 'react';
import { setBlogAdsEnabledAction, updateBlogAdSlotAction } from '@/lib/site/actions';
import type { BlogAdSlot } from '@/lib/site/types';

type SlotKey = 'banner' | 'rectangle' | 'square_1' | 'square_2';

const SLOT_META: Record<SlotKey, { label: string; desc: string; ratio: string; sample: string }> = {
  banner:     { label: 'Banner (728×90)',    desc: 'Aparece después del 2do párrafo del artículo.', ratio: '728 / 90',  sample: 'https://placehold.co/728x90/e2e8f0/64748b?text=Banner+728x90' },
  rectangle:  { label: 'Rectángulo (300×250)', desc: 'Aparece después del 5to párrafo.',             ratio: '300 / 250', sample: 'https://placehold.co/300x250/e2e8f0/64748b?text=Rectangle+300x250' },
  square_1:   { label: 'Cuadrado izquierdo (1:1)', desc: 'Aparece al final del artículo, izquierda.', ratio: '1 / 1',    sample: 'https://placehold.co/300x300/e2e8f0/64748b?text=Square+1' },
  square_2:   { label: 'Cuadrado derecho (1:1)',  desc: 'Aparece al final del artículo, derecha.',   ratio: '1 / 1',    sample: 'https://placehold.co/300x300/e2e8f0/64748b?text=Square+2' }
};

function isExpired(d?: string | null): boolean {
  if (!d) return false;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return false;
  dt.setHours(23, 59, 59, 999);
  return dt.getTime() < Date.now();
}

export function BlogAdsPanel({
  enabled,
  slots
}: {
  enabled: boolean;
  slots: Record<SlotKey, BlogAdSlot | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const configured = (Object.keys(SLOT_META) as SlotKey[])
    .filter((k) => !!slots[k]?.image_url && !isExpired(slots[k]?.expires_at)).length;
  const expiredCount = (Object.keys(SLOT_META) as SlotKey[])
    .filter((k) => !!slots[k]?.image_url && isExpired(slots[k]?.expires_at)).length;

  function toggleEnabled() {
    start(async () => {
      const fd = new FormData();
      fd.set('enabled', enabled ? 'false' : 'true');
      await setBlogAdsEnabledAction(fd);
    });
  }

  return (
    <div className={`rounded-xl border ${
      enabled ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/15 bg-white/[0.02]'
    }`}>
      <div className="p-4 flex items-start gap-3 flex-wrap">
        <div className="text-2xl leading-none">{enabled ? '📢' : '🚫'}</div>
        <div className="flex-1 min-w-[220px]">
          <div className="font-semibold text-sm">
            Publicidad del blog · {enabled ? 'activada' : 'oculta'}
          </div>
          <p className="text-xs text-white/60 mt-0.5">
            {enabled
              ? <>Slots configurados: <strong>{configured}/4</strong>. {expiredCount > 0 && <span className="text-amber-300">· {expiredCount} vencido{expiredCount === 1 ? '' : 's'}</span>} Los que no tienen imagen se muestran como placeholder gris.</>
              : 'Los slots están ocultos en todos los artículos. Ideal para blogs premium o sitios editoriales sin monetización.'}
          </p>
        </div>
        <div className="flex gap-2 self-center">
          {enabled && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-xs px-3 py-1.5 rounded border border-blue-500/40 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20 whitespace-nowrap font-semibold"
            >
              ⚙️ {open ? 'Ocultar editor' : 'Editar anuncios'}
            </button>
          )}
          <button
            type="button"
            onClick={toggleEnabled}
            disabled={pending}
            className={`text-xs px-3 py-1.5 rounded border whitespace-nowrap disabled:opacity-40 ${
              enabled
                ? 'border-white/20 bg-white/[0.05] hover:bg-white/10'
                : 'border-blue-500/40 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20 font-semibold'
            }`}
          >
            {enabled ? '🚫 Ocultar ads' : '📢 Mostrar ads'}
          </button>
        </div>
      </div>

      {open && enabled && (
        <div className="border-t border-white/10 p-4 space-y-4 bg-black/20">
          {(Object.keys(SLOT_META) as SlotKey[]).map((key) => (
            <AdSlotForm key={key} slotKey={key} initial={slots[key] ?? {}} />
          ))}
        </div>
      )}
    </div>
  );
}

function AdSlotForm({ slotKey, initial }: { slotKey: SlotKey; initial: BlogAdSlot }) {
  const meta = SLOT_META[slotKey];
  const [imageUrl, setImageUrl] = useState(initial.image_url ?? '');
  const [linkUrl, setLinkUrl] = useState(initial.link_url ?? '');
  const [alt, setAlt] = useState(initial.alt ?? '');
  const [expiresAt, setExpiresAt] = useState(initial.expires_at ?? '');
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const expired = isExpired(expiresAt);
  const configured = !!imageUrl && !expired;

  function save() {
    start(async () => {
      const fd = new FormData();
      fd.set('slot', slotKey);
      fd.set('image_url', imageUrl);
      fd.set('link_url', linkUrl);
      fd.set('alt', alt);
      fd.set('expires_at', expiresAt);
      await updateBlogAdSlotAction(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function clear() {
    setImageUrl('');
    setLinkUrl('');
    setAlt('');
    setExpiresAt('');
    start(async () => {
      const fd = new FormData();
      fd.set('slot', slotKey);
      fd.set('image_url', '');
      fd.set('link_url', '');
      fd.set('alt', '');
      fd.set('expires_at', '');
      await updateBlogAdSlotAction(fd);
    });
  }

  return (
    <div className={`rounded-lg border p-3 ${
      expired ? 'border-amber-500/40 bg-amber-500/[0.05]' :
      configured ? 'border-emerald-500/30 bg-emerald-500/[0.03]' :
      'border-white/10 bg-white/[0.02]'
    }`}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="text-sm font-semibold">
            {meta.label}
            {' '}
            <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider ${
              expired ? 'bg-amber-500/20 text-amber-200' :
              configured ? 'bg-emerald-500/20 text-emerald-200' :
              'bg-white/10 text-white/50'
            }`}>
              {expired ? '⏰ vencido' : configured ? '✓ configurado' : 'sin configurar'}
            </span>
          </div>
          <div className="text-[11px] text-white/50 mt-0.5">{meta.desc}</div>
        </div>
        <div className="flex gap-1.5">
          <button type="button" onClick={save} disabled={pending}
            className="text-xs px-3 py-1.5 rounded bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-40">
            {pending ? '…' : saved ? '✓ Guardado' : '💾 Guardar'}
          </button>
          {(imageUrl || linkUrl || alt || expiresAt) && (
            <button type="button" onClick={clear} disabled={pending}
              className="text-xs px-2 py-1.5 rounded border border-rose-500/30 text-rose-300 hover:bg-rose-500/10">
              🗑 Vaciar
            </button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {/* Form */}
        <div className="space-y-2">
          <label className="block">
            <span className="text-[10px] text-white/50 uppercase tracking-wider">URL de la imagen</span>
            <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…/anuncio.jpg"
              className="w-full mt-0.5 rounded bg-white/5 border border-white/15 px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-white/40" />
          </label>
          <label className="block">
            <span className="text-[10px] text-white/50 uppercase tracking-wider">URL del click (opcional)</span>
            <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://ejemplo.com"
              className="w-full mt-0.5 rounded bg-white/5 border border-white/15 px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-white/40" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] text-white/50 uppercase tracking-wider">Alt text</span>
              <input type="text" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={120}
                placeholder="Anunciante XYZ"
                className="w-full mt-0.5 rounded bg-white/5 border border-white/15 px-2 py-1.5 text-xs focus:outline-none focus:border-white/40" />
            </label>
            <label className="block">
              <span className="text-[10px] text-white/50 uppercase tracking-wider">
                Vence el <span className="text-white/40">(opcional)</span>
              </span>
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full mt-0.5 rounded bg-white/5 border border-white/15 px-2 py-1.5 text-xs focus:outline-none focus:border-white/40" />
            </label>
          </div>
          <p className="text-[10px] text-white/40">
            Vacío = anuncio indefinido. Si vence, se muestra el placeholder gris al buyer.
          </p>
        </div>

        {/* Preview */}
        <div>
          <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Preview</div>
          <div className="bg-white/5 rounded p-3">
            <div style={{ aspectRatio: meta.ratio }} className="w-full max-w-[280px] mx-auto overflow-hidden bg-black/30 flex items-center justify-center">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt={alt || meta.label} className="w-full h-full object-cover" />
              ) : (
                <div className="text-[10px] text-white/40 text-center px-4">
                  Sin imagen<br/>
                  <span className="text-white/30">Se muestra placeholder gris al buyer</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
