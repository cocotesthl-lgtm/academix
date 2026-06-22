'use client';

import { useState, useTransition } from 'react';
import type { CheckoutConfig, CheckoutField, CheckoutFieldType, BaseFieldKey } from '@/lib/checkout/types';

const BASE_LABELS: Record<BaseFieldKey, string> = {
  name:     'Nombre y apellido',
  dni:      'DNI / Documento',
  phone:    'Celular',
  location: 'Ubicación'
};

const TYPE_LABELS: Record<CheckoutFieldType, string> = {
  text:     'Texto corto',
  email:    'Email',
  tel:      'Teléfono',
  textarea: 'Texto largo',
  select:   'Lista desplegable',
  radio:    '⦿ Radio (elegí UNA — visible)',
  multi:    '☑ Múltiple (varios checkboxes)',
  checkbox: '✓ Sí / No (puede sumar al precio)',
  date:     'Fecha',
  time:     '🕐 Hora (HH:MM)',
  number:   'Número',
  heading:  '🪧 Título de sección'
};

type Actions = {
  setBaseField: (fd: FormData) => Promise<void>;
  addExtra:     (fd: FormData) => Promise<void>;
  updateExtra:  (fd: FormData) => Promise<void>;
  deleteExtra:  (fd: FormData) => Promise<void>;
  moveExtra:    (fd: FormData) => Promise<void>;
};

/**
 * Editor reusable de checkout_config. Misma UI para el tenant default y
 * para el override por curso — se diferencian solo por las actions que
 * recibe y por hiddenExtras (que inyecta course_id en cada submit).
 */
