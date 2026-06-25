'use client';

import { useState } from 'react';
import type { SeatZone } from '@/lib/calendar/types';

/**
 * Mapa visual chico de cómo se va a ver cada zona en el storefront.
 * Sirve para que el owner vea de un pantallazo qué está armando.
 */
function ZonesPreview({ zones, basePriceCents = 1000_00, currency = 'ARS' }: {
  zones: SeatZone[]; basePriceCents?: number; currency?: string;
}) {
  if (zones.length === 0) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3 mt-3">
      <div className="text-[10px] uppercase tracking-wider text-white/40 text-center mb-2 border-b border-white/10 pb-1">
        escenario / frente
      </div>
      <div className="space-y-3">
        {zones.map((z) => {
          const zonePrice = Math.round(basePriceCents * z.price_multiplier);
          const color = z.color || '#f97316';
          return (
            <div key={z.id} className="rounded p-2" style={{ background: `${color}1A` }}>
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded" style={{ background: color }} />
                  <strong>{z.name || '—'}</strong>
                  <span className="text-white/55 text-[10px]">
                    ${(zonePrice / 100).toLocaleString('es-AR')} {currency}/asiento
                    {z.price_multiplier !== 1 && ` (×${z.price_multiplier})`}
                  </span>
                </div>
                <span className="text-[10px] text-white/45">
                  {z.rows}×{z.cols} = {z.rows * z.cols} asientos
                </span>
              </div>
              <div className="space-y-0.5 overflow-x-auto">
                {Array.from({ length: z.rows }, (_, r) => (
                  <div key={r} className="flex items-center justify-center gap-0.5">
                    <span className="w-3 text-[8px] font-mono text-white/30 text-right">
                      {String.fromCharCode(65 + r)}
                    </span>
                    {Array.from({ length: z.cols }, (_, c) => (
                      <span
                        key={c}
                        className="w-3 h-3 rounded-sm inline-block"
                        style={{ background: `${color}80`, border: `1px solid ${color}` }}
                        title={`${z.id}:${String.fromCharCode(65 + r)}${c + 1}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-white/35 text-center mt-2">
        💡 Vista previa con precio base de muestra ($1.000). El precio real sale de la publicación.
      </p>
    </div>
  );
}

/**
 * Editor inline de zonas para un evento. El owner agrega zonas (ej VIP /
 * General / Pullman), cada una con su grid (filas × cols) + multiplicador
 * de precio. Renderiza un hidden input "seat_zones" con el JSON para
 * que el form server action lo recoja.
 *
 * Capacidad total se calcula como suma de filas × cols de cada zona —
 * la action ignora el campo "capacity" cuando seat_mode='zones'.
 */
const DEFAULT_COLORS = ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

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
          className="text-xs px-3 py-1 rounded border border-orange-500/40 bg-orange-500/10 text-amber-300 hover:bg-orange-500/20 disabled:opacity-40"
        >
          + Zona
        </button>
      </div>

      {/* Vista previa visual — ayuda al owner a ver qué está armando */}
      <ZonesPreview zones={zones} />

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
                    value={z.color ?? '#f97316'}
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
