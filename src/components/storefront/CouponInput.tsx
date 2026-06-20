'use client';

import { useState } from 'react';
import type { CheckoutConfig, CheckoutField } from '@/lib/checkout/types';
import { DEFAULT_CHECKOUT_CONFIG } from '@/lib/checkout/types';
import type { BookingSlot, CalendarMode } from '@/lib/calendar/types';
import { CalendarPicker } from './CalendarPicker';

/**
 * Form de compra. Renderiza dinámicamente los campos según `checkoutConfig`:
 *  - base_fields enabled → name/dni/phone/location (toggleables + required configurable)
 *  - extra_fields → campos custom del owner (text/email/tel/textarea/select/checkbox/date/number)
 * Email + password siempre se piden cuando el comprador no está logueado
 * (son necesarios para crear su cuenta y darle acceso al curso).
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
  ctaText = 'Comprar curso'
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
  const [extras, setExtras] = useState<Record<string, string | boolean>>({});
  const setExtra = (id: string, v: string | boolean) =>
    setExtras((s) => ({ ...s, [id]: v }));

  const isFree = priceCents === 0;
  const isLoggedIn = defaultEmail.length > 0;
  const passwordOk = isLoggedIn || (password.length >= 6 && password === password2);

  // Selector de pago: total vs seña — sólo si paymentMode='choice'
  const [paymentChoice, setPaymentChoice] = useState<'full' | 'deposit'>(
    paymentMode === 'deposit' ? 'deposit' : 'full'
  );
  const depositCents = Math.round((priceCents * depositPercent) / 100);
  const fmt = (c: number) => `$${(c / 100).toLocaleString('es-AR')} ${currency}`;
  // Cuánto va a cobrar realmente:
  const effectiveChargeCents = paymentMode === 'none' ? priceCents
    : paymentMode === 'full' ? priceCents
    : paymentMode === 'deposit' ? depositCents
    : (paymentChoice === 'full' ? priceCents : depositCents);

  const baseValid =
    (!cfg.base_fields.name.enabled     || !cfg.base_fields.name.required     || name.trim().length >= 3) &&
    (!cfg.base_fields.dni.enabled      || !cfg.base_fields.dni.required      || dni.trim().length >= 6) &&
    (!cfg.base_fields.phone.enabled    || !cfg.base_fields.phone.required    || phone.trim().length >= 6) &&
    (!cfg.base_fields.location.enabled || !cfg.base_fields.location.required || location.trim().length >= 2);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const extrasValid = cfg.extra_fields.every((f) => {
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
      {/* Curso gratis: botón directo (no se piden datos extra; se asume user_id) */}
      {isFree && (
        <button
          type="submit"
          className="w-full rounded-md py-3 font-semibold text-white"
          style={{ background: primary }}
        >
          {freeLabel}
        </button>
      )}

      {/* Curso pago: botón para expandir el form. El monto refleja la
          elección de pago (total/seña) cuando aplica. */}
      {!isFree && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-md py-3 font-semibold text-white"
          style={{ background: primary }}
        >
          {ctaText} · ${(effectiveChargeCents / 100).toLocaleString('es-AR')} {currency}
        </button>
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

          {/* ── Selector de pago ARRIBA del form (total vs seña) ── */}
          {paymentMode === 'choice' && priceCents > 0 && (
            <div className="rounded-lg border border-black/15 p-3 space-y-2 bg-white">
              <div className="text-xs font-semibold text-black/70">¿Cómo querés pagar?</div>
              <label className={`flex items-start gap-2.5 rounded-md border p-2.5 cursor-pointer transition ${
                paymentChoice === 'full' ? 'border-black bg-black/[0.04]' : 'border-black/10 hover:border-black/30'
              }`}>
                <input type="radio" checked={paymentChoice === 'full'} onChange={() => setPaymentChoice('full')} className="mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Pagar total: {fmt(priceCents)}</div>
                  <div className="text-[11px] text-black/55">Quedás listo y sin saldo pendiente.</div>
                </div>
              </label>
              <label className={`flex items-start gap-2.5 rounded-md border p-2.5 cursor-pointer transition ${
                paymentChoice === 'deposit' ? 'border-black bg-black/[0.04]' : 'border-black/10 hover:border-black/30'
              }`}>
                <input type="radio" checked={paymentChoice === 'deposit'} onChange={() => setPaymentChoice('deposit')} className="mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Pagar seña: {fmt(depositCents)} <span className="font-normal text-black/55">({depositPercent}%)</span></div>
                  <div className="text-[11px] text-black/55">El resto ({fmt(priceCents - depositCents)}) lo pagás en el lugar.</div>
                </div>
              </label>
            </div>
          )}

          {(paymentMode === 'deposit' || paymentMode === 'full') && priceCents > 0 && (
            <div className="rounded-lg border border-black/15 bg-white p-3 text-sm">
              {paymentMode === 'full' ? (
                <>
                  <div className="font-semibold">Pago total: {fmt(priceCents)}</div>
                  <div className="text-[11px] text-black/55 mt-0.5">Pagás ahora vía MercadoPago.</div>
                </>
              ) : (
                <>
                  <div className="font-semibold">Seña: {fmt(depositCents)} <span className="font-normal text-black/55">({depositPercent}% de {fmt(priceCents)})</span></div>
                  <div className="text-[11px] text-black/55 mt-0.5">El resto ({fmt(priceCents - depositCents)}) lo pagás en el lugar.</div>
                </>
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
                vas a poder entrar siempre a ver tus cursos. Si ya tenés cuenta acá,
                usá la misma contraseña y te logueamos directo.
              </p>
            </>
          )}

          <p className="text-[11px] text-black/45 leading-snug">
            Vamos a usar estos datos sólo para inscribirte, enviarte el acceso al curso
            y contactarte si hace falta. No los compartimos con terceros.
          </p>

          {/* Hidden input con la elección de pago (la UI ya está arriba del form) */}
          {paymentMode !== 'none' && (
            <input type="hidden" name="payment_choice" value={
              paymentMode === 'choice' ? paymentChoice : paymentMode === 'deposit' ? 'deposit' : 'full'
            } />
          )}

          <button
            type="submit"
            disabled={!dataReady}
            className="w-full rounded-md py-3 font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: primary }}
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

  if (field.type === 'checkbox') {
    return (
      <div>
        <label className="flex items-start gap-2 text-sm">
          <input
            name={inputName}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            value="on"
            required={field.required}
            className="mt-0.5"
          />
          <span>{field.label}{reqStar}</span>
        </label>
        {helper}
      </div>
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

  // text / email / tel / date / number
  const htmlType =
    field.type === 'number' ? 'number'
    : field.type === 'date' ? 'date'
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
