'use client';

import { useState } from 'react';
import {
  updateUserProfileAction,
  grantEnrollmentByUserAction,
  adjustWalletAction,
  assignPlanAction,
  setUserRoleAction,
  revokeUserRoleAction,
  banUserFromTenantAction
} from '@/lib/users/actions';

type Course = { id: string; title: string; product_type: string | null };
type Role = 'student' | 'instructor' | 'affiliate' | 'owner';

/**
 * Panel de acciones del owner sobre un cliente específico. Formularios
 * con server actions. Cada bloque es independiente y se puede colapsar.
 */
export function UserActionsPanel({
  userId,
  currentEmail,
  currentDisplayName,
  courses,
  activeRoles
}: {
  userId: string;
  currentEmail: string | null;
  currentDisplayName: string | null;
  courses: Course[];
  activeRoles: string[];
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
      <h2 className="text-sm font-semibold">⚙️ Acciones</h2>

      <Accordion label="✏️ Editar datos del cliente">
        <form action={updateUserProfileAction} className="space-y-3">
          <input type="hidden" name="user_id" value={userId} />
          <FieldRow label="Nombre">
            <input name="display_name" defaultValue={currentDisplayName ?? ''}
              className="input" placeholder="Juan Pérez" />
          </FieldRow>
          <FieldRow label="Email">
            <input name="email" type="email" defaultValue={currentEmail ?? ''}
              className="input" placeholder="cliente@mail.com" />
          </FieldRow>
          <SubmitBtn>Guardar</SubmitBtn>
        </form>
      </Accordion>

      <Accordion label="🎓 Otorgar curso / contenido">
        {courses.length === 0 ? (
          <p className="text-xs text-white/50">Todavía no tenés cursos creados en tu tenant.</p>
        ) : (
          <form action={grantEnrollmentByUserAction} className="space-y-3">
            <input type="hidden" name="user_id" value={userId} />
            <FieldRow label="Curso / producto">
              <select name="course_id" required className="input">
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {typeIcon(c.product_type)} {c.title}
                  </option>
                ))}
              </select>
            </FieldRow>
            <p className="text-[11px] text-white/45">
              El cliente accede sin cobrar. Idempotente — si ya está inscrito, no duplica.
            </p>
            <SubmitBtn>Otorgar acceso</SubmitBtn>
          </form>
        )}
      </Accordion>

      <Accordion label="💰 Ajustar saldo">
        <form action={adjustWalletAction} className="space-y-3">
          <input type="hidden" name="user_id" value={userId} />
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Monto (positivo suma, negativo resta)">
              <input name="amount" type="number" step="0.01" required
                className="input" placeholder="1000" />
            </FieldRow>
            <FieldRow label="Moneda">
              <input name="currency" defaultValue="ARS" required className="input" />
            </FieldRow>
          </div>
          <FieldRow label="Concepto">
            <input name="concept" className="input" placeholder="Reembolso, bonus, ajuste manual…" />
          </FieldRow>
          <SubmitBtn>Aplicar</SubmitBtn>
        </form>
      </Accordion>

      <Accordion label="💳 Asignar plan / suscripción">
        <form action={assignPlanAction} className="space-y-3">
          <input type="hidden" name="user_id" value={userId} />
          <FieldRow label="Nombre del plan">
            <input name="plan_name" required className="input" placeholder="Plan Premium mensual" />
          </FieldRow>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Cuota mensual">
              <input name="monthly_amount" type="number" step="0.01" required className="input" placeholder="5000" />
            </FieldRow>
            <FieldRow label="Moneda">
              <input name="currency" defaultValue="ARS" required className="input" />
            </FieldRow>
          </div>
          <FieldRow label="Descripción (opcional)">
            <input name="description" className="input" placeholder="Qué incluye el plan…" />
          </FieldRow>
          <SubmitBtn>Asignar plan</SubmitBtn>
        </form>
      </Accordion>

      <Accordion label="👤 Rol en este tenant">
        <RoleManager userId={userId} activeRoles={activeRoles} />
      </Accordion>

      <Accordion label="🚫 Zona peligrosa" danger>
        <form action={banUserFromTenantAction}>
          <input type="hidden" name="user_id" value={userId} />
          <p className="text-xs text-white/60 mb-2">
            Revoca todos los enrollments y roles del cliente <strong>en este tenant</strong>.
            El usuario sigue existiendo globalmente y puede loguearse; simplemente ya no accede a nada tuyo.
            Reversible: podés volver a otorgarle cursos o rol después.
          </p>
          <button type="submit"
            className="text-xs rounded border border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 px-3 py-1.5">
            Banear del tenant
          </button>
        </form>
      </Accordion>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Roles: chips activos + form para agregar
   ───────────────────────────────────────────────────────────── */
