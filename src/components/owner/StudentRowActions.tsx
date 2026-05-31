'use client';

import { useState, useTransition } from 'react';
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

export function StudentRowActions({ enrollment }: { enrollment: StudentData }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const [name, setName] = useState(enrollment.buyer_name ?? '');
  const [dni, setDni] = useState(enrollment.buyer_dni ?? '');
  const [location, setLocation] = useState(enrollment.buyer_location ?? '');
  const [phone, setPhone] = useState(enrollment.buyer_phone ?? '');

  function changeStatus(newStatus: 'active' | 'suspended' | 'cancelled') {
    const fd = new FormData();
    fd.set('enrollment_id', enrollment.id);
    fd.set('status', newStatus);
    start(async () => { await setEnrollmentStatusAction(fd); });
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
      setEditing(false);
    });
  }

  function doDelete() {
    const fd = new FormData();
    fd.set('enrollment_id', enrollment.id);
    start(async () => {
      await deleteEnrollmentAction(fd);
      setConfirmDelete(false);
    });
  }

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-2 justify-end">
        <span className="text-xs text-red-300">¿Eliminar inscripción definitivamente?</span>
        <button
          type="button"
          disabled={pending}
          onClick={doDelete}
          className="text-xs rounded border border-red-500/40 bg-red-500/10 text-red-300 px-2 py-1 hover:bg-red-500/20 disabled:opacity-40"
        >
          Sí, eliminar
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(false)}
          className="text-xs rounded border border-white/20 px-2 py-1 text-white/70 hover:bg-white/5"
        >
          Cancelar
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="absolute z-20 right-0 mt-1 w-80 rounded-lg border border-white/20 bg-[#0a0a0a] shadow-xl p-3 space-y-2 text-left">
        <div className="font-semibold text-sm">Editar datos del alumno</div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre"
          className="w-full rounded bg-white/5 border border-white/15 px-2 py-1 text-sm"
        />
        <input
          type="text"
          value={dni}
          onChange={(e) => setDni(e.target.value)}
          placeholder="DNI"
          className="w-full rounded bg-white/5 border border-white/15 px-2 py-1 text-sm font-mono"
        />
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Teléfono"
          className="w-full rounded bg-white/5 border border-white/15 px-2 py-1 text-sm"
        />
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Ubicación"
          className="w-full rounded bg-white/5 border border-white/15 px-2 py-1 text-sm"
        />
        <p className="text-[10px] text-white/40">El email no se puede editar (rompería el login del alumno).</p>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            disabled={pending}
            onClick={saveEdit}
            className="flex-1 rounded bg-emerald-500 text-emerald-950 px-3 py-1.5 text-xs font-bold disabled:opacity-30"
          >
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded border border-white/20 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 justify-end flex-wrap">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs rounded border border-white/15 bg-white/5 text-white/70 px-2 py-1 hover:bg-white/10"
        title="Editar datos del alumno"
      >
        Editar
      </button>

      {enrollment.status === 'active' && (
        <button
          type="button"
          disabled={pending}
          onClick={() => changeStatus('suspended')}
          className="text-xs rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 px-2 py-1 hover:bg-amber-500/20"
          title="Suspender acceso temporalmente (sin eliminar)"
        >
          Suspender
        </button>
      )}

      {enrollment.status === 'suspended' && (
        <button
          type="button"
          disabled={pending}
          onClick={() => changeStatus('active')}
          className="text-xs rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2 py-1 hover:bg-emerald-500/20"
          title="Reactivar acceso al curso"
        >
          Reactivar
        </button>
      )}

      {enrollment.status === 'cancelled' && (
        <button
          type="button"
          disabled={pending}
          onClick={() => changeStatus('active')}
          className="text-xs rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2 py-1 hover:bg-emerald-500/20"
          title="Reactivar"
        >
          Reactivar
        </button>
      )}

      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="text-xs rounded border border-red-500/30 bg-red-500/5 text-red-300/90 px-2 py-1 hover:bg-red-500/15"
        title="Eliminar inscripción permanentemente"
      >
        Eliminar
      </button>
    </div>
  );
}