export function CheckoutFieldsEditor({
  config,
  actions,
  hiddenExtras = {}
}: {
  config: CheckoutConfig;
  actions: Actions;
  /** Campos hidden que se agregan a todos los submits (ej course_id). */
  hiddenExtras?: Record<string, string>;
}) {
  const hiddens = Object.entries(hiddenExtras);

  return (
    <div className="space-y-8">
      {/* ───── Email + password siempre on (informativo) ───── */}
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-emerald-300">✓</span>
          <strong>Email + contraseña</strong>
          <span className="text-white/50 text-xs">(siempre se piden)</span>
        </div>
        <p className="text-xs text-white/60 mt-1 leading-snug">
          Son obligatorios para crear la cuenta del comprador y darle acceso al curso.
          No los podés desactivar.
        </p>
      </div>

      {/* ───── Campos base toggleables ───── */}
      <div>
        <h3 className="font-semibold mb-3">Campos básicos</h3>
        <p className="text-xs text-white/55 mb-4">
          Toggleá los que querés pedir. Si lo activás, podés además marcarlo como obligatorio.
        </p>
        <div className="space-y-2">
          {(Object.keys(BASE_LABELS) as BaseFieldKey[]).map((k) => {
            const v = config.base_fields[k];
            return (
              <div key={k} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{BASE_LABELS[k]}</div>
                  <div className="text-xs text-white/40 font-mono">{k}</div>
                </div>
                <BaseToggleForm
                  fieldKey={k}
                  prop="enabled"
                  value={v.enabled}
                  hiddens={hiddens}
                  action={actions.setBaseField}
                  label="Pedir este campo"
                />
                <BaseToggleForm
                  fieldKey={k}
                  prop="required"
                  value={v.required}
                  disabled={!v.enabled}
                  hiddens={hiddens}
                  action={actions.setBaseField}
                  label="Obligatorio"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ───── Campos extra custom ───── */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-semibold">Campos personalizados</h3>
          <span className="text-xs text-white/40">{config.extra_fields.length} {config.extra_fields.length === 1 ? 'campo' : 'campos'}</span>
        </div>
        <p className="text-xs text-white/55 mb-4">
          Agregá los datos que necesites más allá de los básicos. Las respuestas
          quedan guardadas en cada inscripción para que las consultes después.
        </p>

        <AddExtraForm hiddens={hiddens} action={actions.addExtra} />

        {config.extra_fields.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-white/15 p-6 text-center text-white/40 text-sm">
            Todavía no agregaste campos personalizados.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {config.extra_fields.map((f, idx) => (
              <ExtraFieldRow
                key={f.id}
                field={f}
                isFirst={idx === 0}
                isLast={idx === config.extra_fields.length - 1}
                hiddens={hiddens}
                actions={actions}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────── Sub-componentes ──────────────── */

function BaseToggleForm({
  fieldKey, prop, value, disabled, hiddens, action, label
}: {
  fieldKey: BaseFieldKey;
  prop: 'enabled' | 'required';
  value: boolean;
  disabled?: boolean;
  hiddens: Array<[string, string]>;
  action: (fd: FormData) => Promise<void>;
  label: string;
}) {
  const [pending, start] = useTransition();
  function toggle() {
    const fd = new FormData();
    fd.set('field', fieldKey);
    fd.set('prop', prop);
    fd.set('value', String(!value));
    hiddens.forEach(([k, v]) => fd.set(k, v));
    start(async () => { await action(fd); });
  }
  const active = value && !disabled;
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || pending}
      className={`text-xs px-2.5 py-1 rounded border whitespace-nowrap transition ${
        active
          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
          : 'border-white/15 text-white/50 hover:bg-white/5'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {active ? '✓ ' : ''}{label}
    </button>
  );
}

function AddExtraForm({
  hiddens, action
}: {
  hiddens: Array<[string, string]>;
  action: (fd: FormData) => Promise<void>;
}) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CheckoutFieldType>('text');
  const [pending, start] = useTransition();

  function add() {
    if (!label.trim()) return;
    const fd = new FormData();
    fd.set('label', label.trim());
    fd.set('type', type);
    hiddens.forEach(([k, v]) => fd.set(k, v));
    start(async () => {
      await action(fd);
      setLabel('');
    });
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 flex flex-wrap items-end gap-2">
      <div className="flex-1 min-w-[180px]">
        <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Etiqueta</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ej: Talle de remera"
          maxLength={80}
          className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
        />
      </div>
      <div className="min-w-[150px]">
        <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Tipo</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as CheckoutFieldType)}
          className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
        >
          {(Object.keys(TYPE_LABELS) as CheckoutFieldType[]).map((t) => (
            <option key={t} value={t} className="bg-[#0a0a0a]">{TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={add}
        disabled={pending || !label.trim()}
        className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90 disabled:opacity-40"
      >
        {pending ? 'Agregando…' : '+ Agregar campo'}
      </button>
    </div>
  );
}

function ExtraFieldRow({
  field, isFirst, isLast, hiddens, actions
}: {
  field: CheckoutField;
  isFirst: boolean;
  isLast: boolean;
  hiddens: Array<[string, string]>;
  actions: Actions;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(field.label);
  const [placeholder, setPlaceholder] = useState(field.placeholder ?? '');
  const [helper, setHelper] = useState(field.helper ?? '');
  const [optionsCsv, setOptionsCsv] = useState((field.options ?? []).join(', '));
  const [required, setRequired] = useState(field.required);
  const [type, setType] = useState<CheckoutFieldType>(field.type);
  const [defaultChecked, setDefaultChecked] = useState(field.default_checked ?? false);
  const [priceDelta, setPriceDelta] = useState(((field.price_delta_cents ?? 0) / 100).toString());
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function withHidden(fd: FormData): FormData {
    fd.set('id', field.id);
    hiddens.forEach(([k, v]) => fd.set(k, v));
    return fd;
  }

  function save() {
    const fd = withHidden(new FormData());
    fd.set('label', label);
    fd.set('placeholder', placeholder);
    fd.set('helper', helper);
    fd.set('required', required ? 'true' : 'false');
    fd.set('type', type);
    if (type === 'select' || type === 'radio' || type === 'multi') fd.set('options', optionsCsv);
    if (type === 'checkbox') {
      fd.set('default_checked', defaultChecked ? 'true' : 'false');
      fd.set('price_delta', priceDelta || '0');
    }
    start(async () => {
      await actions.updateExtra(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function move(dir: 'up' | 'down') {
    const fd = withHidden(new FormData());
    fd.set('dir', dir);
    start(async () => { await actions.moveExtra(fd); });
  }

  function remove() {
    if (!confirm(`¿Borrar el campo "${field.label}"?`)) return;
    const fd = withHidden(new FormData());
    start(async () => { await actions.deleteExtra(fd); });
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.02] text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-white/30 text-sm">{open ? '▾' : '▸'}</span>
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{field.label}</div>
            <div className="text-xs text-white/40">
              {TYPE_LABELS[field.type]}{field.required ? ' · obligatorio' : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span onClick={(e) => { e.stopPropagation(); if (!isFirst) move('up'); }} className={`text-xs px-1.5 py-1 rounded ${isFirst ? 'opacity-20' : 'hover:bg-white/10 cursor-pointer'}`}>▲</span>
          <span onClick={(e) => { e.stopPropagation(); if (!isLast) move('down'); }} className={`text-xs px-1.5 py-1 rounded ${isLast ? 'opacity-20' : 'hover:bg-white/10 cursor-pointer'}`}>▼</span>
          <span onClick={(e) => { e.stopPropagation(); remove(); }} className="text-xs px-1.5 py-1 rounded text-red-300 hover:bg-red-500/10 cursor-pointer">✕</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-white/5 p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Etiqueta visible" value={label} onChange={setLabel} maxLength={80} />
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CheckoutFieldType)}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
              >
                {(Object.keys(TYPE_LABELS) as CheckoutFieldType[]).map((t) => (
                  <option key={t} value={t} className="bg-[#0a0a0a]">{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>
          <Field label="Placeholder (texto gris dentro del input)" value={placeholder} onChange={setPlaceholder} maxLength={120} />
          <Field label="Ayuda (texto chico debajo)" value={helper} onChange={setHelper} maxLength={200} />
          {(type === 'select' || type === 'radio' || type === 'multi') && (
            <div className="space-y-1">
              <Field
                label={`Opciones (separadas por coma)${type === 'multi' ? ' — el cliente puede elegir varias' : ''}`}
                value={optionsCsv}
                onChange={setOptionsCsv}
                placeholder="Plan básico|+0, Plan pro|+5000, Plan VIP|+15000"
              />
              {(type === 'radio' || type === 'multi') && (
                <p className="text-[10px] text-white/45 leading-relaxed">
                  💡 Para sumar/restar al precio total, agregale <code className="bg-black/40 px-1 rounded text-white/70">|+5000</code> o <code className="bg-black/40 px-1 rounded text-white/70">|-1500</code> al final de cada opción.
                  Ej: <code className="bg-black/40 px-1 rounded text-white/70">Sede VIP|+5000</code>.
                </p>
              )}
            </div>
          )}
          {type === 'checkbox' && (
            <div className="grid grid-cols-2 gap-3 rounded-md bg-white/[0.02] border border-white/10 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={defaultChecked} onChange={(e) => setDefaultChecked(e.target.checked)} />
                Pre-tildado por default
              </label>
              <label className="block text-xs text-white/55">
                Suma al precio (ARS) si está tildado
                <input
                  type="number" step="1" value={priceDelta} onChange={(e) => setPriceDelta(e.target.value)}
                  placeholder="0 = no modifica"
                  className="block mt-1 w-full rounded bg-white/5 border border-white/15 px-3 py-1.5 text-sm font-mono text-white"
                />
              </label>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            Obligatorio
          </label>
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded bg-white text-black text-sm font-semibold px-4 py-1.5 hover:bg-white/90 disabled:opacity-40"
            >
              {pending ? 'Guardando…' : 'Guardar'}
            </button>
            {saved && <span className="text-xs text-emerald-300">✓ Guardado</span>}
            <span className="text-xs text-white/30 ml-auto font-mono">key: {field.key}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, maxLength, placeholder
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
      />
    </div>
  );
}
