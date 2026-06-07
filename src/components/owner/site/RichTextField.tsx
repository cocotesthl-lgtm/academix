'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import { useEffect, useState, useRef } from 'react';

/**
 * Campo de texto con formato rico (B/U/S/I, alineación, color de selección,
 * espaciado, tamaño). Almacena HTML.
 *
 * Reglas clave:
 *  - Toolbar aparece sólo al hacer focus en el editor.
 *  - Color de texto se aplica a la selección (sino al cursor para próximo input).
 *  - Tamaño + espaciado: el editor IGNORA visualmente esos valores
 *    (mostrar tipografías de 60px en un input de 200px sería caos), pero
 *    los persiste y la storefront los aplica en vivo.
 *
 * El padre recibe HTML; lo manda al server tal cual y lo renderiza con
 * dangerouslySetInnerHTML en el storefront. El sanitizado lo hace TipTap
 * a nivel de parseo (StarterKit no admite scripts).
 */

// ─ Custom extension para letter-spacing + font-size como inline styles ─
// (TipTap no trae spacing nativo; los empaquetamos en TextStyle attrs.)
const TextStyleWithCustom = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.fontSize?.replace(/['"]+/g, '') || null,
        renderHTML: (attrs: { fontSize?: string | null }) => {
          if (!attrs.fontSize) return {};
          return { style: `font-size: ${attrs.fontSize}` };
        }
      },
      letterSpacing: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.letterSpacing || null,
        renderHTML: (attrs: { letterSpacing?: string | null }) => {
          if (!attrs.letterSpacing) return {};
          return { style: `letter-spacing: ${attrs.letterSpacing}` };
        }
      }
    };
  }
});

export function RichTextField({
  value,
  onChange,
  placeholder,
  multiline = false,
  label
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  multiline?: boolean;
  label?: string;
}) {
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Si no es multiline, sacamos los breaks/paragraphs de blockquote etc
        heading: false,
        codeBlock: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false
      }),
      Underline,
      TextStyleWithCustom,
      Color,
      TextAlign.configure({ types: ['paragraph', 'heading'] })
    ],
    content: value || '',
    immediatelyRender: false, // SSR-safe
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onFocus: () => setFocused(true),
    onBlur: () => {
      // Pequeño delay para que clicks en la toolbar no disparen blur
      setTimeout(() => {
        if (wrapperRef.current && !wrapperRef.current.contains(document.activeElement)) {
          setFocused(false);
        }
      }, 100);
    },
    editorProps: {
      attributes: {
        class: `rt-editor outline-none min-h-[${multiline ? '64px' : '32px'}] px-3 py-2 text-sm`
      }
    }
  });

  // Sincronizar value externo (ej si el server re-renderiza con valor nuevo)
  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div>
        {label && <label className="block text-sm mb-1.5 text-white/70">{label}</label>}
        <div className="rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm text-white/40 min-h-[36px]">
          {placeholder ?? 'Cargando…'}
        </div>
      </div>
    );
  }

  return (
    <div>
      {label && <label className="block text-sm mb-1.5 text-white/70">{label}</label>}
      <div
        ref={wrapperRef}
        className={`rounded-md bg-white/5 border transition-colors ${
          focused ? 'border-white/40' : 'border-white/15'
        }`}
      >
        {focused && <RichToolbar editor={editor} />}
        <EditorContent editor={editor} />
        {!value && placeholder && !focused && (
          <div className="absolute pointer-events-none px-3 py-2 text-sm text-white/30 -mt-9">
            {placeholder}
          </div>
        )}
      </div>
      <style>{`
        /* El editor IGNORA visualmente los tamaños/espaciados custom (sino
           tipografías gigantes destruirían el layout del builder). Pero los
           atributos siguen en el HTML — la storefront los aplica en vivo. */
        .rt-editor * {
          font-size: inherit !important;
          letter-spacing: inherit !important;
        }
        .rt-editor p { margin: 0; }
        .rt-editor p + p { margin-top: 0.5em; }
      `}</style>
    </div>
  );
}

