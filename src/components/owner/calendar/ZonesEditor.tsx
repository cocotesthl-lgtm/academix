'use client';

import { useState } from 'react';
import type { SeatZone } from '@/lib/calendar/types';

/**
 * Editor inline de zonas para un evento. El owner agrega zonas (ej VIP /
 * General / Pullman), cada una con su grid (filas × cols) + multiplicador
 * de precio. Renderiza un hidden input "seat_zones" con el JSON para
 * que el form server action lo recoja.
 *
 * Capacidad total se calcula como suma de filas × cols de cada zona —
 * la action ignora el campo "capacity" cuando seat_mode='zones'.
 */
const DEFAULT_COLORS = ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export function ZonesEditor() {
  const [zones, setZones] = useState<SeatZone[]>([]);

  function addZone() {
    const idx = zones.length;
    setZones((prev) => [
      ...prev,
      {
        id: `zone-${prev.length + 1}`,
        name: prev.length === 0 ? 'General' : `Zona ${prev.length + 1}`,
        rows: 5,
        cols: 10,
        price_multiplier: prev.length === 0 ? 1 : prev.length + 1,
        color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
      }
    ]);
  }

  function updateZone(idx: number, patch: Partial<SeatZone>) {
    setZones((prev) => prev.map((z, i) => i === idx ? { ...z, ...patch } : z));
  }

  function removeZone(idx: number) {
    setZones((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalCapacity = zones.reduce((sum, z) => sum + z.rows * z.cols, 0);

  return (
    <div className="space-y-3">
      <input type="hidden" name="seat_zones" value={JSON.stringify(zones)} />

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-white/55">
          {zones.length === 0
            ? 'Sin zonas todavía. Agregá al menos una.'
            : `${zones.length} ${zones.length === 1 ? 'zona' : 'zonas'} · capacidad total ${totalCapacity}`}
        </p>
        <button
          type="button"
          onClick={addZone}
          disabled={zones.length >= 20}
          className="text-xs px-3 py-1 rounded border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-40"
        >
          + Zona
        </button>
      </div>

      {zones.length > 0 && (
        <div className="space-y-2">
          {zones.map((z, idx) => (
            <div key={idx} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2">
              <div className="grid sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-3">
                  <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={z.name}
                    onChange={(e) => updateZone(idx, { name: e.target.value })}
                    maxLength={60}
                    placeholder="VIP / General"
                    className="w-full rounded bg-white/5 border border-white/15 px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">ID (slug)</label>
                  <input
                    type="text"
                    value={z.id}
                    onChange={(e) => updateZone(idx, { id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                    maxLength={40}
                    className="w-full rounded bg-white/5 border border-white/15 px-3 py-1.5 text-sm font-mono"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Filas</label>
                  <input
                    type="number" min={1} max={100}
                    value={z.rows}
                    onChange={(e) => updateZone(idx, { rows: parseInt(e.target.value || '1', 10) || 1 })}
                    className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Cols</label>
                  <input
                    type="number" min={1} max={100}
                    value={z.cols}
                    onChange={(e) => updateZone(idx, { cols: parseInt(e.target.value || '1', 10) || 1 })}
                    className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">× precio</label>
                  <input
                    type="number" min={0} max={100} step={0.1}
                    value={z.price_multiplier}
                    onChange={(e) => updateZone(idx, { price_multiplier: parseFloat(e.target.value || '1') || 1 })}
                    className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Color</label>
                  <input
                    type="color"
                    value={z.color ?? '#a855f7'}
                    onChange={(e) => updateZone(idx, { color: e.target.value })}
                    className="w-full h-[34px] rounded bg-transparent border border-white/15 cursor-pointer"
                  />
                </div>
                <div className="sm:col-span-1">
                  <button
                    type="button"
                    onClick={() => removeZone(idx)}
                    className="w-full h-[34px] rounded border border-red-500/30 text-red-300 text-xs hover:bg-red-500/10"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-white/40">
                Capacidad: {z.rows * z.cols} · Precio: base × {z.price_multiplier}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
