'use client';

import { useEffect, useRef, useState } from 'react';
import { updateArticleAction } from '@/lib/articles/actions';
import { RichTextField } from '@/components/owner/site/RichTextField';

type Category = { id: string; name: string };

export function ArticleEditorForm({
  article,
  categories
}: {
  article: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    cover_url: string | null;
    body_html: string;
    author_name: string | null;
    category_id: string | null;
  };
  categories: Category[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [body, setBody] = useState(article.body_html || '');

  // Escucha el evento global "Guardar" del toolbar arriba.
  useEffect(() => {
    function handler() { formRef.current?.requestSubmit(); }
    window.addEventListener('cp:save-all', handler);
    return () => window.removeEventListener('cp:save-all', handler);
  }, []);

  return (
    <form ref={formRef} action={updateArticleAction} className="space-y-5">
      <input type="hidden" name="id" value={article.id} />
      <input type="hidden" name="body_html" value={body} />

      <div>
        <label className="block text-xs uppercase tracking-wider text-white/55 font-semibold mb-1">Título</label>
        <input name="title" defaultValue={article.title}
          placeholder="Título del artículo"
          maxLength={160}
          className="w-full rounded bg-white/5 border border-white/15 px-3 py-2.5 text-lg font-semibold focus:outline-none focus:border-white/40" />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs uppercase tracking-wider text-white/55 font-semibold mb-1">Slug (URL)</label>
          <input name="slug" defaultValue={article.slug}
            placeholder="mi-articulo"
            maxLength={80}
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono focus:outline-none focus:border-white/40" />
          <span className="text-[10px] text-white/40 mt-0.5 block">URL final: /blog/{article.slug || 'slug'}</span>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-white/55 font-semibold mb-1">Autor (opcional)</label>
          <input name="author_name" defaultValue={article.author_name ?? ''}
            placeholder="Redacción"
            maxLength={80}
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-white/55 font-semibold mb-1">Categoría (opcional)</label>
        <select name="category_id" defaultValue={article.category_id ?? ''}
          className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
          <option value="" className="bg-[#0a0a0a]">— sin categoría —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id} className="bg-[#0a0a0a]">{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-white/55 font-semibold mb-1">Extracto (opcional)</label>
        <textarea name="excerpt" defaultValue={article.excerpt ?? ''} rows={2}
          maxLength={400}
          placeholder="Resumen corto que aparece en el listado del blog"
          className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-white/55 font-semibold mb-1">Imagen de portada (URL)</label>
        <input name="cover_url" defaultValue={article.cover_url ?? ''}
          placeholder="https://…"
          type="url"
          className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono focus:outline-none focus:border-white/40" />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-white/55 font-semibold mb-1">Contenido</label>
        <RichTextField label="" value={body} onChange={setBody} multiline placeholder="Escribí tu artículo…" />
        <span className="text-[10px] text-white/40 mt-1 block">
          Usá el toolbar para poner negritas, cursivas, listas, links, etc. Podés pegar HTML directamente.
        </span>
      </div>
    </form>
  );
}
