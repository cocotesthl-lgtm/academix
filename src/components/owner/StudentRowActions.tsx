'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  setEnrollmentStatusAction,
  updateEnrollmentBuyerInfoAction,
  deleteEnrollmentAction
} from '@/lib/enrollments/actions';

type StudentData = {
  id: string;
  status: string;
  buyer_name: string | null;
  buyer_dni: string | null;
  buyer_location: string | null;
  buyer_phone: string | null;
  buyer_email: string | null;
};

type ModalMode = null | 'edit' | 'suspend' | 'cancel' | 'delete';

export function StudentRowActions({ enrollment }: { enrollment: StudentData }) {
  const router = useRouter();
  const [mode, setMode] = useState<ModalMode>(null);
  const [pending, start] = useTransition();

  const [name, setName] = useState(enrollment.buyer_name ?? '');
  const [dni, setDni] = useState(enrollment.buyer_dni ?? '');
  const [location, setLocation] = useState(enrollment.buyer_location ?? '');
  const [phone, setPhone] = useState(enrollment.buyer_phone ?? '');
  const [reason, setReason] = useState('');

  function close() {
    setMode(null);
    setReason('');
    // Restaurar valores originales del edit por si cancela
    setName(enrollment.buyer_name ?? '');
    setDni(enrollment.buyer_dni ?? '');
    setLocation(enrollment.buyer_location ?? '');
    setPhone(enrollment.buyer_phone ?? '');
  }

  function changeStatus(newStatus: 'active' | 'suspended' | 'cancelled') {
    const fd = new FormData();
    fd.set('enrollment_id', enrollment.id);
    fd.set('status', newStatus);
    fd.set('reason', reason);
    start(async () => {
      await setEnrollmentStatusAction(fd);
      router.refresh();
      close();
    });
  }

  function saveEdit() {
    const fd = new FormData();
    fd.set('enrollment_id', enrollment.id);
    fd.set('buyer_name', name);
    fd.set('buyer_dni', dni);
    fd.set('buyer_location', location);
    fd.set('buyer_phone', phone);
    start(async () => {
      await updateEnrollmentBuyerInfoAction(fd);
      router.refresh();
      close();
    });
  }

  function doDelete() {
    const fd = new FormData();
    fd.set('enrollment_id', enrollment.id);
    fd.set('reason', reason);
    start(async () => {
      await deleteEnrollmentAction(fd);
      router.refresh();
      close();
    });
  }

  return (
    <>
      <div className="flex items-center gap-1.5 justify-end flex-wrap">
        <button
          type="button"
          onClick={() => setMode('edit')}
          className="text-xs rounded border border-white/15 bg-white/5 text-white/70 px-2 py-1 hover:bg-white/10"
          title="Editar datos del alumno"
        >
          Editar
        </button>

        {enrollment.status === 'active' && (
          <button
            type="button"
            onClick={() => setMode('suspend')}
            className="text-xs rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 px-2 py-1 hover:bg-amber-500/20"
            title="Suspender acceso (sin eliminar)"
          >
            Suspender
          </button>
        )}

        {enrollment.status !== 'active' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setReason('Reactivado por el owner');
              changeStatus('active');
            }}
            className="text-xs rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2 py-1 hover:bg-emerald-500/20"
            title="Reactivar acceso al curso"
          >
            Reactivar
          </button>
        )}

        {enrollment.status !== 'cancelled' && (
          <button
            type="button"
            onClick={() => setMode('cancel')}
            className="text-xs rounded border border-orange-500/30 bg-orange-500/10 text-orange-300 px-2 py-1 hover:bg-orange-500/20"
            title="Cancelar inscripción"
          >
            Cancelar
          </button>
        )}

        <button
          type="button"
          onClick={() => setMode('delete')}
          className="text-xs rounded border border-red-500/30 bg-red-500/5 text-red-300/90 px-2 py-1 hover:bg-red-500/15"
          title="Eliminar inscripción permanentemente"
        >
          Eliminar
        </button>
      </div>

      {/* Modal */}
      {mode && (
        <Modal onClose={close}>
          {mode === 'edit' && (
            <EditModal
              name={name} setName={setName}
              dni={dni} setDni={setDni}
              phone={phone} setPhone={setPhone}
              location={location} setLocation={setLocation}
              pending={pending}
              onSave={saveEdit}
              onCancel={close}
            />
          )}

          {(mode === 'suspend' || mode === 'cancel') && (
            <ReasonModal
              title={mode === 'suspend' ? 'Suspender inscripción' : 'Cancelar inscripción'}
              description={
                mode === 'suspend'
                  ? `El alumno deja de poder ver "${enrollment.buyer_name ?? 'el curso'}" temporalmente. Podés reactivar después.`
                  : `Marca la inscripción como cancelada. El alumno deja de poder acceder. Reactivable si fue un error.`
              }
              confirmLabel={mode === 'suspend' ? 'Suspender' : 'Cancelar inscripción'}
              confirmColor={mode === 'suspend' ? 'amber' : 'orange'}
              reason={reason}
              setReason={setReason}
              pending={pending}
              onConfirm={() => changeStatus(mode === 'suspend' ? 'suspended' : 'cancelled')}
              onClose={close}
            />
          )}

          {mode === 'delete' && (
            <ReasonModal
              title="Eliminar inscripción"
              description={
                <>
                  Borra el registro de inscripción <strong className="text-white">de forma permanente</strong>.
                  Esto NO devuelve la plata — el reembolso lo gestionás aparte desde MercadoPago.
                  Recomendado solo si fue un error de carga; si querés cortar el acceso, usá Suspender.
                </>
              }
              confirmLabel="Eliminar definitivamente"
              confirmColor="red"
              reason={reason}
              setReason={setReason}
              pending={pending}
              onConfirm={doDelete}
              onClose={close}
            />
          )}
        </Modal>
      )}
    </>
  );
}

