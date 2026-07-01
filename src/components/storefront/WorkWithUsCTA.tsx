'use client';

import { useState, useTransition } from 'react';
import { requestAffiliationAction } from '@/lib/affiliates/join';

/**
 * CTA de la sección "Trabajá con nosotros". Se comporta distinto según
 * el estado del user:
 *   - No logueado → link a /login?next=/#workwithus
 *   - Logueado + sin membership → botón "Aplicar" (que llama al server action)
 *   - Logueado + pending        → texto "Aplicación en revisión"
 *   - Logueado + active         → texto "Ya sos afiliado" + link al panel
 */
export function WorkWithUsCTA({
  tenantId,
  loggedIn,
  alreadyAffiliate,
  labelLoggedIn,
  labelLoggedOut,
  primary
}: {
  tenantId: string;
  loggedIn: boolean;
  alreadyAffiliate: 'active' | 'pending' | null;
  labelLoggedIn: string;
  labelLoggedOut: string;
  primary: string;
}) {
  const [state, setState] = useState<'idle' | 'pending' | 'active' | 'error'>(
    alreadyAffiliate ?? 'idle'
  );
  const [pending, start] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);

  if (!loggedIn) {
    return (
      <a href="/login?next=/%23workwithus"
        className="inline-block rounded-md px-8 py-4 font-bold shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition text-lg"
        style={{ background: primary, color: '#fff' }}>
        {labelLoggedOut} →
      </a>
    );
  }

  if (state === 'active') {
    return (
      <div className="space-y-3">
        <div className="text-lg font-semibold text-emerald-300">✓ Ya sos afiliado de este sitio</div>
        <a href="/dashboard"
          className="inline-block rounded-md px-6 py-3 font-semibold border border-white/25 hover:bg-white/5 transition">
          Ir a mi panel →
        </a>
      </div>
    );
  }

  if (state === 'pending') {
    return (
      <div className="text-lg text-amber-300 font-semibold">
        ⏳ Tu aplicación está en revisión. Te avisamos cuando esté lista.
      </div>
    );
  }

  function apply() {
    setErrMsg(null);
    start(async () => {
      const fd = new FormData();
      fd.set('tenant_id', tenantId);
      const res = await requestAffiliationAction(fd);
      if (res.ok) {
        setState(res.status === 'active' ? 'active' : 'pending');
      } else {
        setState('error');
        setErrMsg(res.error ?? 'Error inesperado');
      }
    });
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={apply} disabled={pending}
        className="inline-block rounded-md px-8 py-4 font-bold shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition text-lg disabled:opacity-60"
        style={{ background: primary, color: '#fff' }}>
        {pending ? 'Enviando…' : `${labelLoggedIn} →`}
      </button>
      {errMsg && <p className="text-sm text-rose-300">{errMsg}</p>}
    </div>
  );
}
