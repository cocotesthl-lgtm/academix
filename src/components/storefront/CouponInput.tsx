'use client';

import { useState } from 'react';
import type { CheckoutConfig, CheckoutField } from '@/lib/checkout/types';
import { DEFAULT_CHECKOUT_CONFIG, parseOption, deltaToCents } from '@/lib/checkout/types';
import type { BookingSlot, CalendarMode } from '@/lib/calendar/types';
import { CalendarPicker } from './CalendarPicker';

/**
 * Form de compra. Renderiza dinámicamente los campos según `checkoutConfig`:
 *  - base_fields enabled → name/dni/phone/location (toggleables + required configurable)
 *  - extra_fields → campos custom del owner (text/email/tel/textarea/select/checkbox/date/number)
 * Email + password siempre se piden cuando el comprador no está logueado
 * (son necesarios para crear su cuenta y darle acceso al publicación).
 *
 * El form sigue siendo POST nativo para que funcione sin JS y para que MP
 * pueda redirigir con 303.
 */
export function CouponInput({
  courseId,
  priceCents,
  currency,
  primary,
  freeLabel = 'Inscribirme gratis',
  buyLabel = 'Continuar al pago',
  defaultEmail = '',
  checkoutConfig,
  calendarMode = 'none',
  calendarLabel = null,
  calendarRequired = true,
  calendarSlots,
  paymentMode = 'none',
  depositPercent = 30,
  ctaText = 'Comprar publicación',
  venues = [],
  isReservation = false,
  walletBonus = null
}: {
  courseId: string;
  priceCents: number;
  currency: string;
  primary: string;
  freeLabel?: string;
  buyLabel?: string;
  defaultEmail?: string;
  checkoutConfig?: CheckoutConfig;
  calendarMode?: CalendarMode;
  calendarLabel?: string | null;
  calendarRequired?: boolean;
  calendarSlots?: BookingSlot[];
  paymentMode?: 'none' | 'deposit' | 'full' | 'choice';
  depositPercent?: number;
  /** CTA basado en product_type — ej "Comprar entrada", "Reservar mentoría". */
  ctaText?: string;
  /** Si el producto tiene sedes vinculadas, las mostramos como selector. */
  venues?: Array<{ id: string; name: string; address: string | null }>;
  /** Si el producto es multi_venue/restaurant, pedimos fecha + hora + personas. */
  isReservation?: boolean;
  /** Bonus de saldo que gana el buyer al comprar (App Saldos). */
  walletBonus?: { cents: number; symbol: string; label: string; logoUrl?: string | null } | null;
}) {
  const cfg = checkoutConfig ?? DEFAULT_CHECKOUT_CONFIG;
  const [showCoupon, setShowCoupon] = useState(false);
  const [code, setCode] = useState('');
  const [expanded, setExpanded] = useState(false);

  const [name, setName] = useState('');
  const [dni, setDni] = useState('');
  const [location, setLocation] = useState('');
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');

  // Estado de los campos extra custom. Map { fieldId → string|boolean }.
  // Inicializamos extras con default_checked para checkboxes que vienen pre-tildados.
  const [extras, setExtras] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {};
    for (const f of cfg.extra_fields) {
      if (f.type === 'checkbox' && f.default_checked) init[f.id] = true;
    }
    return init;
  });
  // Suma de price_delta de:
  //  - checkbox tildados (price_delta_cents del field)
  //  - radio: la opción seleccionada (sufijo |+5000 en la opción)
  //  - multi: cada opción seleccionada (idem)
  const addonsCents = cfg.extra_fields.reduce((sum, f) => {
    if (f.type === 'checkbox') {
      if (extras[f.id] !== true) return sum;
      const pct = f.price_delta_pct ?? 0;
      const fixed = f.price_delta_cents ?? 0;
      return sum + (pct !== 0 ? Math.round(priceCents * pct) : fixed);
    }
    if (f.type === 'radio') {
      const v = (extras[f.id] as string) ?? '';
      if (!v) return sum;
      return sum + deltaToCents(parseOption(v), priceCents);
    }
    if (f.type === 'multi') {
      const csv = (extras[f.id] as string) ?? '';
      if (!csv) return sum;
      return csv.split(',').map((s) => s.trim()).filter(Boolean)
        .reduce((s2, opt) => s2 + deltaToCents(parseOption(opt), priceCents), sum);
    }
    return sum;
  }, 0);
  const setExtra = (id: string, v: string | boolean) =>
    setExtras((s) => ({ ...s, [id]: v }));

  const isFree = priceCents === 0;
  const isLoggedIn = defaultEmail.length > 0;
  const passwordOk = isLoggedIn || (password.length >= 6 && password === password2);

  // Selector de pago: total vs seña — sólo si paymentMode='choice'
  const [paymentChoice, setPaymentChoice] = useState<'full' | 'deposit'>(
    paymentMode === 'deposit' ? 'deposit' : 'full'
  );

  // Props venues/isReservation se mantienen para compat pero ya no auto-renderean
  // campos. El owner usa el form builder personalizado para sede + reserva.
  void venues; void isReservation;
  const depositCents = Math.round((priceCents * depositPercent) / 100);
  const fmt = (c: number) => `$${(c / 100).toLocaleString('es-AR')} ${currency}`;
  // Cuánto va a cobrar realmente:
  const basePayCents = paymentMode === 'none' ? priceCents
    : paymentMode === 'full' ? priceCents
    : paymentMode === 'deposit' ? depositCents
    : (paymentChoice === 'full' ? priceCents : depositCents);
  // El total efectivo incluye los addons sumados sólo si el cliente paga total
  // (o ningún modo de pago activo). Si paga seña, los addons NO se prorratean
  // — quedan para el pago en el lugar.
  const isPayingFull = paymentMode === 'none' || paymentMode === 'full' || (paymentMode === 'choice' && paymentChoice === 'full');
  const effectiveChargeCents = isPayingFull ? basePayCents + addonsCents : basePayCents;

  const baseValid =
    (!cfg.base_fields.name.enabled     || !cfg.base_fields.name.required     || name.trim().length >= 3) &&
    (!cfg.base_fields.dni.enabled      || !cfg.base_fields.dni.required      || dni.trim().length >= 6) &&
    (!cfg.base_fields.phone.enabled    || !cfg.base_fields.phone.required    || phone.trim().length >= 6) &&
    (!cfg.base_fields.location.enabled || !cfg.base_fields.location.required || location.trim().length >= 2);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const extrasValid = cfg.extra_fields.every((f) => {
    if (f.type === 'heading') return true; // heading no es input
    if (!f.required) return true;
    const v = extras[f.id];
    if (f.type === 'checkbox') return v === true;
    return typeof v === 'string' && v.trim().length > 0;
  });
  const dataReady = baseValid && emailValid && passwordOk && extrasValid;

  return (
    <form
      action={`/api/checkout/${courseId}`}
      method="post"
      className="space-y-3"
      onSubmit={(e) => {
        // Safety net: bloqueamos el submit si el form de buyer info no está
        // expandido o no está completo. Sin esto, Enter en el cupón saltaba
        // directo a MP sin pedir buyer info.
        if (!isFree && (!expanded || !dataReady)) {
          e.preventDefault();
          if (!expanded) setExpanded(true);
        }
      }}
    >
      {/* Bonus wallet: al comprar este producto, el buyer gana saldo en su
          wallet del sitio. Sirve como incentivo de conversión — ML/Amazon
          hacen algo parecido con "puntos". Solo se muestra si el owner
          configuró wallet_bonus_cents > 0 y la app Saldos está activa. */}
      {walletBonus && walletBonus.cents > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">
          {walletBonus.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={walletBonus.logoUrl} alt={walletBonus.label} className="w-5 h-5 rounded object-cover shrink-0" />
          ) : (
            <span className="text-lg leading-none">🎁</span>
          )}
          <div className="min-w-0 text-emerald-900 dark:text-emerald-100">
            Ganás <strong className="font-mono">
              {walletBonus.symbol} {(walletBonus.cents / 100).toLocaleString('es-AR')} {walletBonus.label}
            </strong> en tu saldo al comprar
          </div>
        </div>
      )}

      {/* Publicación gratis: botón directo (no se piden datos extra; se asume user_id) */}
      {isFree && (
        <button
          type="submit"
          className="w-full rounded-md py-3 font-semibold text-white"
          style={{ background: `var(--brand-bg, ${primary})` }}
        >
          {freeLabel}
        </button>
      )}

      {/* Publicación pago: botón para expandir el form. Cuando payment_mode='choice',
          mostramos 2 botones (total + seña) para que el cliente decida desde
          afuera, sin tener que abrir un menú adentro del form. */}
      {!isFree && !expanded && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => { setPaymentChoice('full'); setExpanded(true); }}
            className="w-full rounded-md py-3 font-semibold text-white"
            style={{ background: `var(--brand-bg, ${primary})` }}
          >
            {ctaText} · ${(priceCents / 100).toLocaleString('es-AR')} {currency}
          </button>

          {(paymentMode === 'choice' || paymentMode === 'deposit') && priceCents > 0 && (
            <button
              type="button"
              onClick={() => { setPaymentChoice('deposit'); setExpanded(true); }}
              className="w-full rounded-md py-2.5 text-sm font-semibold border-2 hover:bg-black/[0.04] transition"
              style={{ borderColor: primary, color: primary }}
            >
              🪙 Reservar bajo seña · ${(depositCents / 100).toLocaleString('es-AR')} {currency} <span className="font-normal opacity-70">({depositPercent}%)</span>
            </button>
          )}
        </div>
      )}

      {!isFree && expanded && (
        <div className="space-y-3 rounded-lg border border-black/15 bg-black/[0.02] p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-sm">Datos para la inscripción</h3>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-xs text-black/40 hover:text-black/70"
            >
              ✕
            </button>
          </div>

          {/* ── Resumen del pago elegido (siempre cuando hay monto > 0 y modo activo) ── */}
          {paymentMode !== 'none' && priceCents > 0 && (
            <div className="rounded-lg border border-black/15 bg-white p-3 text-sm">
              {paymentChoice === 'full' ? (
                <>
                  <div className="font-semibold">💵 Pago total: {fmt(priceCents)}</div>
                  <div className="text-[11px] text-black/55 mt-0.5">Pagás ahora vía MercadoPago. Quedás sin saldo pendiente.</div>
                </>
              ) : (
                <>
                  <div className="font-semibold">🪙 Seña: {fmt(depositCents)} <span className="font-normal text-black/55">({depositPercent}% de {fmt(priceCents)})</span></div>
                  <div className="text-[11px] text-black/55 mt-0.5">El resto ({fmt(priceCents - depositCents)}) lo pagás en el lugar.</div>
                </>
              )}
              {paymentMode === 'choice' && (
                <button type="button"
                  onClick={() => setPaymentChoice(paymentChoice === 'full' ? 'deposit' : 'full')}
                  className="text-[11px] text-black/55 hover:text-black underline mt-1.5">
                  ↔ cambiar a {paymentChoice === 'full' ? 'pagar seña' : 'pagar total'}
                </button>
              )}
            </div>
          )}

          {/* ─── Campos base ─── */}
          {cfg.base_fields.name.enabled && (
            <BaseInput
              label="Nombre y apellido"
              required={cfg.base_fields.name.required}
              name="buyer_name"
              type="text"
              value={name}
              onChange={setName}
              maxLength={120}
              placeholder="Ej: Juan Pérez"
            />
          )}

          {(cfg.base_fields.dni.enabled || cfg.base_fields.phone.enabled) && (
            <div className="grid grid-cols-2 gap-2">
              {cfg.base_fields.dni.enabled && (
                <BaseInput
                  label="DNI / Documento"
                  required={cfg.base_fields.dni.required}
                  name="buyer_dni"
                  type="text"
                  inputMode="numeric"
                  value={dni}
                  onChange={(v) => setDni(v.replace(/\s/g, ''))}
                  maxLength={20}
                  placeholder="Ej: 30123456"
                />
              )}
              {cfg.base_fields.phone.enabled && (
                <BaseInput
                  label="Celular"
                  required={cfg.base_fields.phone.required}
                  name="buyer_phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={setPhone}
                  maxLength={30}
                  placeholder="+54 9 11 5555-5555"
                />
              )}
            </div>
          )}

          {cfg.base_fields.location.enabled && (
            <BaseInput
              label="Ubicación"
              required={cfg.base_fields.location.required}
              name="buyer_location"
              type="text"
              value={location}
              onChange={setLocation}
              maxLength={120}
              placeholder="Ciudad / Provincia / País"
            />
          )}

          {/* ─── Email siempre on ─── */}
          <BaseInput
            label="Email"
            required={true}
            name="buyer_email"
            type="email"
            value={email}
            onChange={setEmail}
            maxLength={200}
            placeholder="vos@email.com"
          />

          {/* ─── Campos extra custom ─── */}
          {cfg.extra_fields.map((f) => (
            <ExtraInput
              key={f.id}
              field={f}
              value={extras[f.id]}
              onChange={(v) => setExtra(f.id, v)}
            />
          ))}

          {/* ─── Calendario ─── */}
          {calendarMode !== 'none' && (
            <CalendarPicker
              mode={calendarMode}
              label={calendarLabel ?? (calendarMode === 'start_date' ? '¿Cuándo querés empezar?' : 'Elegí tu sesión')}
              required={calendarRequired}
              primary={primary}
              slots={calendarSlots}
            />
          )}

          {/* ─── Password si no está logueado ─── */}
          {!isLoggedIn && (
            <>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/10">
                <BaseInput
                  label="Contraseña"
                  required={true}
                  name="buyer_password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  minLength={6}
                  maxLength={120}
                  placeholder="Mínimo 6 caracteres"
                />
                <BaseInput
                  label="Repetir contraseña"
                  required={true}
                  type="password"
                  value={password2}
                  onChange={setPassword2}
                  minLength={6}
                  maxLength={120}
                  placeholder="Repetir"
                />
              </div>
              <p className="text-[11px] text-black/55">
                🔐 Vamos a crear tu cuenta con estos datos. Con ese email y contraseña
                vas a poder entrar siempre a ver tus publicaciones. Si ya tenés cuenta acá,
                usá la misma contraseña y te logueamos directo.
              </p>
            </>
          )}

          <p className="text-[11px] text-black/45 leading-snug">
            Vamos a usar estos datos sólo para inscribirte, enviarte el acceso al publicación
            y contactarte si hace falta. No los compartimos con terceros.
          </p>

          {/* Hidden input con la elección de pago (la UI ya está arriba del form) */}
          {paymentMode !== 'none' && (
            <input type="hidden" name="payment_choice" value={
              paymentMode === 'choice' ? paymentChoice : paymentMode === 'deposit' ? 'deposit' : 'full'
            } />
          )}
          {/* Hidden con suma de addons (checkbox con price_delta_cents tildados).
              El server REvalida igual leyendo cfg.extra_fields, esto es solo UX. */}
          {addonsCents !== 0 && (
            <input type="hidden" name="addons_total_cents" value={String(addonsCents)} />
          )}

          <button
            type="submit"
            disabled={!dataReady}
            className="w-full rounded-md py-3 font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: `var(--brand-bg, ${primary})` }}
          >
            {ctaText} · ${(effectiveChargeCents / 100).toLocaleString('es-AR')} {currency}
          </button>
          {!dataReady && (
            <p className="text-[11px] text-amber-700 text-center">
              {!isLoggedIn && password.length > 0 && password !== password2
                ? 'Las contraseñas no coinciden.'
                : !isLoggedIn && password.length > 0 && password.length < 6
                  ? 'La contraseña tiene que tener al menos 6 caracteres.'
                  : 'Completá los campos obligatorios para continuar.'}
            </p>
          )}
        </div>
      )}

      {/* Cupón siempre disponible */}
      {!showCoupon ? (
        <button
          type="button"
          onClick={() => setShowCoupon(true)}
          className="w-full text-xs text-black/50 hover:text-black/80 underline"
        >
          ¿Tenés un código de descuento?
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            name="coupon"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            // Bloquear Enter para que no submita el form sin buyer info
            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
            placeholder="CÓDIGO"
            className="flex-1 rounded border border-black/15 px-3 py-2 text-sm font-mono uppercase"
          />
          <button
            type="button"
            onClick={() => { setShowCoupon(false); setCode(''); }}
            className="text-xs text-black/40 hover:text-black/60"
          >
            ✕
          </button>
        </div>
      )}
    </form>
  );
}

