'use client';

import { useState } from 'react';

/**
 * Form de compra con datos del comprador (URL del formulario).
 * - Si el curso es gratis o el cupón lo deja en 0, ocultamos los datos de
 *   pago — pero el flujo libre igual no necesita esos datos para MP.
 * - Si hay precio > 0, antes de redirigir a MP pedimos: nombre/apellido,
 *   DNI, ubicación, email y celular. Estos datos persisten en sales +
 *   enrollments para que el owner pueda contactar al alumno e impartir
 *   la clase aunque MP tarde en confirmar.
 *
 * El form sigue siendo POST nativo (no usa fetch) para que funcione sin
 * JS y para que MP redirija con un 303.
 */
export function CouponInput({
  courseId,
  priceCents,
  currency,
  primary,
  freeLabel = 'Inscribirme gratis',
  buyLabel = 'Continuar al pago',
  defaultEmail = ''
}: {
  courseId: string;
  priceCents: number;
  currency: string;
  primary: string;
  freeLabel?: string;
  buyLabel?: string;
  defaultEmail?: string;
}) {
  const [showCoupon, setShowCoupon] = useState(false);
  const [code, setCode] = useState('');
  const [expanded, setExpanded] = useState(false);

  // Validación liviana en cliente: el server hace validación real.
  const [name, setName] = useState('');
  const [dni, setDni] = useState('');
  const [location, setLocation] = useState('');
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');

  const isFree = priceCents === 0;
  const isLoggedIn = defaultEmail.length > 0;

  const passwordOk = isLoggedIn || (password.length >= 6 && password === password2);

  const dataReady =
    name.trim().length >= 3 &&
    dni.trim().length >= 6 &&
    location.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    phone.trim().length >= 6 &&
    passwordOk;

  return (
    <form action={`/api/checkout/${courseId}`} method="post" className="space-y-3">
      {/* Curso gratis: botón directo sin pedir datos (igual quedan inscriptos por user_id) */}
      {isFree && (
        <button
          type="submit"
          className="w-full rounded-md py-3 font-semibold text-white"
          style={{ background: primary }}
        >
          {freeLabel}
        </button>
      )}

      {/* Curso pago: primero un botón para expandir el form */}
      {!isFree && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-md py-3 font-semibold text-white"
          style={{ background: primary }}
        >
          Comprar curso · ${(priceCents / 100).toLocaleString('es-AR')} {currency}
        </button>
      )}

      {!isFree && expanded && (
        <div className="space-y-3 rounded-lg border border-black/15 bg-black/[0.02] p-4">
          <div>
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
            <p className="text-xs text-black/55 mb-3">
              Necesitamos estos datos para inscribirte y enviarte el acceso al curso.
            </p>
          </div>

          <div>
            <label className="block text-xs text-black/60 mb-1">Nombre y apellido *</label>
            <input
              name="buyer_name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Ej: Juan Pérez"
              className="w-full rounded border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-black/60 mb-1">DNI / Documento *</label>
              <input
                name="buyer_dni"
                type="text"
                required
                inputMode="numeric"
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\s/g, ''))}
                maxLength={20}
                placeholder="Ej: 30123456"
                className="w-full rounded border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black/40"
              />
            </div>
            <div>
              <label className="block text-xs text-black/60 mb-1">Celular *</label>
              <input
                name="buyer_phone"
                type="tel"
                required
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
                placeholder="Ej: +54 9 11 5555-5555"
                className="w-full rounded border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-black/60 mb-1">Ubicación *</label>
            <input
              name="buyer_location"
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={120}
              placeholder="Ciudad / Provincia / País"
              className="w-full rounded border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black/40"
            />
          </div>

          <div>
            <label className="block text-xs text-black/60 mb-1">Email *</label>
            <input
              name="buyer_email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={200}
              placeholder="vos@email.com"
              className="w-full rounded border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black/40"
            />
          </div>

          {!isLoggedIn && (
            <>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/10">
                <div>
                  <label className="block text-xs text-black/60 mb-1">Contraseña *</label>
                  <input
                    name="buyer_password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    maxLength={120}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black/40"
                  />
                </div>
                <div>
                  <label className="block text-xs text-black/60 mb-1">Repetir contraseña *</label>
                  <input
                    type="password"
                    required
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    minLength={6}
                    maxLength={120}
                    placeholder="Repetir"
                    className="w-full rounded border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black/40"
                  />
                </div>
              </div>
              <p className="text-[11px] text-black/55">
                🔐 Vamos a crear tu cuenta con estos datos. Con ese email y contraseña vas a poder
                entrar siempre que quieras a ver tus cursos. Si ya tenés cuenta acá, usá la misma
                contraseña y vamos a loguearte directo.
              </p>
            </>
          )}

          <p className="text-[11px] text-black/45 leading-snug">
            Vamos a usar estos datos sólo para inscribirte, enviarte el acceso al curso y
            contactarte si hace falta. No los compartimos con terceros.
          </p>

          <button
            type="submit"
            disabled={!dataReady}
            className="w-full rounded-md py-3 font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: primary }}
          >
            {buyLabel} · ${(priceCents / 100).toLocaleString('es-AR')} {currency}
          </button>
          {!dataReady && (
            <p className="text-[11px] text-amber-700 text-center">
              {!isLoggedIn && password.length > 0 && password !== password2
                ? 'Las contraseñas no coinciden.'
                : !isLoggedIn && password.length > 0 && password.length < 6
                  ? 'La contraseña tiene que tener al menos 6 caracteres.'
                  : 'Completá todos los campos para continuar.'}
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
