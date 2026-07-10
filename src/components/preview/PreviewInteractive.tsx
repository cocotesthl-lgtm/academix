'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import type { SiteConfig } from '@/lib/site/types';
import type { DemoContent, DemoItem } from '@/lib/site/templates/demo-content';

/**
 * Preview interactivo de un template. Renderea un sitio full-page realista
 * con productos/servicios de muestra + navegación anclada + interacciones
 * (add to cart toast, click en item abre modal detalle, forms muestran
 * mensaje de éxito en modo demo).
 */
export function PreviewInteractive({
  templateId, templateName, templateEmoji, primary, config, content,
  embedded = false
}: {
  templateId: string;
  templateName: string;
  templateEmoji: string;
  primary: string;
  config: SiteConfig;
  content: DemoContent | null;
  /**
   * true = preview embebido en el iframe del onboarding.
   * Oculta la barra "Demo" con el CTA "Usar este template" (que va a
   * /signup) porque el user YA está en el onboarding y elige el template
   * desde la columna izquierda. También oculta el CTA repetido más abajo.
   */
  embedded?: boolean;
}) {
  const [selected, setSelected] = useState<DemoItem | null>(null);
  const [cat, setCat] = useState<string>('Todos');
  const [toast, setToast] = useState<string | null>(null);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const heroCfg = config.sections.hero;
  const contactCfg = config.sections.contact;
  const aboutCfg = config.sections.about;
  const newsletterCfg = config.sections.newsletter;
  const featuresCfg = config.sections.features;
  const ctaFinalCfg = config.sections.cta_final;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  function handleAddToCart(item: DemoItem) {
    setCartCount((c) => c + 1);
    showToast(`✓ ${item.title} agregado al carrito (modo demo)`);
  }

  function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    setContactSubmitted(true);
    showToast('✓ Mensaje enviado (modo demo)');
  }

  function handleNewsletterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNewsletterSubmitted(true);
    showToast('✓ Suscripto (modo demo)');
  }

  const filteredItems = useMemo(() => {
    if (!content) return [];
    if (!content.categories || cat === 'Todos' || cat === 'Todo' || cat === 'Todas') return content.items;
    return content.items.filter((i) => i.category === cat);
  }, [content, cat]);

  const siteTitle = templateName;

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Barra superior — banner "En modo demo". Se oculta cuando el
          preview está embebido en el iframe del onboarding (el user ya
          está creando su sitio, no necesita el CTA "Usar este template"
          que lo saca a /signup). */}
      {!embedded && (
        <div className="sticky top-0 z-[100] bg-neutral-900 text-white px-4 py-2.5 flex items-center justify-between text-xs gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="text-white/70 hover:text-white shrink-0 flex items-center gap-1">
              ← OfferNow
            </Link>
            <span className="text-white/30">|</span>
            <span className="truncate">
              Demo · <strong className="text-white">{templateEmoji} {templateName}</strong>
            </span>
          </div>
          <Link
            href={`/signup?type=owner&template=${templateId}`}
            className="rounded-full bg-orange-500 text-white px-4 py-1.5 font-semibold hover:bg-orange-600 transition shrink-0"
          >
            Usar este template →
          </Link>
        </div>
      )}

      {/* Nav del sitio demo. Sticky offset ajustado según haya o no barra superior. */}
      <nav className={`sticky ${embedded ? 'top-0' : 'top-[38px]'} z-40 bg-white/95 backdrop-blur border-b border-neutral-200`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-lg shrink-0"
              style={{ background: primary }}>
              {templateEmoji}
            </div>
            <span className="font-bold truncate">{siteTitle}</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-neutral-700">
            {content && <a href="#items" className="hover:text-neutral-900">{content.itemsLabel}</a>}
            {aboutCfg?.enabled && <a href="#about" className="hover:text-neutral-900">Sobre nosotros</a>}
            {contactCfg?.enabled && <a href="#contact" className="hover:text-neutral-900">Contacto</a>}
          </div>
          <div className="flex items-center gap-3">
            {content?.showsPrices && (
              <button type="button" className="relative text-neutral-600 hover:text-neutral-900"
                onClick={() => showToast(cartCount > 0 ? `${cartCount} en carrito (modo demo)` : 'Carrito vacío (modo demo)')}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 text-[10px] rounded-full w-4 h-4 flex items-center justify-center text-white font-bold"
                    style={{ background: primary }}>
                    {cartCount}
                  </span>
                )}
              </button>
            )}
            <button type="button"
              onClick={() => showToast('En modo demo — el login funciona en el sitio real')}
              className="text-sm text-white px-4 py-1.5 rounded-md font-semibold hover:opacity-90"
              style={{ background: primary }}>
              {heroCfg?.cta_label || 'Empezar'}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      {heroCfg?.enabled && (
        <section className="px-6 py-20 text-center" style={{ background: `linear-gradient(135deg, ${primary}18, ${primary}05)` }}>
          <div className="max-w-4xl mx-auto">
            {(heroCfg as { eyebrow?: string }).eyebrow && (
              <p className="text-xs uppercase tracking-widest font-bold mb-3" style={{ color: primary }}>
                {(heroCfg as { eyebrow?: string }).eyebrow}
              </p>
            )}
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-neutral-900 mb-5">
              {heroCfg.title}
            </h1>
            {heroCfg.subtitle && (
              <p className="text-lg md:text-xl text-neutral-600 max-w-2xl mx-auto mb-8 leading-relaxed">
                {heroCfg.subtitle}
              </p>
            )}
            <div className="flex gap-3 justify-center flex-wrap">
              {heroCfg.cta_label && (
                <a href="#items" className="rounded-md px-6 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90 transition"
                  style={{ background: primary }}>
                  {heroCfg.cta_label}
                </a>
              )}
              {(heroCfg as { cta_label_2?: string }).cta_label_2 && (
                <a href={aboutCfg?.enabled ? '#about' : '#items'}
                  className="rounded-md border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 transition">
                  {(heroCfg as { cta_label_2?: string }).cta_label_2}
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Items — cambia según layout */}
      {content && (
        <section id="items" className="px-6 py-16 bg-white border-t border-neutral-100">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold">{content.itemsLabel}</h2>
              {content.itemsSubtitle && (
                <p className="text-neutral-600 mt-2">{content.itemsSubtitle}</p>
              )}
            </div>

            {content.categories && (
              <div className="flex gap-2 flex-wrap justify-center mb-8">
                {content.categories.map((c) => (
                  <button key={c} type="button" onClick={() => setCat(c)}
                    className={`text-sm px-3 py-1.5 rounded-full border transition ${
                      cat === c
                        ? 'text-white border-transparent'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                    }`}
                    style={cat === c ? { background: primary } : undefined}>
                    {c}
                  </button>
                ))}
              </div>
            )}

            <ItemsGrid
              layout={content.layout}
              items={filteredItems}
              ctaLabel={content.ctaLabel}
              showsPrices={content.showsPrices}
              primary={primary}
              onClick={setSelected}
              onAddToCart={handleAddToCart}
            />
          </div>
        </section>
      )}

      {/* About */}
      {aboutCfg?.enabled && (
        <section id="about" className="px-6 py-16 bg-neutral-50 border-t border-neutral-100">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{aboutCfg.title || 'Sobre nosotros'}</h2>
            {aboutCfg.body && (
              <p className="text-lg text-neutral-700 leading-relaxed">{aboutCfg.body}</p>
            )}
          </div>
        </section>
      )}

      {/* Features */}
      {featuresCfg?.enabled && (
        <section className="px-6 py-16 bg-white border-t border-neutral-100">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-10">
              {featuresCfg.title || 'Features'}
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {(featuresCfg.items || []).slice(0, 6).map((f, i) => (
                <div key={i} className="text-center">
                  <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-xl"
                    style={{ background: primary }}>
                    {f.icon || '✓'}
                  </div>
                  <div className="font-bold mb-1">{f.title}</div>
                  <div className="text-sm text-neutral-600">{f.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Newsletter */}
      {newsletterCfg?.enabled && (
        <section className="px-6 py-16 text-center border-t border-neutral-100"
          style={{ background: `linear-gradient(180deg, white, ${primary}0c)` }}>
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">{newsletterCfg.title || 'Sumate al newsletter'}</h2>
            {newsletterCfg.subtitle && (
              <p className="text-neutral-600 mb-6">{newsletterCfg.subtitle}</p>
            )}
            {newsletterSubmitted ? (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 max-w-md mx-auto">
                ✓ Listo. Vas a recibir el primer email en tu casilla.
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className="flex gap-2 max-w-md mx-auto">
                <input type="email" required placeholder="Tu email…"
                  className="flex-1 rounded-md border border-neutral-300 px-4 py-2.5 focus:outline-none focus:border-neutral-900" />
                <button type="submit"
                  className="text-white font-semibold rounded-md px-5 hover:opacity-90 transition"
                  style={{ background: primary }}>
                  Suscribirme
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      {/* Contact */}
      {contactCfg?.enabled && (
        <section id="contact" className="px-6 py-16 bg-neutral-50 border-t border-neutral-100">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">{contactCfg.title || 'Contactanos'}</h2>
            {contactCfg.subtitle && (
              <p className="text-neutral-600 mb-6">{contactCfg.subtitle}</p>
            )}
            {contactSubmitted ? (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3">
                ✓ Mensaje enviado. Te respondemos en 24hs.
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-3 text-left">
                <input required placeholder="Tu nombre"
                  className="w-full rounded-md border border-neutral-300 px-4 py-2.5 bg-white focus:outline-none focus:border-neutral-900" />
                <input type="email" required placeholder="Tu email"
                  className="w-full rounded-md border border-neutral-300 px-4 py-2.5 bg-white focus:outline-none focus:border-neutral-900" />
                <textarea required rows={4} placeholder="Tu mensaje…"
                  className="w-full rounded-md border border-neutral-300 px-4 py-2.5 bg-white focus:outline-none focus:border-neutral-900" />
                <button type="submit"
                  className="w-full text-white font-semibold rounded-md py-3 hover:opacity-90 transition"
                  style={{ background: primary }}>
                  Enviar mensaje
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      {/* CTA final */}
      {ctaFinalCfg?.enabled && (
        <section className="px-6 py-20 text-center text-white" style={{ background: primary }}>
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              {ctaFinalCfg.title || '¿Empezamos?'}
            </h2>
            {ctaFinalCfg.body && (
              <p className="text-lg mb-8 text-white/95">{ctaFinalCfg.body}</p>
            )}
            <a href="#items" className="inline-block bg-white rounded-md px-8 py-3 font-bold hover:bg-neutral-100 transition"
              style={{ color: primary }}>
              {ctaFinalCfg.cta_label || 'Empezar'}
            </a>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-neutral-900 text-neutral-400 px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-6">
          <div>
            <div className="text-white font-bold text-lg">{templateEmoji} {siteTitle}</div>
            <div className="text-sm mt-1">Sitio de demostración · hecho con OfferNow.</div>
          </div>
          <div className="text-sm">
            © 2026 — Todos los derechos reservados.
          </div>
        </div>
      </footer>

      {/* Sticky CTA final — solo cuando NO está embebido (mismo motivo
          que la barra superior: adentro del onboarding sobra el CTA
          a /signup). */}
      {!embedded && (
        <div className="sticky bottom-0 z-40 bg-white border-t border-neutral-200 px-6 py-3 flex items-center justify-between gap-4">
          <div className="text-sm truncate">
            <strong className="text-neutral-900">Te gusta lo que ves?</strong>
            <span className="text-neutral-500 hidden md:inline"> · Creá tu sitio con este template en 5 minutos.</span>
          </div>
          <Link
            href={`/signup?type=owner&template=${templateId}`}
            className="shrink-0 rounded-full bg-neutral-900 text-white px-5 py-2 font-semibold hover:bg-neutral-800 transition text-sm whitespace-nowrap"
          >
            Usar este template →
          </Link>
        </div>
      )}

      {/* Modal detalle */}
      {selected && (
        <ItemModal
          item={selected}
          primary={primary}
          ctaLabel={content?.ctaLabel ?? 'Continuar'}
          showsPrice={content?.showsPrices ?? false}
          onClose={() => setSelected(null)}
          onAction={() => {
            if (content?.showsPrices) handleAddToCart(selected);
            else showToast('En modo demo — la acción real se ejecuta en tu sitio.');
            setSelected(null);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[110] bg-neutral-900 text-white px-4 py-2.5 rounded-full shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ─────────── Grids por layout ─────────── */

function ItemsGrid({
  layout, items, ctaLabel, showsPrices, primary, onClick, onAddToCart
}: {
  layout: DemoContent['layout'];
  items: DemoItem[];
  ctaLabel: string;
  showsPrices: boolean;
  primary: string;
  onClick: (item: DemoItem) => void;
  onAddToCart: (item: DemoItem) => void;
}) {
  if (layout === 'menu') {
    return (
      <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
        {items.map((it) => (
          <button key={it.id} type="button" onClick={() => onClick(it)}
            className="flex gap-4 text-left p-4 rounded-xl border border-neutral-200 bg-white hover:border-neutral-400 hover:shadow-md transition">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.image} alt={it.title} className="w-24 h-24 rounded-lg object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-neutral-900 line-clamp-1">{it.title}</h3>
                {it.price && <span className="font-mono font-bold text-neutral-900 whitespace-nowrap">{it.price}</span>}
              </div>
              {it.description && <p className="text-sm text-neutral-600 mt-1 line-clamp-2">{it.description}</p>}
            </div>
          </button>
        ))}
      </div>
    );
  }

  if (layout === 'list') {
    return (
      <div className="max-w-3xl mx-auto space-y-3">
        {items.map((it) => (
          <div key={it.id} className="flex gap-4 p-4 rounded-xl border border-neutral-200 bg-white hover:border-neutral-400 transition">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.image} alt={it.title} className="w-24 h-24 rounded-lg object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold">{it.title}</h3>
              {it.description && <p className="text-sm text-neutral-600 mt-0.5">{it.description}</p>}
              <div className="flex items-center justify-between mt-2">
                {it.price ? (
                  <span className="font-bold" style={{ color: primary }}>{it.price}</span>
                ) : <span />}
                <button type="button" onClick={() => onClick(it)}
                  className="text-sm text-white rounded px-3 py-1.5 font-semibold hover:opacity-90"
                  style={{ background: primary }}>
                  {ctaLabel} →
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const cols = layout === 'grid-4'
    ? 'grid-cols-2 md:grid-cols-4'
    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';

  return (
    <div className={`grid ${cols} gap-5`}>
      {items.map((it) => (
        <button key={it.id} type="button" onClick={() => onClick(it)}
          className="text-left rounded-xl overflow-hidden border border-neutral-200 bg-white hover:border-neutral-400 hover:shadow-lg transition group">
          <div className="aspect-[4/3] bg-neutral-100 overflow-hidden relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.image} alt={it.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            {it.subtitle && (
              <span className="absolute top-2 left-2 text-[10px] uppercase font-bold text-white px-2 py-0.5 rounded"
                style={{ background: primary }}>
                {it.subtitle}
              </span>
            )}
          </div>
          <div className="p-4">
            {it.meta && (
              <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold mb-1.5">{it.meta}</div>
            )}
            <h3 className="font-bold mb-1 line-clamp-2">{it.title}</h3>
            {it.description && (
              <p className="text-xs text-neutral-600 line-clamp-2">{it.description}</p>
            )}
            <div className="flex items-center justify-between mt-3">
              {it.price ? (
                <span className="font-bold text-neutral-900">{it.price}</span>
              ) : <span className="text-xs font-semibold" style={{ color: primary }}>{ctaLabel} →</span>}
              {showsPrices && (
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); onAddToCart(it); }}
                  className="text-white text-xs rounded-md px-2.5 py-1.5 font-semibold hover:opacity-90"
                  style={{ background: primary }}>
                  + Agregar
                </button>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ─────────── Modal detalle ─────────── */

function ItemModal({
  item, primary, ctaLabel, showsPrice, onClose, onAction
}: {
  item: DemoItem;
  primary: string;
  ctaLabel: string;
  showsPrice: boolean;
  onClose: () => void;
  onAction: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[105] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="relative aspect-[16/9] bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
          <button type="button" onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/95 shadow flex items-center justify-center hover:bg-white">
            ×
          </button>
        </div>
        <div className="p-6">
          {item.subtitle && (
            <span className="text-[10px] uppercase font-bold text-white px-2 py-0.5 rounded"
              style={{ background: primary }}>
              {item.subtitle}
            </span>
          )}
          <h3 className="text-2xl font-bold mt-2">{item.title}</h3>
          {item.meta && <div className="text-xs text-neutral-500 mt-1">{item.meta}</div>}
          {item.description && (
            <p className="text-neutral-700 mt-4 leading-relaxed">{item.description}</p>
          )}
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-neutral-100">
            {showsPrice && item.price ? (
              <span className="text-2xl font-bold">{item.price}</span>
            ) : <span />}
            <button type="button" onClick={onAction}
              className="text-white rounded-md px-6 py-2.5 font-semibold hover:opacity-90"
              style={{ background: primary }}>
              {showsPrice ? '+ Agregar al carrito' : ctaLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
