'use client';

import { useState } from 'react';

/**
 * Input controlado del cover_url del curso + galería de URLs sugeridas
 * (Unsplash, libres) para que el owner no tenga que buscar imágenes a mano.
 * 100% URL — sin uploads ni storage.
 */

const SUGGESTED_COVERS: Array<{ url: string; label: string }> = [
  { url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1600&h=900&q=80&auto=format&fit=crop', label: 'Aula / clase' },
  { url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1600&h=900&q=80&auto=format&fit=crop', label: 'Estudio' },
  { url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1600&h=900&q=80&auto=format&fit=crop', label: 'Trabajo laptop' },
  { url: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=1600&h=900&q=80&auto=format&fit=crop', label: 'Mac escritorio' },
  { url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1600&h=900&q=80&auto=format&fit=crop', label: 'Colaboración' },
  { url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1600&h=900&q=80&auto=format&fit=crop', label: 'Anotando' },
  { url: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=1600&h=900&q=80&auto=format&fit=crop', label: 'Curso online' },
  { url: 'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=1600&h=900&q=80&auto=format&fit=crop', label: 'Oficina' },
  { url: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=1600&h=900&q=80&auto=format&fit=crop', label: 'Fitness' },
  { url: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=1600&h=900&q=80&auto=format&fit=crop', label: 'Cocina' },
  { url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1600&h=900&q=80&auto=format&fit=crop', label: 'Marketing / data' },
  { url: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1600&h=900&q=80&auto=format&fit=crop', label: 'Fotografía' },
  { url: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1600&h=900&q=80&auto=format&fit=crop', label: 'Tech / código' },
  { url: 'https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=1600&h=900&q=80&auto=format&fit=crop', label: 'Diseño' },
  { url: 'https://images.unsplash.com/photo-1606761568499-6d2451b23c66?w=1600&h=900&q=80&auto=format&fit=crop', label: 'Workshop' },
  { url: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1600&h=900&q=80&auto=format&fit=crop', label: 'Finanzas' }
];

export function CoverPicker({ initial }: { initial: string | null }) {
  const [url, setUrl] = useState(initial ?? '');
  const [showGallery, setShowGallery] = useState(false);

  return (
    <div>
      <label className="block text-sm mb-1.5 text-white/70">URL de la portada</label>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-32 h-20 rounded-md bg-white/5 border border-white/15 overflow-hidden flex items-center justify-center">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-white/40">sin portada</span>
          )}
        </div>
        <input
          type="url"
          name="cover_url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… (pegá la URL de la imagen)"
          className="flex-1 rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-white/50">
          📐 Recomendado: 1600×900px (16:9). Dejá vacío para quitar la portada.
        </p>
        <button
          type="button"
          onClick={() => setShowGallery((v) => !v)}
          className="text-xs text-white/70 hover:text-white underline-offset-2 hover:underline"
        >
          {showGallery ? '↑ Ocultar galería' : '🖼️ Usar una imagen sugerida'}
        </button>
      </div>

      {showGallery && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs text-white/60 mb-2.5 leading-snug">
            Click en cualquiera para usarla. Son imágenes libres de Unsplash (no consumen tu
            storage, son links directos). Si encontrás una mejor en internet, pegá esa URL arriba.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {SUGGESTED_COVERS.map((img) => (
              <button
                key={img.url}
                type="button"
                onClick={() => { setUrl(img.url); setShowGallery(false); }}
                className={`relative rounded overflow-hidden border-2 transition aspect-video ${
                  url === img.url
                    ? 'border-emerald-400 shadow-lg shadow-emerald-500/30'
                    : 'border-white/10 hover:border-white/40'
                }`}
                title={img.label}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-1">
                  <span className="text-[9px] text-white font-medium leading-tight">{img.label}</span>
                </div>
                {url === img.url && (
                  <div className="absolute top-1 right-1 bg-emerald-500 text-emerald-950 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    ✓
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
