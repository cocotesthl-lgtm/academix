/**
 * Catálogo único de redes/comunidades soportadas en community_links.
 * Usado por owner panel (select) y affiliate panel (render).
 */
export type NetworkKey = 'whatsapp' | 'telegram' | 'discord' | 'facebook' | 'reddit' | 'instagram' | 'other';

export const NETWORKS: ReadonlyArray<{ key: NetworkKey; emoji: string; label: string }> = [
  { key: 'whatsapp',  emoji: '💚', label: 'WhatsApp'  },
  { key: 'telegram',  emoji: '✈️', label: 'Telegram'  },
  { key: 'discord',   emoji: '🎮', label: 'Discord'   },
  { key: 'facebook',  emoji: '📘', label: 'Facebook'  },
  { key: 'reddit',    emoji: '🤖', label: 'Reddit'    },
  { key: 'instagram', emoji: '📸', label: 'Instagram' },
  { key: 'other',     emoji: '🔗', label: 'Otro'      }
];

export const NETWORK_EMOJI: Record<string, string> = Object.fromEntries(
  NETWORKS.map((n) => [n.key, n.emoji])
);
