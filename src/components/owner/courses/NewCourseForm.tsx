'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCourseAction, type Result } from '@/lib/courses/actions';
import { PRODUCT_TYPES, type ProductType } from '@/lib/courses/product-types';

/**
 * Wizard 2-pasos para crear un producto.
 * Paso 1 (visual): elegir qué se vende. Esto setea defaults inteligentes
 * (landing template, calendar mode, content labels, pricing mode).
 * Paso 2: título + precio + descripción opcional. Placeholders adaptados.
 */
export function NewCourseForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<ProductType>('course');
  const [state, action, pending] = useActionState<Result<{ id: string }> | null, FormData>(
    createCourseAction,
    null
  );

  useEffect(() => {
    if (state?.ok && state.data?.id) {
      router.push(`/courses/${state.data.id}`);
    }
  }, [state, router]);

  const spec = PRODUCT_TYPES.find((p) => p.id === type) ?? PRODUCT_TYPES[0];

  if (step === 1) {
    return (
      <div className="space-y-5 max-w-4xl">
        <div>
          <div className="text-xs uppercase tracking-wider text-white/40 mb-1">Paso 1 de 2</div>
          <h2 className="text-xl font-semibold">¿Qué vas a vender?</h2>
          <p className="text-sm text-white/55 mt-1">
            Elegí el tipo y configuramos la página, el checkout y las etiquetas por vos.
            Después podés editar todo si querés.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PRODUCT_TYPES.map((p) => {
            const selected = type === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setType(p.id)}
                className={`text-left rounded-xl border p-4 transition ${
                  selected
                    ? 'border-white bg-white/10'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl leading-none mt-0.5">{p.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm flex items-center gap-2">
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

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="rounded-md bg-white text-black px-6 py-2.5 font-semibold hover:bg-white/90 transition"
          >
            Siguiente →
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5 max-w-xl">
      <input type="hidden" name="product_type" value={type} />

      <div>
        <div className="text-xs uppercase tracking-wider text-white/40 mb-1">Paso 2 de 2</div>
        <h2 className="text-xl font-semibold">Datos básicos</h2>
        <p className="text-sm text-white/55 mt-1 flex items-center gap-1.5">
          <span>{spec.emoji}</span>
          <span>{spec.label}</span>
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
            defaultValue="0"
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