/* ─────────── Sub-componentes ─────────── */

function BaseInput({
  label, required, name, type, value, onChange, maxLength, minLength,
  placeholder, inputMode
}: {
  label: string;
  required: boolean;
  name?: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  minLength?: number;
  placeholder?: string;
  inputMode?: 'numeric' | 'tel' | 'email' | 'text';
}) {
  return (
    <div>
      <label className="block text-xs text-black/60 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        minLength={minLength}
        placeholder={placeholder}
        className="w-full rounded border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black/40"
      />
    </div>
  );
}

function ExtraInput({
  field, value, onChange
}: {
  field: CheckoutField;
  value: string | boolean | undefined;
  onChange: (v: string | boolean) => void;
}) {
  // El campo va al backend como `extra_${key}` para que NO colisione con
  // los campos base buyer_*.
  const inputName = `extra_${field.key}`;
  const reqStar = field.required && <span className="text-red-500"> *</span>;
  const helper = field.helper && <p className="text-[10px] text-black/45 mt-1">{field.helper}</p>;

  if (field.type === 'heading') {
    // No input, sólo título visual entre secciones del form
    return (
      <div className="pt-3 pb-1 border-t border-black/10 first:border-t-0 first:pt-0">
        <div className="text-sm font-bold text-black">{field.label}</div>
        {field.helper && <p className="text-xs text-black/55 mt-0.5">{field.helper}</p>}
      </div>
    );
  }

  if (field.type === 'checkbox') {
    const pct = field.price_delta_pct ?? 0;
    const fixed = field.price_delta_cents ?? 0;
    const isPct = pct !== 0;
    const delta = isPct ? 0 : fixed;            // sólo para el texto fijo
    const hasDelta = isPct || delta !== 0;
    const sign = isPct ? (pct > 0 ? '+' : '') : (delta > 0 ? '+' : '');
    const positive = isPct ? pct > 0 : delta > 0;
    return (
      <label className={`flex items-start gap-3 rounded-md border p-3 text-sm cursor-pointer transition ${
        value === true ? 'border-black bg-black/[0.04]' : 'border-black/15 hover:border-black/40'
      }`}>
        <input
          name={inputName}
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          value="on"
          required={field.required}
          className="mt-0.5 w-4 h-4 accent-black"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{field.label}{reqStar}</span>
            {hasDelta && (
              <span className={`text-xs font-bold whitespace-nowrap ${positive ? 'text-emerald-700' : 'text-rose-700'}`}>
                {isPct
                  ? `${sign}${(pct * 100).toLocaleString('es-AR')}%`
                  : `${sign}$${(delta / 100).toLocaleString('es-AR')}`}
              </span>
            )}
          </div>
          {field.helper && <div className="text-[11px] text-black/55 mt-0.5">{field.helper}</div>}
        </div>
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        <label className="block text-xs text-black/60 mb-1">{field.label}{reqStar}</label>
        <textarea
          name={inputName}
          required={field.required}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          maxLength={1000}
          placeholder={field.placeholder}
          rows={3}
          className="w-full rounded border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black/40"
        />
        {helper}
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div>
        <label className="block text-xs text-black/60 mb-1">{field.label}{reqStar}</label>
        <select
          name={inputName}
          required={field.required}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black/40"
        >
          <option value="">{field.placeholder ?? 'Elegí una opción…'}</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        {helper}
      </div>
    );
  }

  if (field.type === 'radio') {
    const current = (value as string) ?? '';
    const opts = field.options ?? [];
    return (
      <div>
        <label className="block text-sm font-semibold text-black mb-2">{field.label}{reqStar}</label>
        {opts.length === 0 ? (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
            ⚠️ Este campo radio no tiene opciones cargadas. Andá al panel y agregale opciones separadas por coma.
          </div>
        ) : (
          <div className="space-y-2">
            {opts.map((o) => {
              const parsed = parseOption(o);
              return (
                <label key={o}
                  className={`flex items-center gap-3 rounded-md border-2 px-3 py-2.5 text-sm cursor-pointer transition ${
                    current === o ? 'border-black bg-black/[0.04]' : 'border-black/15 hover:border-black/40'
                  }`}>
                  <input
                    name={inputName}
                    type="radio"
                    value={o}
                    checked={current === o}
                    onChange={() => onChange(o)}
                    required={field.required}
                    className="w-4 h-4 accent-black"
                  />
                  <span className="font-medium flex-1">{parsed.label}</span>
                  {(parsed.deltaCents !== 0 || parsed.deltaPct !== 0) && (
                    <span className={`text-xs font-bold whitespace-nowrap ${(parsed.deltaPct || parsed.deltaCents) > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {parsed.deltaPct !== 0
                        ? `${parsed.deltaPct > 0 ? '+' : ''}${(parsed.deltaPct * 100).toLocaleString('es-AR')}%`
                        : `${parsed.deltaCents > 0 ? '+' : ''}$${(parsed.deltaCents / 100).toLocaleString('es-AR')}`}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}
        {helper}
      </div>
    );
  }

  if (field.type === 'multi') {
    const selected = new Set(((value as string) ?? '').split(',').map((s) => s.trim()).filter(Boolean));
    function toggle(o: string) {
      const next = new Set(selected);
      if (next.has(o)) next.delete(o); else next.add(o);
      onChange(Array.from(next).join(','));
    }
    const opts = field.options ?? [];
    return (
      <div>
        <label className="block text-sm font-semibold text-black mb-2">{field.label}{reqStar}</label>
        {opts.length === 0 ? (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
            ⚠️ Este campo múltiple no tiene opciones cargadas.
          </div>
        ) : (
          <div className="space-y-2">
            {opts.map((o) => {
              const parsed = parseOption(o);
              return (
                <label key={o}
                  className={`flex items-center gap-3 rounded-md border-2 px-3 py-2.5 text-sm cursor-pointer transition ${
                    selected.has(o) ? 'border-black bg-black/[0.04]' : 'border-black/15 hover:border-black/40'
                  }`}>
                  <input
                    type="checkbox"
                    checked={selected.has(o)}
                    onChange={() => toggle(o)}
                    className="w-4 h-4 accent-black"
                  />
                  <span className="font-medium flex-1">{parsed.label}</span>
                  {(parsed.deltaCents !== 0 || parsed.deltaPct !== 0) && (
                    <span className={`text-xs font-bold whitespace-nowrap ${(parsed.deltaPct || parsed.deltaCents) > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {parsed.deltaPct !== 0
                        ? `${parsed.deltaPct > 0 ? '+' : ''}${(parsed.deltaPct * 100).toLocaleString('es-AR')}%`
                        : `${parsed.deltaCents > 0 ? '+' : ''}$${(parsed.deltaCents / 100).toLocaleString('es-AR')}`}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}
        <input type="hidden" name={inputName} value={(value as string) ?? ''} />
        {helper}
      </div>
    );
  }

  // text / email / tel / date / time / number
  const htmlType =
    field.type === 'number' ? 'number'
    : field.type === 'date' ? 'date'
    : field.type === 'time' ? 'time'
    : field.type === 'email' ? 'email'
    : field.type === 'tel' ? 'tel'
    : 'text';

  return (
    <div>
      <label className="block text-xs text-black/60 mb-1">{field.label}{reqStar}</label>
      <input
        name={inputName}
        type={htmlType}
        required={field.required}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        maxLength={200}
        placeholder={field.placeholder}
        className="w-full rounded border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black/40"
      />
      {helper}
    </div>
  );
}