/* ─────────── Toolbar ─────────── */

type EditorLike = NonNullable<ReturnType<typeof useEditor>>;

function RichToolbar({ editor }: { editor: EditorLike }) {
  const [color, setColor] = useState('#000000');
  const [fontSize, setFontSize] = useState('');
  const [spacing, setSpacing] = useState('');

  function applyColor(hex: string) {
    setColor(hex);
    editor.chain().focus().setColor(hex).run();
  }

  function applyFontSize(px: string) {
    setFontSize(px);
    if (!px) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor.chain().focus() as any).setMark('textStyle', { fontSize: null }).run();
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor.chain().focus() as any).setMark('textStyle', { fontSize: `${px}px` }).run();
    }
  }

  function applySpacing(em: string) {
    setSpacing(em);
    if (!em) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor.chain().focus() as any).setMark('textStyle', { letterSpacing: null }).run();
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor.chain().focus() as any).setMark('textStyle', { letterSpacing: `${em}em` }).run();
    }
  }

  const btn = (active: boolean) =>
    `text-xs w-7 h-7 rounded flex items-center justify-center transition ${
      active ? 'bg-white text-black' : 'text-white/70 hover:bg-white/10'
    }`;

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-white/10 bg-white/[0.03] rounded-t-md">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive('bold'))} title="Negrita (Ctrl+B)">
        <strong>B</strong>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive('italic'))} title="Itálica (Ctrl+I)">
        <em>I</em>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={btn(editor.isActive('underline'))} title="Subrayado (Ctrl+U)">
        <u>U</u>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btn(editor.isActive('strike'))} title="Tachado">
        <s>S</s>
      </button>

      <span className="w-px h-5 bg-white/15 mx-1" />

      <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()}
        className={btn(editor.isActive({ textAlign: 'left' }))} title="Alinear izquierda">⇤</button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()}
        className={btn(editor.isActive({ textAlign: 'center' }))} title="Centrar">↔</button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()}
        className={btn(editor.isActive({ textAlign: 'right' }))} title="Alinear derecha">⇥</button>

      <span className="w-px h-5 bg-white/15 mx-1" />

      <label className="flex items-center gap-1 text-[10px] text-white/50" title="Color del texto seleccionado">
        🎨
        <input
          type="color"
          value={color}
          onChange={(e) => applyColor(e.target.value)}
          className="w-6 h-6 rounded bg-transparent border border-white/15 cursor-pointer"
        />
      </label>
      <button
        type="button"
        onClick={() => {
          // Limpia TODO el formato del texto seleccionado: marks (bold,
          // italic, underline, strike, color, font-size, spacing) +
          // alineación del bloque.
          editor.chain().focus()
            .unsetAllMarks()
            .setTextAlign('left')
            .run();
          setFontSize('');
          setSpacing('');
        }}
        className="text-xs px-2 h-7 rounded border border-white/15 text-white/60 hover:bg-white/10 hover:text-white"
        title="Limpiar todo el formato del texto seleccionado"
      >
        Limpiar
      </button>

      <span className="w-px h-5 bg-white/15 mx-1" />

      <div className="flex items-center gap-1" title="Tamaño en px (no se muestra acá, sí en la web)">
        <span className="text-[10px] text-white/50">Aa</span>
        <input
          type="number"
          min={8} max={200}
          value={fontSize}
          onChange={(e) => applyFontSize(e.target.value)}
          placeholder="auto"
          className="w-12 rounded bg-white/5 border border-white/15 px-1.5 py-0.5 text-xs"
        />
      </div>

      <div className="flex items-center gap-1" title="Espaciado entre letras (em)">
        <span className="text-[10px] text-white/50">↔A</span>
        <input
          type="number"
          step={0.01} min={-0.1} max={0.5}
          value={spacing}
          onChange={(e) => applySpacing(e.target.value)}
          placeholder="0"
          className="w-14 rounded bg-white/5 border border-white/15 px-1.5 py-0.5 text-xs"
        />
      </div>
    </div>
  );
}
