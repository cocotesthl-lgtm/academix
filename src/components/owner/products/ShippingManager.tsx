'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createZoneAction, updateZoneAction, deleteZoneAction,
  createRateAction, updateRateAction, deleteRateAction
} from '@/lib/shipping/actions';
import {
  AR_PROVINCES, provinceName,
  type ShippingZone, type ShippingRate
} from '@/lib/shipping/types';

function formatCents(cents: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  }).format(cents / 100);
}

export function ShippingManager({
  zones,
  rates
}: {
  zones: ShippingZone[];
  rates: ShippingRate[];
}) {
  const [showAddZone, setShowAddZone] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function handleAddZone(formData: FormData) {
    startTransition(async () => {
      await createZoneAction(formData);
      setShowAddZone(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {zones.length === 0 && !showAddZone && (
        <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
          <div className="text-4xl mb-2">🚚</div>
          <div className="text-white/70 font-medium">Todavía no tenés zonas de envío</div>
          <p className="text-xs text-white/45 mt-1 mb-4">
            Creá una zona (ej. CABA) y sumale sus tarifas. Sin zonas, los productos que requieran envío no se pueden comprar.
          </p>
          <button
            type="button"
            onClick={() => setShowAddZone(true)}
            className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90"
          >
            + Nueva zona
          </button>
        </div>
      )}

      {zones.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowAddZone(true)}
            className="text-sm rounded border border-white/15 text-white/85 px-3 py-1.5 hover:bg-white/5"
          >
            + Nueva zona
          </button>
        </div>
      )}

      {showAddZone && (
        <form action={handleAddZone} className="rounded-xl border border-white/15 bg-white/[0.02] p-4 space-y-3">
          <h3 className="text-sm font-semibold">Nueva zona</h3>
          <div>
            <label className="block text-xs mb-1 text-white/60">Nombre</label>
            <input
              name="name" required placeholder="CABA, GBA, Interior, Retiro en local"
              className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" name="is_pickup" />
            Retiro en local (sin dirección de envío)
          </label>
          <div>
            <label className="block text-xs mb-1 text-white/60">Provincias (podés elegir varias)</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto rounded border border-white/10 p-2 bg-black/20">
              {AR_PROVINCES.map((p) => (
                <label key={p.code} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" name="provinces" value={p.code} />
                  {p.name}
                </label>
              ))}
            </div>
            <p className="text-[10px] text-white/40 mt-1">
              Si no seleccionás ninguna, la zona aplica a todas las provincias (útil para "envío nacional").
            </p>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={pending}
              className="text-xs px-3 py-1.5 rounded bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-50">
              Crear zona
            </button>
            <button type="button" onClick={() => setShowAddZone(false)}
              className="text-xs px-3 py-1.5 rounded border border-white/15 text-white/60 hover:bg-white/5">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {zones.map((z) => (
        <ZoneCard key={z.id} zone={z} rates={rates.filter((r) => r.zone_id === z.id)} />
      ))}
    </div>
  );
}

function ZoneCard({ zone, rates }: { zone: ShippingZone; rates: ShippingRate[] }) {
  const [editing, setEditing] = useState(false);
  const [showAddRate, setShowAddRate] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function handleUpdate(formData: FormData) {
    startTransition(async () => {
      await updateZoneAction(zone.id, formData);
      setEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`¿Eliminar zona "${zone.name}" y todas sus tarifas?`)) return;
    startTransition(async () => {
      await deleteZoneAction(zone.id);
      router.refresh();
    });
  }

  async function handleAddRate(formData: FormData) {
    startTransition(async () => {
      await createRateAction(zone.id, formData);
      setShowAddRate(false);
      router.refresh();
    });
  }

  const provincesLabel = zone.provinces.includes('*') || zone.provinces.length === 0
    ? 'Todas las provincias'
    : zone.provinces.map(provinceName).join(', ');

  return (
    <div className="rounded-xl border border-white/10 p-4 space-y-3">
      {editing ? (
        <form action={handleUpdate} className="space-y-2">
          <input name="name" defaultValue={zone.name} required
            className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40" />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" name="is_pickup" defaultChecked={zone.is_pickup} />
            Retiro en local
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto rounded border border-white/10 p-2 bg-black/20">
            {AR_PROVINCES.map((p) => (
              <label key={p.code} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox" name="provinces" value={p.code}
                  defaultChecked={zone.provinces.includes(p.code)}
                />
                {p.name}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={pending}
              className="text-xs px-3 py-1.5 rounded bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-50">
              Guardar
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="text-xs px-3 py-1.5 rounded border border-white/15 text-white/60 hover:bg-white/5">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">{zone.name}</h3>
              {zone.is_pickup && (
                <span className="text-[10px] uppercase tracking-wider bg-blue-500/15 text-blue-300 px-1.5 py-0.5 rounded">
                  retiro
                </span>
              )}
            </div>
            <p className="text-xs text-white/50 mt-0.5">{provincesLabel}</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button type="button" onClick={() => setEditing(true)}
              className="text-xs px-2.5 py-1 rounded border border-white/15 text-white/70 hover:bg-white/5">
              Editar
            </button>
            <button type="button" onClick={handleDelete} disabled={pending}
              className="text-xs px-2.5 py-1 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10 disabled:opacity-50">
              ×
            </button>
          </div>
        </div>
      )}

      {/* Tarifas */}
      <div className="pt-3 border-t border-white/5 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs text-white/60 uppercase tracking-wider font-semibold">Tarifas</h4>
          {!showAddRate && (
            <button type="button" onClick={() => setShowAddRate(true)}
              className="text-xs px-2 py-0.5 rounded border border-white/15 text-white/70 hover:bg-white/5">
              + Tarifa
            </button>
          )}
        </div>

        {rates.length === 0 && !showAddRate && (
          <p className="text-xs text-white/40 italic">
            Sin tarifas — el comprador no podrá elegir esta zona hasta que sumes al menos una.
          </p>
        )}

        {rates.map((r) => <RateRow key={r.id} rate={r} />)}

        {showAddRate && (
          <form action={handleAddRate} className="rounded border border-white/15 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input name="name" placeholder="Estándar, Express…" required
                className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40" />
              <input type="number" name="price_cents" placeholder="Precio (cents)" required min={0}
                className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40" />
              <input type="number" name="free_from_cents" placeholder="Envío gratis desde (cents, opc)" min={0}
                className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40" />
              <div className="grid grid-cols-2 gap-1">
                <input type="number" name="delivery_days_min" placeholder="Días desde" min={0}
                  className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40" />
                <input type="number" name="delivery_days_max" placeholder="hasta" min={0}
                  className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={pending}
                className="text-xs px-3 py-1.5 rounded bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-50">
                Crear tarifa
              </button>
              <button type="button" onClick={() => setShowAddRate(false)}
                className="text-xs px-3 py-1.5 rounded border border-white/15 text-white/60 hover:bg-white/5">
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function RateRow({ rate }: { rate: ShippingRate }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function handleUpdate(formData: FormData) {
    startTransition(async () => {
      await updateRateAction(rate.id, formData);
      setEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`¿Eliminar tarifa "${rate.name}"?`)) return;
    startTransition(async () => {
      await deleteRateAction(rate.id);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <form action={handleUpdate} className="rounded border border-white/15 p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input name="name" defaultValue={rate.name} required
            className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40" />
          <input type="number" name="price_cents" defaultValue={rate.price_cents} required min={0}
            className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40" />
          <input type="number" name="free_from_cents" defaultValue={rate.free_from_cents ?? ''} placeholder="Gratis desde (opc)" min={0}
            className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40" />
          <div className="grid grid-cols-2 gap-1">
            <input type="number" name="delivery_days_min" defaultValue={rate.delivery_days_min ?? ''} placeholder="Desde" min={0}
              className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40" />
            <input type="number" name="delivery_days_max" defaultValue={rate.delivery_days_max ?? ''} placeholder="Hasta" min={0}
              className="rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40" />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={pending}
            className="text-xs px-3 py-1.5 rounded bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-50">
            Guardar
          </button>
          <button type="button" onClick={() => setEditing(false)}
            className="text-xs px-3 py-1.5 rounded border border-white/15 text-white/60 hover:bg-white/5">
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  const daysLabel = rate.delivery_days_min && rate.delivery_days_max
    ? `${rate.delivery_days_min}-${rate.delivery_days_max}d`
    : rate.delivery_days_max ? `hasta ${rate.delivery_days_max}d` : null;

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{rate.name}</div>
        <div className="text-[11px] text-white/45">
          {formatCents(rate.price_cents)}
          {rate.free_from_cents != null && <> · gratis desde {formatCents(rate.free_from_cents)}</>}
          {daysLabel && <> · {daysLabel}</>}
        </div>
      </div>
      <button type="button" onClick={() => setEditing(true)}
        className="text-xs px-2.5 py-1 rounded border border-white/15 text-white/70 hover:bg-white/5">
        Editar
      </button>
      <button type="button" onClick={handleDelete} disabled={pending}
        className="text-xs px-2.5 py-1 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10 disabled:opacity-50">
        ×
      </button>
    </div>
  );
}
