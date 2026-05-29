'use client';

import { useState, useTransition } from 'react';
import {
  toggleSuperAdminAction,
  updateUserDisplayNameAction,
  deleteUserAction
} from '@/lib/founder/actions';

export function UserRowActions({
  profileId,
  email,
  displayName,
  isSuperAdmin,
  isSelf
}: {
  profileId: string;
  email: string | null;
  displayName: string | null;
  isSuperAdmin: boolean;
  isSelf: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayName ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [pending, start] = useTransition();

  async function saveName() {
    const fd = new FormData();
    fd.set('profile_id', profileId);
    fd.set('display_name', name);
    start(async () => {
      await updateUserDisplayNameAction(fd);
      setEditing(false);
    });
  }

  async function doDelete() {
    const fd = new FormData();
    fd.set('profile_id', profileId);
    fd.set('confirm', confirmText);
    start(async () => {
      await deleteUserAction(fd);
      setConfirmDelete(false);
      setConfirmText('');
    });
  }

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-2 justify-end">
        <input
          type="email"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={email ?? 'email del usuario'}
          className="text-xs rounded border border-red-500/40 bg-red-500/5 px-2 py-1 w-44"
        />
        <button
          type="button"
          disabled={pending || confirmText.trim().toLowerCase() !== (email ?? '').toLowerCase()}
          onClick={doDelete}
          className="text-xs rounded border border-red-500/40 bg-red-500/10 text-red-300 px-2 py-1 hover:bg-red-500/20 disabled:opacity-40"
        >
          Borrar definitivo
        </button>
        <button
          type="button"
          onClick={() => { setConfirmDelete(false); setConfirmText(''); }}
          className="text-xs rounded border border-white/20 px-2 py-1 text-white/70 hover:bg-white/5"
        >
          Cancelar
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 justify-end">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Nombre visible"
          className="text-xs rounded border border-white/20 bg-white/5 px-2 py-1 w-44"
        />
        <button
          type="button"
          disabled={pending}
          onClick={saveName}
          className="text-xs rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-2 py-1 hover:bg-emerald-500/20 disabled:opacity-40"
        >
          {pending ? '…' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setName(displayName ?? ''); }}
          className="text-xs rounded border border-white/20 px-2 py-1 text-white/70 hover:bg-white/5"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 justify-end flex-wrap">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs rounded border border-white/15 bg-white/5 text-white/70 px-2 py-1 hover:bg-white/10"
      >
        Editar nombre
      </button>
      {!isSelf && (
        <form action={toggleSuperAdminAction} className="inline">
          <input type="hidden" name="profile_id" value={profileId} />
          <button
            className={`text-xs rounded border px-2 py-1 ${
              isSuperAdmin
                ? 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                : 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/20'
            }`}
          >
            {isSuperAdmin ? 'Quitar admin' : 'Hacer admin'}
          </button>
        </form>
      )}
      {!isSelf && (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="text-xs rounded border border-red-500/30 bg-red-500/5 text-red-300/90 px-2 py-1 hover:bg-red-500/15"
        >
          Borrar
        </button>
      )}
      {isSelf && (
        <span className="text-[10px] text-white/30 px-2">vos</span>
      )}
    </div>
  );
}
