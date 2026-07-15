'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createCourseAction, type Result } from '@/lib/courses/actions';
import { PRODUCT_TYPES, type ProductType } from '@/lib/courses/product-types';
import { getTemplatesForType, type OfferTemplate } from '@/lib/courses/templates/offer-templates';
import { ALL_MODULES_ON, type Modules } from '@/lib/modules/types';
import { ProductTypeMockup } from './ProductTypeMockup';

/**
 * Wizard 2-pasos para crear un producto.
 * Paso 1 (visual): elegir qué se vende. Esto setea defaults inteligentes
 * (landing template, calendar mode, content labels, pricing mode).
 * Paso 1.5 (opcional): elegir una plantilla pre-armada o empezar en blanco.
 * Paso 2: título + precio + descripción opcional. Placeholders adaptados.
 *
 * Cuando llega ?type=xxx (desde Mis ofertas → "+ Nuevo"), skippeamos el
 * type-picker y arrancamos mostrando sólo las plantillas para ese tipo,
 * con un link chico "cambiar tipo" para volver al picker completo.
 */
export function NewCourseForm({ modules = ALL_MODULES_ON }: { modules?: Modules }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Filtrar tipos por módulos activos. Si el owner apagó 'ecommerce', no
  // aparece 'physical'; si apagó 'events', no aparece 'event', etc. Siempre
  // dejamos al menos uno (fallback a courses hardcodeado).
  const visibleTypes = PRODUCT_TYPES.filter((p) => modules[p.moduleKey] !== false);
  // Prefill por ?type= (usado por los shortcuts "+ Nuevo" de Mis ofertas).
  // Sólo aceptamos el hint si el tipo está en la lista visible; si no,
  // caemos al primero disponible.
  const hintedType = searchParams.get('type');
  const matchedHint = visibleTypes.find((p) => p.id === hintedType);
  const initialType = (matchedHint?.id ?? visibleTypes[0]?.id ?? 'course') as ProductType;
  const [type, setType] = useState<ProductType>(initialType);
  const [template, setTemplate] = useState<OfferTemplate | null>(null);
  // Con hint válido arrancamos escondiendo el type-picker → el owner ya
  // "sabe" qué está creando; sólo tiene que elegir plantilla o blanco.
  // Sin hint (usuario entró a /courses/new suelto) mostramos el picker.
  const [showTypePicker, setShowTypePicker] = useState<boolean>(!matchedHint);
  const [step, setStep] = useState<1 | 2>(() => {
    // Si el hint apunta a un tipo SIN plantillas, saltear el paso 1 y
    // dejarlos directo en el form vacío del paso 2 — nada que elegir.
    if (matchedHint && getTemplatesForType(initialType).length === 0) return 2;
    return 1;
  });
  const [state, action, pending] = useActionState<Result<{ id: string }> | null, FormData>(
    createCourseAction,
    null
  );

  const templatesForType = getTemplatesForType(type);

  useEffect(() => {
    if (state?.ok && state.data?.id) {
      router.push(`/courses/${state.data.id}`);
    }
  }, [state, router]);

  const spec = PRODUCT_TYPES.find((p) => p.id === type) ?? PRODUCT_TYPES[0];

  // Si el tipo actual tiene createHref (ej: physical → /products/new),
  // el botón "Siguiente" del step 1 nos manda ahí en vez de al step 2.
  // El resto del formulario ya no aplica: el flujo lo maneja el otro form.
  function handleNext() {
    if (spec.createHref) {
      router.push(spec.createHref);
      return;
    }
    setStep(2);
  }

  if (step === 1) {
    return (
      <div className="space-y-5 max-w-4xl">
        {showTypePicker ? (
          <>
            <div>
              <div className="text-xs uppercase tracking-wider text-white/40 mb-1">Paso 1 de 2</div>
              <h2 className="text-xl font-semibold">¿Qué vas a vender?</h2>
              <p className="text-sm text-white/55 mt-1">
                Elegí el tipo y configuramos la página, el checkout y las etiquetas por vos.
                Después podés editar todo si querés.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleTypes.map((p) => {
                const selected = type === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setType(p.id); setTemplate(null); }}
                    className={`text-left rounded-xl border p-4 transition flex flex-col gap-3 ${
                      selected
                        ? 'border-white bg-white/10 ring-1 ring-white/30'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.05]'
                    }`}
                  >
                    {/* Mockup visual de cómo se ve la oferta cuando el comprador la abre */}
                    <div className="-mx-1 -mt-1">
                      <ProductTypeMockup type={p.id} />
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="text-2xl leading-none mt-0.5">{p.emoji}</div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                          {p.label}
                          {selected && (
                            <span className="text-[10px] uppercase tracking-wide bg-white text-black px-1.5 py-0.5 rounded">
                              elegido
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/55 mt-1 leading-snug">{p.short}</p>
                        <p className="text-[10px] text-white/35 mt-2 leading-snug italic">{p.examples}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          // Modo focused: llegamos con ?type= y ya sabemos qué se está creando.
          // Header compacto con el tipo + link para volver al picker completo.
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-wider text-white/40 mb-1">Paso 1 de 2</div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <span>{spec.emoji}</span>
                <span>Elegí una plantilla para: {spec.label}</span>
              </h2>
              <p className="text-sm text-white/55 mt-1">
                Cargamos título, descripción y precio de ejemplo. Podés editar todo antes de guardar.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowTypePicker(true)}
              className="text-xs text-white/55 hover:text-white underline mt-1"
            >
              ← Cambiar tipo
            </button>
          </div>
        )}

        {/* ─── Plantilla pre-armada para ese tipo ─── */}
        {templatesForType.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-sm font-semibold text-white/90 flex items-center gap-2">
                  <span>🎁</span> Empezá con una plantilla
                </div>
                <p className="text-xs text-white/50 mt-0.5">
                  Te pre-llenamos título, descripción y precio con un ejemplo realista. Editás todo después.
                </p>
              </div>
              {template && (
                <button type="button" onClick={() => setTemplate(null)}
                  className="text-xs text-white/55 hover:text-white underline">
                  Empezar en blanco
                </button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templatesForType.map((tpl) => {
                const active = template?.id === tpl.id;
                return (
                  <button key={tpl.id} type="button" onClick={() => setTemplate(tpl)}
                    className={`text-left rounded-lg border overflow-hidden transition ${
                      active
                        ? 'border-white bg-white/10 ring-1 ring-white/30'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                    }`}>
                    {tpl.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={tpl.coverUrl} alt="" className="w-full h-24 object-cover" />
                    )}
                    <div className="p-3">
                      <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                        {tpl.name}
                        {active && <span className="text-[9px] uppercase bg-white text-black px-1 py-0.5 rounded">elegida</span>}
                      </div>
                      <p className="text-[11px] text-white/55 mt-1 leading-snug">{tpl.shortDesc}</p>
                      <p className="text-[10px] text-white/40 mt-1.5 font-mono">
                        {tpl.priceArs > 0 ? `ARS ${tpl.priceArs.toLocaleString('es-AR')}` : 'Gratis'}
                      </p>
                    </div>
                  </button>
                );
              })}
              {/* Tarjeta "en blanco" */}
              <button type="button" onClick={() => setTemplate(null)}
                className={`text-left rounded-lg border-2 border-dashed p-4 transition flex flex-col items-center justify-center text-center min-h-[140px] ${
                  template === null
                    ? 'border-white/40 bg-white/5'
                    : 'border-white/10 hover:border-white/25 bg-white/[0.01]'
                }`}>
                <div className="text-2xl mb-1">✨</div>
                <div className="text-xs font-semibold text-white/85">Empezar en blanco</div>
                <p className="text-[10px] text-white/45 mt-1">Form vacío, lo armás vos.</p>
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleNext}
            className="rounded-md bg-white text-black px-6 py-2.5 font-semibold hover:bg-white/90 transition"
          >
            {spec.createHref ? 'Ir al form de producto físico →' : 'Siguiente →'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5 max-w-xl" key={template?.id ?? 'blank'}>
      <input type="hidden" name="product_type" value={type} />
      {template?.coverUrl && <input type="hidden" name="cover_url" value={template.coverUrl} />}

      <div>
        <div className="text-xs uppercase tracking-wider text-white/40 mb-1">Paso 2 de 2</div>
        <h2 className="text-xl font-semibold">Datos básicos</h2>
        <p className="text-sm text-white/55 mt-1 flex items-center gap-1.5 flex-wrap">
          <span>{spec.emoji}</span>
          <span>{spec.label}</span>
          {template && (
            <span className="text-[10px] uppercase tracking-wide bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
              plantilla: {template.name}
            </span>
          )}
          <button type="button" onClick={() => setStep(1)} className="text-white/45 hover:text-white text-xs underline ml-2">
            cambiar
          </button>
        </p>
      </div>

      <div>
        <label className="block text-sm mb-1.5 text-white/70">Título</label>
        <input
          name="title"
          required
          maxLength={140}
          placeholder={titlePlaceholderFor(type)}
          defaultValue={template?.title ?? ''}
          className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
        />
      </div>

      <div>
        <label className="block text-sm mb-1.5 text-white/70">Descripción corta <span className="text-white/35">(opcional)</span></label>
        <textarea
          name="description"
          rows={3}
          maxLength={500}
          placeholder={descPlaceholderFor(type)}
          defaultValue={template?.description ?? ''}
          className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1.5 text-white/70">Precio</label>
          <input
            name="price"
            type="number"
            min="0"
            step="1"
            defaultValue={String(template?.priceArs ?? 0)}
            className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
          />
        </div>
        <div>
          <label className="block text-sm mb-1.5 text-white/70">Moneda</label>
          <select
            name="currency"
            defaultValue="ARS"
            className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-white/60 space-y-1">
        <div className="font-semibold text-white/80">Te vamos a preconfigurar:</div>
        <div>• Plantilla de landing: <strong>{landingLabel(spec.landingTemplate)}</strong></div>
        {spec.calendarMode !== 'none' && (
          <div>• Calendario: <strong>{spec.calendarMode === 'date' ? 'fecha del evento' : 'slot puntual'}</strong></div>
        )}
        {spec.pricingMode === 'subscription' && (
          <div>• Cobro: <strong>suscripción recurrente</strong></div>
        )}
        <div>• Sección de contenido: <strong>{spec.showContentSection ? `"${spec.contentTitle}"` : 'oculta'}</strong></div>
        <div className="pt-1 text-white/40">Todo se puede editar después.</div>
      </div>

      {state?.ok === false && (
        <div className="rounded-md bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-3 py-2">
          {state.error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="text-sm text-white/55 hover:text-white"
        >
          ← Volver
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-white text-black px-6 py-2.5 font-semibold hover:bg-white/90 transition disabled:opacity-50"
        >
          {pending ? 'Creando…' : 'Crear oferta'}
        </button>
      </div>
    </form>
  );
}

function titlePlaceholderFor(t: ProductType): string {
  switch (t) {
    case 'course':     return 'UX Research desde cero';
    case 'event':      return 'Workshop presencial sábado 18hs';
    case 'mentorship': return 'Coaching de carrera — 1hr';
    case 'vip_pack':   return 'Pack Premium — Acceso total';
    case 'digital':    return 'Notion template Productividad Pro';
    case 'physical':   return 'Remera edición limitada';
    case 'service':     return 'Logo + branding completo';
    case 'multi_venue': return 'Experiencia de tiro al blanco';
    case 'restaurant':  return 'La Parrilla del Centro';
    case 'topup':       return 'Carga de saldo $1000';
  }
}

function descPlaceholderFor(t: ProductType): string {
  switch (t) {
    case 'course':      return 'Lo que el alumno va a aprender en una frase corta.';
    case 'event':       return 'Lugar, hora y qué va a pasar en el evento.';
    case 'mentorship':  return 'A quién le sirve esta mentoría y qué se llevan.';
    case 'vip_pack':    return 'Qué contenido exclusivo van a recibir.';
    case 'digital':     return 'Qué resuelve el producto, en una línea.';
    case 'physical':    return 'Características del producto físico.';
    case 'service':     return 'El servicio que ofrecés y a quién está dirigido.';
    case 'multi_venue': return 'Qué experiencia van a vivir + en qué sedes está disponible.';
    case 'restaurant':  return 'Tipo de cocina, horarios y ambiente.';
    case 'topup':       return 'Para qué sirve el saldo y dónde lo pueden usar.';
  }
}

function landingLabel(t: 'classic' | 'hotmart' | 'funnel' | 'vsl'): string {
  switch (t) {
    case 'classic': return 'Clásica';
    case 'hotmart': return 'Hotmart (con sidebar de compra)';
    case 'funnel':  return 'Funnel (direct response)';
    case 'vsl':     return 'VSL (video gated)';
  }
}
