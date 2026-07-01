'use client';

import { useState, useTransition } from 'react';
import { MODULE_KEYS, MODULE_META, type ModuleKey } from '@/lib/modules/types';
import { ACTIONS, PERMISSION_PRESETS, type Action, type Permissions } from '@/lib/permissions/types';
import { setMemberPermissionsAction, applyMemberPresetAction } from '@/lib/permissions/actions';

/**
 * Editor inline de permisos por miembro.
 * - Presets rápidos (Instructor, Staff, Afiliado, Sin acceso)
 * - Checkboxes por módulo × acción para override fino
 * - Autosave al cambiar cualquier checkbox
 * - "admin" implica "edit" e "view" (se auto-marcan en la UI)
 */
export function MemberPermissionsEditor({
  userId,
  initial,
  disabled = false
}: {
  userId: string;
  initial: Permissions | null;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [permissions, setPermissions] = useState<Permissions>(initial ?? {});
  const [pending, start] = useTransition();
  const [savedTick, setSavedTick] = useState(false);

  function hasAction(mod: ModuleKey, act: Action): boolean {
    const arr = permissions[mod];
    if (!arr) return false;
    // Hierarchy: admin implica edit e view
    if (arr.includes('admin')) return true;
    if (act === 'view' && arr.includes('edit')) return true;
    return arr.includes(act);
  }

  function toggle(mod: ModuleKey, act: Action) {
    const current = permissions[mod] ?? [];
    let next: Action[];
    if (current.includes(act)) {
      next = current.filter((a) => a !== act);
    } else {
      next = [...current, act];
    }
    const updated = { ...permissions };
    if (next.length === 0) delete updated[mod];
    else updated[mod] = next;
    setPermissions(updated);

    // Autosave
    const fd = new FormData();
    fd.set('user_id', userId);
    fd.set('permissions', JSON.stringify(updated));
    start(async () => {
      await setMemberPermissionsAction(fd);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
    });
  }

  function applyPreset(preset: keyof typeof PERMISSION_PRESETS) {
    const perms = PERMISSION_PRESETS[preset] as Permissions;
    setPermissions(perms);
    const fd = new FormData();
    fd.set('user_id', userId);
    fd.set('preset', preset);
    start(async () => {
      await applyMemberPresetAction(fd);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
    });
  }

  const totalModules = Object.keys(permissions).length;

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="text-[11px] px-2 py-1 rounded border border-white/15 text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-40 flex items-center gap-1.5"
      >
        <span>🔐 Permisos ({totalModules}/{MODULE_KEYS.length})</span>
        {pending && <span className="text-white/40">…</span>}
        {savedTick && !pending && <span className="text-emerald-400">✓</span>}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-3 space-y-3">
          {/* Presets */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-white/45 font-semibold self-center mr-1">Preset:</span>
            {(Object.keys(PERMISSION_PRESETS) as Array<keyof typeof PERMISSION_PRESETS>).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                disabled={disabled || pending}
                className="text-[10px] px-2 py-1 rounded border border-white/15 hover:bg-white/5 disabled:opacity-40 capitalize"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Matriz */}
          <div className="overflow-x-auto">
            <table className="text-[11px] w-full">
              <thead>
                <tr className="text-left text-white/45">
                  <th className="py-1 pr-2 font-normal">Módulo</th>
                  {ACTIONS.map((a) => (
                    <th key={a} className="px-2 py-1 font-normal text-center capitalize">{a}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULE_KEYS.map((mod) => (
                  <tr key={mod} className="border-t border-white/5">
                    <td className="py-1.5 pr-2 text-white/75">{MODULE_META[mod].label}</td>
                    {ACTIONS.map((a) => (
                      <td key={a} className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={hasAction(mod, a)}
                          disabled={disabled || pending}
                          onChange={() => toggle(mod, a)}
                          className="cursor-pointer accent-emerald-500 disabled:opacity-40"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-white/40">
            &quot;Admin&quot; implica &quot;edit&quot; e &quot;view&quot;. Un módulo sin ninguna acción marcada = sin acceso.
          </p>
        </div>
      )}
    </div>
  );
}
