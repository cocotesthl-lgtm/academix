'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setArticleStatusAction, deleteArticleAction } from '@/lib/articles/actions';

export function ArticleToolbar({
  articleId,
  articleTitle,
  articleStatus,
  publicUrl
}: {
  articleId: string;
  articleTitle: string;
  articleStatus: 'draft' | 'published';
  publicUrl: string;
}) {
  const router = useRouter();
  const [statusUi, setStatusUi] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [publishing, startPublish] = useTransition();
  const [savingManual, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [saveTick, setSaveTick] = useState<'idle' | 'ok'>('idle');
  const [publishTick, setPublishTick] = useState<'idle' | 'ok'>('idle');
  const isPublished = articleStatus === 'published';

  useEffect(() => {
    function onSaving() { setStatusUi('saving'); }
    function onSaved() {
      setStatusUi('saved');
      setTimeout(() => setStatusUi('idle'), 1200);
    }
    window.addEventListener('cp:save-start', onSaving);
    window.addEventListener('cp:save-end', onSaved);
    return () => {
      window.removeEventListener('cp:save-start', onSaving);
      window.removeEventListener('cp:save-end', onSaved);
    };
  }, []);

  function handleSave() {
    if (savingManual) return;
    startSave(async () => {
      window.dispatchEvent(new CustomEvent('cp:save-start'));
      window.dispatchEvent(new CustomEvent('cp:save-all'));
      await new Promise((r) => setTimeout(r, 900));
      router.refresh();
      await new Promise((r) => setTimeout(r, 300));
      window.dispatchEvent(new CustomEvent('cp:save-end'));
      setSaveTick('ok');
      setTimeout(() => setSaveTick('idle'), 1500);
    });
  }

  function handlePublishToggle() {
    if (publishing) return;
    startPublish(async () => {
      // Antes de publicar, forzamos un save-all para asegurar que el
      // contenido en pantalla llegue a la DB.
      window.dispatchEvent(new CustomEvent('cp:save-all'));
      await new Promise((r) => setTimeout(r, 700));
      const fd = new FormData();
      fd.set('id', articleId);
      fd.set('status', isPublished ? 'draft' : 'published');
      await setArticleStatusAction(fd);
      setPublishTick('ok');
      setTimeout(() => setPublishTick('idle'), 1500);
      router.refresh();
    });
  }

  function handleDelete() {
    if (deleting) return;
    if (!confirm(`¿Eliminar "${articleTitle}"? Esta acción no se puede deshacer.`)) return;
    startDelete(async () => {
      const fd = new FormData();
      fd.set('id', articleId);
      await deleteArticleAction(fd);
      router.push('/blog');
    });
  }

  const label =
    statusUi === 'saving' ? 'Guardando…' :
    statusUi === 'saved' ? 'Guardado ✓' :
    isPublished ? 'Publicado' : 'En borrador';
  const color =
    statusUi === 'saving' ? 'text-white/60' :
    statusUi === 'saved' ? 'text-emerald-300' :
    isPublished ? 'text-emerald-300/70' : 'text-amber-300';

  return (
    <div className="sticky top-0 z-40 -mx-6 px-6 py-2.5 mb-4 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <a href="/blog" className="text-white/50 hover:text-white text-sm">← Blog</a>
          <span className="text-white/30">/</span>
          <span className="text-sm font-semibold truncate max-w-[280px]" title={articleTitle}>{articleTitle}</span>
          <span className={`text-xs flex items-center gap-1.5 ${color}`}>
            {statusUi === 'saving' && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            )}
            · {label}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="text-xs px-3 py-1.5 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10 disabled:opacity-40">
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
          {isPublished && (
            <a href={publicUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded border border-white/15 text-white/85 hover:bg-white/5 flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Ver público
            </a>
          )}
          <button type="button" onClick={handleSave} disabled={savingManual}
            className="text-xs px-3 py-1.5 rounded border border-white/15 text-white/85 hover:bg-white/5 disabled:opacity-50">
            {savingManual ? 'Guardando…' : saveTick === 'ok' ? '✓ Guardado' : 'Guardar'}
          </button>
          <button type="button" onClick={handlePublishToggle} disabled={publishing}
            className={`text-xs px-4 py-1.5 rounded font-semibold transition ${
              isPublished
                ? 'bg-white/10 text-white/70 hover:bg-white/15'
                : 'bg-blue-600 text-white hover:bg-blue-500'
            } disabled:opacity-60`}>
            {publishing
              ? (isPublished ? 'Despublicando…' : 'Publicando…')
              : publishTick === 'ok'
                ? (isPublished ? '✓ Publicado' : '✓ Despublicado')
                : (isPublished ? 'Despublicar' : 'Publicar')}
          </button>
        </div>
      </div>
    </div>
  );
}
