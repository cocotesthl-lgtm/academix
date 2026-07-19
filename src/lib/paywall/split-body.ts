/**
 * Corta un body_html en 2 partes al terminar el N-ésimo `</p>`.
 * Los `<figure>` intermedios cuentan como contenido normal — se
 * quedan en la parte del corte donde caigan naturalmente.
 *
 * Si hay menos de N párrafos, `rest` sale vacío y `free` es todo
 * el body (comportamiento equivalente a "sin paywall" para notas
 * cortas — evita el UX rota de "3 párrafos gratis" en una nota de 2).
 */
export function splitBodyAtParagraph(
  bodyHtml: string,
  n: number
): { free: string; rest: string } {
  const parts: number[] = [];
  const re = /<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyHtml)) !== null) parts.push(m.index + m[0].length);
  if (parts.length <= n) return { free: bodyHtml, rest: '' };
  const cutAt = parts[n - 1];
  return {
    free: bodyHtml.slice(0, cutAt),
    rest: bodyHtml.slice(cutAt)
  };
}
