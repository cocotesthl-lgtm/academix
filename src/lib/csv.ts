import 'server-only';

/**
 * Helper CSV-safe. Escapa comillas dobles + envuelve si tiene caracteres
 * problemáticos (coma, comilla, salto de línea).
 */
export function csvCell(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const s = String(raw);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',');
}

export function csvString(headers: string[], rows: unknown[][]): string {
  // BOM para que Excel detecte UTF-8 (sin esto los acentos rompen en Excel ES)
  return '﻿' + [csvRow(headers), ...rows.map(csvRow)].join('\r\n');
}

/** Helper para nombre de archivo descargable. */
export function csvFilename(prefix: string, tenantSlug?: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = tenantSlug ? `${tenantSlug}-` : '';
  return `${slug}${prefix}-${date}.csv`;
}
