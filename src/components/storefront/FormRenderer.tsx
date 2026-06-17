'use client';

import { useState, useTransition } from 'react';
import { submitFormAction } from '@/lib/forms/actions';

export type FormFieldDef = {
  id: string;
  position: number;
  field_type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox' | 'number';
  name: string;
  label: string;
  placeholder: string | null;
  required: boolean;
  options: Array<{ value: string; label: string }> | null;
  help_text: string | null;
};

export type FormDef = {
  id: string;
  title: string;
  description: string | null;
  submit_label: string | null;
  fields: FormFieldDef[];
};

/**
 * Renderer público de un formulario.
 * Se usa en /storefront/[tenantId]/f/[slug] (página dedicada) y embebido
 * en el hero cuando el owner elige media_type='form'.
 */
export function FormRenderer({ form, primary = '#a855f7', compact = false }: {
  form: FormDef;
  primary?: string;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <div className={`rounded-2xl border border-black/10 bg-white p-6 ${compact ? '' : 'md:p-8'} shadow-lg`}>
      {!compact && (form.title || form.description) && (
        <div className="mb-5">
          {form.title && <h3 className="text-xl font-bold text-black">{form.title}</h3>}
          {form.description && <p className="text-sm text-black/60 mt-1">{form.description}</p>}
        </div>
      )}

      {result?.ok ? (
        <div className="text-center py-8">
          <div className="text-5xl mb-3">✅</div>
          <p className="text-black font-medium">{result.message}</p>
        </div>
      ) : (
        <form
          action={(fd) => start(async () => {
            fd.set('__form_id', form.id);
            if (typeof window !== 'undefined') {
              fd.set('__source', window.location.href);
            }
            const res = await submitFormAction(fd);
            setResult(res);
            if (res.ok && res.redirect && typeof window !== 'undefined') {
              window.location.href = res.redirect;
            }
          })}
          className="space-y-3"
        >
          {/* Honeypot anti-bot */}
          <input type="text" name="__hp" tabIndex={-1} autoComplete="off"
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} aria-hidden />

          {form.fields.map((f) => (
            <FieldRow key={f.id} field={f} />
          ))}

          {result && !result.ok && (
            <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {result.message}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md px-4 py-3 font-semibold text-white shadow hover:shadow-lg transition disabled:opacity-60"
            style={{ background: primary }}
          >
            {pending ? 'Enviando…' : (form.submit_label || 'Enviar')}
          </button>
        </form>
      )}
    </div>
  );
}

function FieldRow({ field }: { field: FormFieldDef }) {
  const baseCls = 'w-full rounded-md border border-black/15 bg-white px-3 py-2.5 text-sm text-black focus:outline-none focus:border-black/40';
  return (
    <label className="block">
      <span className="block text-xs font-medium text-black/70 mb-1">
        {field.label}
        {field.required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      {field.field_type === 'textarea' ? (
        <textarea
          name={field.name}
          required={field.required}
          placeholder={field.placeholder ?? ''}
          rows={3}
          className={baseCls}
        />
      ) : field.field_type === 'select' ? (
        <select name={field.name} required={field.required} className={baseCls} defaultValue="">
          <option value="" disabled>— elegí una opción —</option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : field.field_type === 'checkbox' ? (
        <input type="checkbox" name={field.name} className="w-4 h-4 align-middle accent-current" />
      ) : (
        <input
          type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : field.field_type === 'number' ? 'number' : 'text'}
          name={field.name}
          required={field.required}
          placeholder={field.placeholder ?? ''}
          className={baseCls}
        />
      )}
      {field.help_text && <span className="block text-[10px] text-black/45 mt-1">{field.help_text}</span>}
    </label>
  );
}
