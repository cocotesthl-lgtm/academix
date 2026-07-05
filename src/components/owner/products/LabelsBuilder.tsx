'use client';

import { useState, useMemo } from 'react';

type ProductRow = {
  id: string;
  title: string;
  sku: string | null;
  price_cents: number;
  currency: string;
  cover_url: string | null;
  status: string;
};

type VariantRow = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  price_cents: number | null;
  image_url: string | null;
};

type Item = {
  key: string;         // "prod:<id>" o "var:<id>"
  productId: string;
  variantId?: string;
  title: string;
  sku: string;
  priceCents: number;
  currency: string;
};

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency, maximumFractionDigits: 0
  }).format(cents / 100);
}

export function LabelsBuilder({
  products, variants
}: {
  products: ProductRow[];
  variants: VariantRow[];
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showPrice, setShowPrice] = useState(true);
  const [showTitle, setShowTitle] = useState(true);
  const [layout, setLayout] = useState<'3x8' | '2x5'>('3x8');

  // Filter products with SKU (o cuyas variantes tengan SKU)
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const p of products) {
      const productVariants = variants.filter((v) => v.product_id === p.id);
      if (productVariants.length === 0) {
        if (p.sku) {
          out.push({
            key: `prod:${p.id}`,
            productId: p.id,
            title: p.title,
            sku: p.sku,
            priceCents: p.price_cents,
            currency: p.currency
          });
        }
      } else {
        for (const v of productVariants) {
          if (v.sku) {
            out.push({
              key: `var:${v.id}`,
              productId: p.id,
              variantId: v.id,
              title: `${p.title} · ${v.name}`,
              sku: v.sku,
              priceCents: v.price_cents ?? p.price_cents,
              currency: p.currency
            });
          }
        }
      }
    }
    return out;
  }, [products, variants]);

  const withoutSku = products.filter((p) => {
    const pv = variants.filter((v) => v.product_id === p.id);
    if (pv.length === 0) return !p.sku;
    return pv.some((v) => !v.sku);
  });

  const totalLabels = Object.values(quantities).reduce((s, q) => s + (q || 0), 0);

  function setQty(key: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [key]: Math.max(0, Math.min(200, Math.floor(qty))) }));
  }

  function handleGenerate() {
    const list = items
      .filter((i) => (quantities[i.key] ?? 0) > 0)
      .map((i) => ({
        sku: i.sku,
        title: i.title,
        priceCents: i.priceCents,
        currency: i.currency,
        qty: quantities[i.key]
      }));
    if (list.length === 0) return;
    // Payload chico → base64 URL para evitar POST + página nueva
    const payload = {
      items: list,
      layout,
      showPrice,
      showTitle
    };
    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
    window.open(`/labels/print?d=${encoded}`, '_blank');
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
        <div className="text-4xl mb-2">🏷️</div>
        <div className="text-white/70 font-medium">Ningún producto tiene SKU cargado</div>
        <p className="text-xs text-white/45 mt-1">
          Andá a cada producto y cargale un SKU único (o SKU por variante). Sin SKU no se puede generar la etiqueta.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Config */}
      <div className="rounded-xl border border-white/10 p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Tamaño</label>
          <select value={layout} onChange={(e) => setLayout(e.target.value as '3x8' | '2x5')}
            className="w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40">
            <option value="3x8">3×8 · 24 x hoja · 63×38mm (Avery 5160)</option>
            <option value="2x5">2×5 · 10 x hoja · 99×57mm (grande)</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer md:col-span-1">
          <input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} />
          Mostrar nombre
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer md:col-span-1">
          <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />
          Mostrar precio
        </label>
        <div className="md:col-span-1 text-right">
          <div className="text-xs text-white/50">Etiquetas</div>
          <div className="text-2xl font-bold">{totalLabels}</div>
        </div>
      </div>

      {/* Warning products sin SKU */}
      {withoutSku.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.03] px-3 py-2 text-xs text-amber-200/80">
          ⚠️ {withoutSku.length} producto{withoutSku.length === 1 ? '' : 's'} sin SKU cargado — no se puede{withoutSku.length === 1 ? '' : 'n'} imprimir.
          {' '}Andá a <a href="/products" className="underline">productos</a> para completarlo.
        </div>
      )}

      {/* Lista */}
      <div className="rounded-xl border border-white/10 divide-y divide-white/5 overflow-hidden">
        {items.map((it) => {
          const qty = quantities[it.key] ?? 0;
          return (
            <div key={it.key} className="flex items-center gap-4 p-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{it.title}</div>
                <div className="text-[11px] text-white/45 flex gap-2 mt-0.5">
                  <span className="font-mono">{it.sku}</span>
                  <span>·</span>
                  <span>{formatMoney(it.priceCents, it.currency)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => setQty(it.key, qty - 1)} disabled={qty <= 0}
                  className="w-8 h-8 rounded border border-white/15 hover:bg-white/5 disabled:opacity-30">−</button>
                <input
                  type="number" value={qty} onChange={(e) => setQty(it.key, parseInt(e.target.value, 10) || 0)}
                  min={0} max={200}
                  className="w-16 text-center rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm focus:outline-none focus:border-white/40"
                />
                <button type="button" onClick={() => setQty(it.key, qty + 1)}
                  className="w-8 h-8 rounded border border-white/15 hover:bg-white/5">＋</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 -mx-6 px-6 py-3 bg-[#0a0a0a]/95 backdrop-blur border-t border-white/10 flex items-center justify-between">
        <div className="text-sm text-white/60">
          {totalLabels === 0 ? 'Elegí cuántas etiquetas de cada producto' :
            `${totalLabels} etiqueta${totalLabels === 1 ? '' : 's'} · ${
              layout === '3x8'
                ? Math.ceil(totalLabels / 24) + ' hoja' + (Math.ceil(totalLabels / 24) === 1 ? '' : 's') + ' A4'
                : Math.ceil(totalLabels / 10) + ' hoja' + (Math.ceil(totalLabels / 10) === 1 ? '' : 's') + ' A4'
            }`
          }
        </div>
        <button type="button" onClick={handleGenerate} disabled={totalLabels === 0}
          className="rounded bg-white text-black px-5 py-2 text-sm font-semibold hover:bg-white/90 disabled:opacity-40">
          Generar hoja para imprimir →
        </button>
      </div>
    </div>
  );
}
