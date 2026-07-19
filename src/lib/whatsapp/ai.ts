/**
 * Integración con Claude (Anthropic API) para respuestas contextuales
 * del bot de WhatsApp. Se activa como FALLBACK cuando ninguna regla
 * keyword matchea Y el owner habilitó IA en la config.
 *
 * El endpoint corre en el webhook (nodejs runtime), y la API key es
 * global de plataforma (ANTHROPIC_API_KEY en ENV). Cada tenant puede
 * setear su propio system_prompt (personalidad + información del
 * negocio) y decidir cuándo dispararla.
 *
 * Doc del modelo Claude: usamos claude-haiku-4-5 por velocidad y costo
 * — respuestas de WhatsApp deben llegar en <5s para no perder al usuario.
 */

export type AiConfig = {
  enabled: boolean;
  system_prompt: string | null;
  model?: string;
  max_tokens?: number;
};

export type AiHistoryMsg = {
  role: 'user' | 'assistant';
  content: string;
};

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_MAX_TOKENS = 400;

/**
 * Llama a la Messages API de Anthropic con el historial de la
 * conversación y devuelve el texto de respuesta. Retorna null si:
 *   - IA no está habilitada
 *   - No hay ANTHROPIC_API_KEY seteada
 *   - Timeout / error de red / respuesta vacía
 *
 * Silencioso ante error para no romper el flujo del webhook — si la
 * IA falla, la conversación simplemente queda sin auto-reply.
 */
export async function resolveAiReply(
  cfg: AiConfig,
  incoming: string,
  history: AiHistoryMsg[],
  ctx: { customerName?: string | null; businessName?: string | null } = {}
): Promise<string | null> {
  if (!cfg.enabled) return null;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const systemBase = (cfg.system_prompt || 'Sos un asistente de atención al cliente por WhatsApp. Respondé en español, breve (2-4 oraciones), amable y profesional. Si no sabés algo, decilo con honestidad y ofrecé que un humano lo responda.').trim();
  const systemAugmented = [
    systemBase,
    ctx.customerName ? `El cliente se llama ${ctx.customerName}.` : '',
    ctx.businessName ? `El negocio se llama ${ctx.businessName}.` : '',
    'Nunca inventes precios, plazos, direcciones ni datos que no estén en tu contexto.',
    'Nunca prometas descuentos ni te comprometas en nombre del negocio a cosas que no fueron confirmadas.'
  ].filter(Boolean).join('\n');

  // Armamos messages con historial + turno actual. La API requiere que el
  // último mensaje sea del user.
  const messages = [
    ...history.slice(-10), // últimos 10 turnos como máximo
    { role: 'user' as const, content: incoming }
  ];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: cfg.model || DEFAULT_MODEL,
        max_tokens: cfg.max_tokens || DEFAULT_MAX_TOKENS,
        system: systemAugmented,
        messages
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const json = await res.json() as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = (json.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text || '').join('').trim();
    if (!text) return null;
    // Sanity clamp: no vaya a mandar un mensaje kilométrico por accidente
    return text.slice(0, 4000);
  } catch {
    return null;
  }
}
