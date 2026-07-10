'use client';

import { useRef, useState } from 'react';

const MAX_MB = 100;

/**
 * Uploader de videos MP4/WebM/MOV que solo aparece si el plan del tenant
 * lo permite (uploadsEnabled=true). Sube al bucket `product-videos` vía
 * POST /api/products/upload-video, y appendea la URL pública al textarea
 * de galería del ProductEditorForm.
 *
 * Si el plan NO lo permite, muestra un card "🔒 Feature premium" con CTA
 * a upgrade — el owner puede seguir pegando links de YouTube/Vimeo en la
 * galería sin costo (URL-only).
 */
export function VideoUploader({
  uploadsEnabled,
  planName,
  onUploaded
}: {
  uploadsEnabled: boolean;
  planName: string | null;
  /** Se invoca con la URL cuando el upload termina bien. */
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // ── Card locked (plan no lo permite) ────────────────────────────
  if (!uploadsEnabled) {
    return (
      <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.05] p-3">
        <div className="flex items-start gap-3">
          <span className="text-lg">🔒</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-amber-200">
              Subir videos propios · feature premium
            </div>
            <p className="text-xs text-white/60 mt-1 leading-snug">
              Tu plan actual{planName ? ` (${planName})` : ''} no incluye upload de
              archivos. Podés pegar <strong>links de YouTube o Vimeo</strong> en la
              galería sin costo — la plataforma los detecta y muestra con player. Si
              querés subir MP4 propios, hacé upgrade.
            </p>
            <a href="/mi-plan"
              className="inline-block mt-2 text-xs bg-amber-500 text-amber-950 font-semibold px-3 py-1.5 rounded hover:bg-amber-400 transition">
              Ver planes →
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Uploader habilitado ─────────────────────────────────────────
  async function handleFile(file: File) {
    setErr(null);
    if (file.size > MAX_MB * 1024 * 1024) {
      setErr(`El archivo supera los ${MAX_MB} MB. Cortalo o comprimilo.`);
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      // XHR para tener onprogress (fetch no lo soporta en request body)
      const url = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/products/upload-video');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const j = JSON.parse(xhr.responseText);
              if (j.url) return resolve(j.url);
              reject(new Error(j.message ?? 'Sin URL en respuesta'));
            } catch {
              reject(new Error('Respuesta inválida'));
            }
          } else {
            try {
              const j = JSON.parse(xhr.responseText);
              reject(new Error(j.message ?? j.error ?? `HTTP ${xhr.status}`));
            } catch {
              reject(new Error(`HTTP ${xhr.status}`));
            }
          }
        };
        xhr.onerror = () => reject(new Error('Falló la conexión'));
        const fd = new FormData();
        fd.append('file', file);
        xhr.send(fd);
      });
      onUploaded(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.03] p-3">
      <div className="flex items-center gap-2 mb-2">
        <span>🎬</span>
        <strong className="text-sm">Subir video propio</strong>
        <span className="text-[10px] uppercase tracking-wider bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5 rounded font-bold">Premium</span>
      </div>
      <p className="text-[11px] text-white/50 mb-2 leading-snug">
        MP4, WebM o MOV. Máximo <strong>{MAX_MB} MB</strong>. Se agrega a la galería
        del producto cuando termine.
      </p>
      <div className="flex items-center gap-2">
        <label className={`flex-1 rounded-md text-sm font-semibold px-3 py-2 text-center cursor-pointer transition ${
          busy
            ? 'bg-emerald-500/30 text-emerald-100 cursor-wait'
            : 'bg-emerald-500 text-white hover:bg-emerald-400'
        }`}>
          {busy ? `Subiendo… ${progress}%` : '📎 Elegir video'}
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </label>
      </div>
      {busy && (
        <div className="mt-2 h-1.5 bg-white/10 rounded overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all"
            style={{ width: `${progress}%` }} />
        </div>
      )}
      {err && (
        <p className="text-xs text-rose-300 mt-2 leading-snug">⚠ {err}</p>
      )}
    </div>
  );
}