function RoleManager({ userId, activeRoles }: { userId: string; activeRoles: string[] }) {
  const [pendingRole, setPendingRole] = useState<Role>('student');
  const ROLES: Role[] = ['student', 'instructor', 'affiliate', 'owner'];
  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-white/45 mb-1.5">Roles activos</div>
        {activeRoles.length === 0 ? (
          <p className="text-xs text-white/40">Sin roles asignados en este tenant.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {activeRoles.map((r) => (
              <form key={r} action={revokeUserRoleAction} className="inline-flex">
                <input type="hidden" name="user_id" value={userId} />
                <input type="hidden" name="role" value={r} />
                <button type="submit"
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-2 py-0.5 text-[11px] hover:bg-rose-500/20 hover:border-rose-400/40 hover:text-rose-200 transition group">
                  {r}
                  <span className="opacity-40 group-hover:opacity-100">✕</span>
                </button>
              </form>
            ))}
          </div>
        )}
      </div>
      <form action={setUserRoleAction} className="flex items-end gap-2">
        <input type="hidden" name="user_id" value={userId} />
        <div className="flex-1">
          <label className="block text-[10px] uppercase tracking-widest text-white/45 mb-1">Agregar / promover</label>
          <select name="role" value={pendingRole} onChange={(e) => setPendingRole(e.target.value as Role)}
            className="input w-full">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button type="submit" className="submit-btn">Asignar</button>
      </form>
      <p className="text-[10px] text-white/40">
        Owner e instructor son roles internos — dan acceso al panel /owner o /instructor. Student
        es el rol default de comprador.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   UI primitives locales — mismo look que otros forms del owner
   ───────────────────────────────────────────────────────────── */
function Accordion({ label, children, danger }: { label: string; children: React.ReactNode; danger?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-lg border ${danger ? 'border-rose-500/20' : 'border-white/10'} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left ${danger ? 'text-rose-200/90 hover:bg-rose-500/5' : 'hover:bg-white/[0.03]'}`}
      >
        <span>{label}</span>
        <span className={`text-white/40 transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-white/5">
          <style jsx>{`
            :global(.input) {
              width: 100%;
              background: rgba(255,255,255,0.05);
              border: 1px solid rgba(255,255,255,0.15);
              border-radius: 6px;
              padding: 6px 10px;
              color: inherit;
              font-size: 13px;
            }
            :global(.input:focus) { outline: none; border-color: rgba(255,255,255,0.35); }
            :global(.submit-btn) {
              background: white; color: black; font-weight: 600;
              border-radius: 6px; padding: 6px 14px; font-size: 12px;
              cursor: pointer;
            }
            :global(.submit-btn:hover) { background: rgba(255,255,255,0.9); }
          `}</style>
          {children}
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-white/45 block mb-1">{label}</span>
      {children}
    </label>
  );
}

function SubmitBtn({ children }: { children: React.ReactNode }) {
  return <button type="submit" className="submit-btn">{children}</button>;
}

function typeIcon(t: string | null): string {
  switch (t) {
    case 'vip_pack': return '💎';
    case 'digital':  return '📁';
    case 'service':  return '🛠️';
    case 'event':    return '🎫';
    case 'mentorship': return '🧑‍🏫';
    case 'topup':    return '💰';
    default:         return '🎓';
  }
}
