'use client';

import { useEffect, useMemo, useRef } from 'react';

type LabelItem = {
  sku: string;
  title: string;
  priceCents: number;
  currency: string;
  qty: number;
};

type Payload = {
  items: LabelItem[];
  layout: '3x8' | '2x5';
  showPrice: boolean;
  showTitle: boolean;
};

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency, maximumFractionDigits: 0
  }).format(cents / 100);
}

/**
 * Página de impresión de etiquetas.
 * - No hereda el chrome del owner (vive en /labels/print, no /owner/*)
 * - Auto-abre el diálogo de impresión al cargar
 * - Layout controlado por CSS @page + grid con mm exactos
 *
 * Formatos soportados:
 *   3×8 → 63×38mm (Avery 5160 US, 24 por hoja A4)
 *   2×5 → 99×57mm (10 por hoja A4)
 */
export function LabelsPrintView({ encoded }: { encoded: string }) {
  const payload = useMemo<Payload | null>(() => {
    if (!encoded) return null;
    try {
      const json = decodeURIComponent(atob(encoded));
      return JSON.parse(json) as Payload;
    } catch {
      return null;
    }
  }, [encoded]);

  const flatLabels = useMemo(() => {
    if (!payload) return [];
    const list: LabelItem[] = [];
    for (const it of payload.items) {
      for (let i = 0; i < it.qty; i++) list.push(it);
    }
    return list;
  }, [payload]);

  // Renderizar los códigos de barras con jsbarcode.
  const barcodeRefs = useRef<Array<SVGSVGElement | null>>([]);
  useEffect(() => {
    if (flatLabels.length === 0) return;
    let cancelled = false;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const JsBarcode = ((await import('jsbarcode')).default) as any;
      if (cancelled) return;
      flatLabels.forEach((label, idx) => {
        const svg = barcodeRefs.current[idx];
        if (!svg) return;
        try {
          JsBarcode(svg, label.sku, {
            format: 'CODE128',
            width: payload?.layout === '3x8' ? 1.4 : 2,
            height: payload?.layout === '3x8' ? 32 : 50,
            fontSize: payload?.layout === '3x8' ? 11 : 14,
            margin: 2,
            displayValue: true,
            background: '#ffffff'
          });
        } catch (e) {
          console.error('[labels] barcode render error', label.sku, e);
        }
      });
    })();
    return () => { cancelled = true; };
  }, [flatLabels, payload?.layout]);

  if (!payload || flatLabels.length === 0) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui' }}>
        <h1 style={{ fontSize: 20 }}>No hay etiquetas para imprimir.</h1>
        <p style={{ marginTop: 10 }}>Volvé al panel y elegí cuántas etiquetas de cada producto.</p>
      </div>
    );
  }

  const is3x8 = payload.layout === '3x8';

  // Toolbar solo visible en pantalla (media screen). Se oculta en print.
  // El wrapper #print-root ocupa toda la pantalla y en @media print oculta
  // TODO lo demás del body (sidebar del owner, banners, etc) — así imprime
  // solo las hojas sin importar el layout en el que estemos.
  return (
    <div id="print-root">
      <style>{`
        #print-root { position: fixed; inset: 0; z-index: 9999; background: #f5f5f5; overflow: auto; font-family: system-ui, sans-serif; }
        .toolbar { position: sticky; top: 0; z-index: 10; background: #111; color: white; padding: 12px 20px; display: flex; align-items: center; gap: 16px; justify-content: space-between; }
        .toolbar button { background: white; color: black; border: 0; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; }
        .toolbar button:hover { background: #eaeaea; }
        .toolbar .info { font-size: 13px; opacity: 0.8; }

        .sheet {
          background: white;
          margin: 20px auto;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          width: 210mm;
          min-height: 297mm;
          padding: 8mm 6mm;
          box-sizing: border-box;
          display: grid;
          gap: 0;
        }

        /* 3×8 = 24 etiquetas de 63×38mm */
        .sheet.grid-3x8 {
          grid-template-columns: repeat(3, 63mm);
          grid-template-rows: repeat(8, 38mm);
          gap: 3mm 3mm;
          justify-content: center;
        }
        /* 2×5 = 10 etiquetas de 99×57mm */
        .sheet.grid-2x5 {
          grid-template-columns: repeat(2, 99mm);
          grid-template-rows: repeat(5, 57mm);
          gap: 3mm 3mm;
          justify-content: center;
        }

        .label {
          box-sizing: border-box;
          padding: 3mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          overflow: hidden;
          break-inside: avoid;
        }
        .label .title {
          font-size: 8pt;
          line-height: 1.1;
          margin-bottom: 1mm;
          font-weight: 500;
          color: #000;
          max-height: 6mm;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .label.big .title {
          font-size: 11pt;
          max-height: 10mm;
        }
        .label .price {
          font-size: 9pt;
          font-weight: 700;
          color: #000;
          margin-top: 1mm;
        }
        .label.big .price {
          font-size: 13pt;
        }
        .label svg {
          max-width: 100%;
          height: auto;
        }

        @media print {
          /* Ocultar todo el chrome del owner (sidebar, header, etc) durante print */
          body > *:not(#print-root) { display: none !important; }
          body, #print-root { background: white !important; position: static !important; overflow: visible !important; }
          #print-root { inset: auto !important; }
          .toolbar { display: none !important; }
          .sheet {
            margin: 0;
            box-shadow: none;
            page-break-after: always;
          }
          .sheet:last-child { page-break-after: auto; }
          @page { size: A4; margin: 0; }
        }
      `}</style>

      <div className="toolbar">
        <div>
          <strong>Etiquetas listas</strong>
          <span className="info"> · {flatLabels.length} etiqueta{flatLabels.length === 1 ? '' : 's'}</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => window.close()} style={{ background: 'transparent', color: 'white', border: '1px solid #444' }}>
            Cerrar
          </button>
          <button onClick={() => window.print()}>🖨️ Imprimir</button>
        </div>
      </div>

      {chunkLabels(flatLabels, is3x8 ? 24 : 10).map((chunk, sheetIdx) => (
        <div key={sheetIdx} className={`sheet ${is3x8 ? 'grid-3x8' : 'grid-2x5'}`}>
          {chunk.map((label, i) => {
            const globalIdx = sheetIdx * (is3x8 ? 24 : 10) + i;
            return (
              <div key={i} className={`label ${is3x8 ? '' : 'big'}`}>
                {payload.showTitle && (
                  <div className="title">{label.title}</div>
                )}
                <svg ref={(el) => { barcodeRefs.current[globalIdx] = el; }} />
                {payload.showPrice && (
                  <div className="price">{formatMoney(label.priceCents, label.currency)}</div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function chunkLabels(items: LabelItem[], per: number): LabelItem[][] {
  const out: LabelItem[][] = [];
  for (let i = 0; i < items.length; i += per) {
    out.push(items.slice(i, i + per));
  }
  return out;
}
