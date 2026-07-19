/**
 * Bot engine: dado un mensaje entrante + las reglas del tenant,
 * devuelve el texto a responder (o null si ninguna regla matchea).
 *
 * Prioridad de matching:
 *   1. Reglas type='keyword' ordenadas por position (primer match gana)
 *   2. Reglas type='fallback' (siempre matchean si no hubo match previo)
 *
 * Los mensajes de bienvenida (welcome) NO se manejan acá — se
 * disparan al crear una conversación nueva (primer inbound sin
 * historial previo), y se decide en el webhook con el greeting_body
 * de whatsapp_config.
 */

export type BotRule = {
  id: string;
  trigger_type: 'keyword' | 'welcome' | 'fallback';
  keywords: string[] | null;
  match_mode: 'contains' | 'exact' | 'starts_with';
  reply_body: string;
  active: boolean;
  position: number;
};

export type BotContext = {
  customerName?: string | null;
};

/**
 * Reemplaza {{nombre}} y {{name}} en el template con el nombre del
 * cliente. Si no hay nombre, se usa "hola" genérico.
 */
export function renderTemplate(body: string, ctx: BotContext): string {
  const name = (ctx.customerName || '').split(' ')[0] || '';
  return body
    .replaceAll('{{nombre}}', name)
    .replaceAll('{{name}}', name)
    .replaceAll('{{firstname}}', name);
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // sin acentos
    .replace(/[^\w\s]/g, ' ') // sin puntuación
    .replace(/\s+/g, ' ')
    .trim();
}

function ruleMatches(rule: BotRule, incoming: string): boolean {
  if (!rule.active) return false;
  if (rule.trigger_type === 'welcome') return false;
  if (rule.trigger_type === 'fallback') return true;

  const kws = (rule.keywords ?? []).map(normalize).filter(Boolean);
  if (kws.length === 0) return false;
  const msg = normalize(incoming);

  return kws.some((kw) => {
    if (rule.match_mode === 'exact') return msg === kw;
    if (rule.match_mode === 'starts_with') return msg.startsWith(kw);
    return msg.includes(kw); // contains (default)
  });
}

/**
 * Devuelve la respuesta del bot para un incoming dado, o null si no
 * hay match. Corre keyword rules primero (ordenadas por position),
 * después las de fallback si nada matcheó.
 */
export function resolveReply(
  incoming: string,
  rules: BotRule[],
  ctx: BotContext = {}
): { rule: BotRule; body: string } | null {
  const keywordRules = rules
    .filter((r) => r.trigger_type === 'keyword')
    .sort((a, b) => a.position - b.position);
  for (const r of keywordRules) {
    if (ruleMatches(r, incoming)) {
      return { rule: r, body: renderTemplate(r.reply_body, ctx) };
    }
  }
  const fallback = rules.find((r) => r.trigger_type === 'fallback' && r.active);
  if (fallback) {
    return { rule: fallback, body: renderTemplate(fallback.reply_body, ctx) };
  }
  return null;
}

/**
 * Comprueba si el horario actual está dentro del rango away_start/end
 * (formato "HH:MM" del tenant). Simple: usa hora del servidor.
 * TODO: incorporar timezone del tenant cuando se agregue el campo.
 */
export function isWithinAwayWindow(
  awayStart: string | null,
  awayEnd: string | null,
  now: Date = new Date()
): boolean {
  if (!awayStart || !awayEnd) return false;
  const [sh, sm] = awayStart.split(':').map(Number);
  const [eh, em] = awayEnd.split(':').map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = sh * 60 + (sm || 0);
  const e = eh * 60 + (em || 0);
  // Rango wrap-around (ej: 22:00 → 08:00)
  if (s <= e) return cur >= s && cur < e;
  return cur >= s || cur < e;
}