/* ─────────── Modal helpers ─────────── */

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-white/15 bg-[#111] shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function EditModal({
  name, setName, dni, setDni, phone, setPhone, location, setLocation,
  pending, onSave, onCancel
}: {
  name: string; setName: (s: string) => void;
  dni: string; setDni: (s: string) => void;
  phone: string; setPhone: (s: string) => void;
  location: string; setLocation: (s: string) => void;
  pending: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div>
        <h2 className="text-lg font-bold">Editar datos del alumno</h2>
        <p className="text-xs text-white/50 mt-1">
          El email no se puede editar (rompería el login del alumno).
        </p>
      </div>
      <div className="space-y-2">
        <Field label="Nombre y apellido" value={name} onChange={setName} />
        <Field label="DNI" value={dni} onChange={setDni} mono />
        <Field label="Teléfono / WhatsApp" value={phone} onChange={setPhone} />
        <Field label="Ubicación" value={location} onChange={setLocation} />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="flex-1 rounded bg-white text-black px-4 py-2 text-sm font-bold disabled:opacity-30"
        >
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
        >
          Cancelar
        </button>
      </div>
    </>
  );
}

function ReasonModal({
  title, description, confirmLabel, confirmColor, reason, setReason, pending, onConfirm, onClose
}: {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  confirmColor: 'amber' | 'orange' | 'red';
  reason: string;
  setReason: (s: string) => void;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const colorMap = {
    amber:  'bg-amber-500 text-amber-950 hover:bg-amber-400',
    orange: 'bg-orange-500 text-orange-950 hover:bg-orange-400',
    red:    'bg-red-500 text-red-950 hover:bg-red-400'
  };
  return (
    <>
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm text-white/65 mt-1.5 leading-relaxed">{description}</p>
      </div>
      <div>
        <label className="block text-xs text-white/60 mb-1">
          Motivo <span className="text-red-300">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Ej: el alumno pidió pausar el curso por 2 semanas / falta de pago / pidió reembolso"
          className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40 resize-none"
        />
        <p className="text-[10px] text-white/40 mt-1">Queda registrado en el audit log para tu propia trazabilidad.</p>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending || reason.trim().length < 3}
          className={`flex-1 rounded px-4 py-2 text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed ${colorMap[confirmColor]}`}
        >
          {pending ? 'Procesando…' : confirmLabel}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
        >
          Cancelar
        </button>
      </div>
    </>
  );
}

function Field({ label, value, onChange, mono }: {
  label: string; value: string; onChange: (v: string) => void; mono?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40 ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}
