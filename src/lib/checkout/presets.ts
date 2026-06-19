import type { CheckoutConfig } from './types';

export type CheckoutPresetId = 'minimal' | 'standard' | 'full' | 'shipping' | 'event';

export const PRESETS: Record<CheckoutPresetId, CheckoutConfig> = {
  minimal: {
    base_fields: {
      name:     { enabled: true,  required: true },
      dni:      { enabled: false, required: false },
      phone:    { enabled: false, required: false },
      location: { enabled: false, required: false }
    },
    extra_fields: []
  },
  standard: {
    base_fields: {
      name:     { enabled: true, required: true },
      dni:      { enabled: true, required: true },
      phone:    { enabled: true, required: true },
      location: { enabled: false, required: false }
    },
    extra_fields: []
  },
  full: {
    base_fields: {
      name:     { enabled: true, required: true },
      dni:      { enabled: true, required: true },
      phone:    { enabled: true, required: true },
      location: { enabled: true, required: true }
    },
    extra_fields: []
  },
  shipping: {
    base_fields: {
      name:     { enabled: true, required: true },
      dni:      { enabled: true, required: true },
      phone:    { enabled: true, required: true },
      location: { enabled: true, required: true }
    },
    extra_fields: [
      { id: 'p-addr',   key: 'shipping_address', label: 'Dirección de envío', type: 'textarea', required: true,  position: 1, placeholder: 'Calle, número, piso, depto' },
      { id: 'p-cp',     key: 'shipping_zip',     label: 'Código postal',      type: 'text',     required: true,  position: 2 },
      { id: 'p-notes',  key: 'shipping_notes',   label: 'Notas para el envío', type: 'textarea', required: false, position: 3, placeholder: 'Timbre, horario preferido, referencias.' }
    ]
  },
  event: {
    base_fields: {
      name:     { enabled: true, required: true },
      dni:      { enabled: true, required: true },
      phone:    { enabled: true, required: true },
      location: { enabled: false, required: false }
    },
    extra_fields: [
      { id: 'p-attendees', key: 'attendees', label: '¿Cuántas personas asisten?', type: 'number',   required: true,  position: 1 },
      { id: 'p-allergies', key: 'allergies', label: 'Alergias / restricciones',   type: 'textarea', required: false, position: 2 }
    ]
  }
};

export const CHECKOUT_PRESETS: Array<{ id: CheckoutPresetId; emoji: string; label: string; description: string }> = [
  { id: 'minimal',  emoji: '⚡', label: 'Mínimo',          description: 'Sólo email + nombre. Para infoproductos digitales o suscripciones puras.' },
  { id: 'standard', emoji: '✅', label: 'Estándar',        description: 'Email, nombre, DNI y celular. El más común para cursos.' },
  { id: 'full',     emoji: '📋', label: 'Completo',        description: 'Estándar + ubicación. Útil si querés datos de marketing.' },
  { id: 'shipping', emoji: '📦', label: 'Producto físico', description: 'Estándar + dirección de envío + CP + notas.' },
  { id: 'event',    emoji: '🎟️', label: 'Evento',          description: 'Estándar + cantidad de asistentes + alergias.' }
];
