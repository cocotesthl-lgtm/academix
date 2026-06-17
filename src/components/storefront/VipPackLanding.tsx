import { CouponInput } from './CouponInput';
import type { CheckoutConfig } from '@/lib/checkout/types';

export type VipMediaItem = {
  id: string;
  type: 'image' | 'video' | 'audio' | 'embed';
  url: string;
  title?: string;
  description?: string;
};

type CoursePackDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  price_cents: number;
  currency: string;
  pack_description: string | null;
  preview_url: string | null;
};

/**
 * Landing para product_type='vip_pack'.
 *
 * Dos estados:
 *  - 🔒 Bloqueado: muestra preview (1-6 items blureados) + CTA "Desbloquear contenido"
 *  - 🔓 Desbloqueado: galería completa, todo el contenido visible
 *
 * El comprador paga → MP webhook crea enrollment → isUnlocked=true.
 */
export function VipPackLanding({
  course,
  mediaItems,
  isUnlocked,
  buyerEmail,
  primary,
  checkoutConfig
}: {
  tenantId: string;
  course: CoursePackDetail;
  mediaItems: VipMediaItem[];
  isUnlocked: boolean;
  buyerEmail: string;
  primary: string;
  checkoutConfig: CheckoutConfig;
}) {
  const previewCover = course.preview_url || course.cover_url;
  const itemCount = mediaItems.length;
  const imageCount = mediaItems.filter((i) => i.type === 'image').length;
  const videoCount = mediaItems.filter((i) => i.type === 'video').length;
  const audioCount = mediaItems.filter((i) => i.type === 'audio').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-black text-white">
      {/* Cover */}
      <div className="relative h-[40vh] min-h-[280px] max-h-[420px] overflow-hidden">
        {previewCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewCover} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}88)` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black" />
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-10 max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded"
              style={{ background: primary, color: 'white' }}>
              🔒 Contenido VIP
            </span>
            {isUnlocked && (
              <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded bg-emerald-500 text-white">
                🔓 Desbloqueado
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{course.title}</h1>
          {course.description && (
            <p className="mt-3 text-white/80 text-base md:text-lg max-w-2xl">{course.description}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-white/70">
            <span>📦 {itemCount} items</span>
            {imageCount > 0 && <span>🖼 {imageCount} imágenes</span>}
            {videoCount > 0 && <span>🎬 {videoCount} videos</span>}
            {audioCount > 0 && <span>🎵 {audioCount} audios</span>}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-8">
        {/* Gallery / Preview */}
        <div className="md:col-span-2 space-y-6">
          {course.pack_description && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <h2 className="font-semibold mb-2">📋 Sobre este pack</h2>
              <p className="text-white/75 whitespace-pre-line">{course.pack_description}</p>
            </div>
          )}

          <div>
            <h2 className="font-semibold mb-3">
              {isUnlocked ? '🔓 Contenido completo' : '🔒 Vista previa'}
            </h2>

            {itemCount === 0 ? (
              <p className="text-white/40 text-sm">El creador todavía no agregó contenido.</p>
            ) : isUnlocked ? (
              <UnlockedGallery items={mediaItems} primary={primary} />
            ) : (
              <LockedPreview items={mediaItems} primary={primary} />
            )}
          </div>
        </div>

        {/* Sticky CTA panel */}
        <aside className="md:sticky md:top-6 self-start space-y-4">
          {isUnlocked ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <div className="text-3xl mb-2">✅</div>
              <h3 className="font-bold">Ya tenés acceso</h3>
              <p className="text-sm text-white/70 mt-1">
                Disfrutá del contenido completo. El acceso es permanente.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/15 bg-white/[0.03] p-5 space-y-4">
              <div>
                <div className="text-sm text-white/55 mb-1">Precio del pack</div>
                <div className="text-3xl font-bold">
                  {course.price_cents === 0
                    ? 'Gratis'
                    : `$ ${(course.price_cents / 100).toLocaleString('es-AR')}`}
                  {course.price_cents > 0 && (
                    <span className="text-base font-normal text-white/55 ml-1">{course.currency}</span>
                  )}
                </div>
                <p className="text-xs text-white/55 mt-2">Pago único · Acceso permanente</p>
              </div>

              <CouponInput
                courseId={course.id}
                priceCents={course.price_cents}
                currency={course.currency}
                primary={primary}
                defaultEmail={buyerEmail}
                checkoutConfig={checkoutConfig}
                buyLabel="🔓 Desbloquear contenido"
                freeLabel="Acceder gratis"
              />

              <p className="text-[10px] text-white/40 text-center">
                💳 Pago seguro con Mercado Pago. Acceso inmediato post-pago.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function UnlockedGallery({ items, primary }: { items: VipMediaItem[]; primary: string }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg overflow-hidden border border-white/10 bg-black/40 group">
          {item.type === 'image' && (
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.title ?? ''} className="w-full aspect-square object-cover group-hover:opacity-90 transition" />
            </a>
          )}
          {item.type === 'video' && <VideoEmbed url={item.url} />}
          {item.type === 'audio' && (
            <div className="p-4 flex flex-col items-center gap-2">
              <div className="text-4xl">🎵</div>
              <audio controls src={item.url} className="w-full" />
            </div>
          )}
          {item.type === 'embed' && <VideoEmbed url={item.url} />}
          {(item.title || item.description) && (
            <div className="p-2">
              {item.title && <div className="text-xs font-medium truncate">{item.title}</div>}
              {item.description && <div className="text-[10px] text-white/55 line-clamp-2">{item.description}</div>}
            </div>
          )}
          <span className="hidden" style={{ color: primary }}>.</span>
        </div>
      ))}
    </div>
  );
}

function LockedPreview({ items, primary }: { items: VipMediaItem[]; primary: string }) {
  const teaser = items.slice(0, 6);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 relative">
      {teaser.map((item) => (
        <div key={item.id} className="rounded-lg overflow-hidden border border-white/10 bg-black/40 relative aspect-square">
          {item.type === 'image' && item.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt="" className="w-full h-full object-cover blur-2xl scale-110" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl text-white/40"
              style={{ background: `linear-gradient(135deg, ${primary}22, ${primary}11)` }}>
              {item.type === 'video' ? '🎬' : item.type === 'audio' ? '🎵' : '🔗'}
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="text-2xl">🔒</span>
          </div>
        </div>
      ))}
      {items.length > 6 && (
        <div className="rounded-lg border border-white/15 bg-white/5 flex items-center justify-center aspect-square text-white/65 font-bold text-2xl">
          +{items.length - 6}
        </div>
      )}
    </div>
  );
}

function VideoEmbed({ url }: { url: string }) {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{8,})/);
  const drv = url.match(/\/file\/d\/([\w-]{15,})/);
  const src = yt ? `https://www.youtube.com/embed/${yt[1]}`
    : drv ? `https://drive.google.com/file/d/${drv[1]}/preview`
    : url;
  return (
    <div className="aspect-video bg-black">
      <iframe src={src} className="w-full h-full" allowFullScreen title="VIP video" />
    </div>
  );
}
