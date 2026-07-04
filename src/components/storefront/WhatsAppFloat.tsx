/**
 * Botón flotante de WhatsApp en la esquina inferior del storefront.
 * Server component — no requiere estado.
 *
 * Renderea SOLO si el owner configuró un número. Si no, no aparece.
 * El link abre wa.me con el greeting pre-cargado (encoded).
 */
export function WhatsAppFloat({
  number,
  greeting,
  position = 'right'
}: {
  number: string | null | undefined;
  greeting: string | null | undefined;
  position?: 'left' | 'right';
}) {
  if (!number) return null;

  const url = greeting
    ? `https://wa.me/${number}?text=${encodeURIComponent(greeting)}`
    : `https://wa.me/${number}`;

  const pos = position === 'left' ? 'left-4' : 'right-4';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      title="Chateá con nosotros por WhatsApp"
      className={`fixed bottom-4 ${pos} z-40 w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20BA5A] shadow-2xl flex items-center justify-center transition hover:scale-110 group`}
    >
      <svg width="30" height="30" viewBox="0 0 32 32" fill="white" aria-hidden>
        <path d="M16 0C7.164 0 0 7.164 0 16c0 2.822.735 5.572 2.132 7.995L.062 32l8.207-2.152A15.936 15.936 0 0 0 16 32c8.836 0 16-7.164 16-16S24.836 0 16 0zm0 29.212a13.19 13.19 0 0 1-6.71-1.836l-.481-.286-4.867 1.277 1.301-4.746-.313-.498a13.213 13.213 0 0 1-2.026-7.123c0-7.29 5.933-13.222 13.222-13.222 3.531 0 6.85 1.376 9.348 3.874a13.135 13.135 0 0 1 3.874 9.348c0 7.29-5.933 13.222-13.222 13.222zm7.245-9.9c-.397-.198-2.352-1.161-2.716-1.294-.364-.132-.629-.198-.894.198-.264.397-1.026 1.294-1.257 1.559-.231.264-.463.297-.86.099-.397-.198-1.676-.618-3.195-1.972-1.181-1.053-1.979-2.353-2.211-2.75-.231-.397-.025-.612.174-.81.179-.178.397-.463.596-.694.198-.231.264-.397.397-.661.132-.264.066-.496-.033-.694-.099-.199-.894-2.155-1.225-2.951-.323-.775-.65-.67-.894-.683-.231-.011-.496-.014-.76-.014a1.46 1.46 0 0 0-1.059.496c-.364.397-1.39 1.359-1.39 3.315 0 1.955 1.423 3.844 1.621 4.108.199.264 2.802 4.279 6.788 6 .949.41 1.688.655 2.266.838.952.302 1.818.259 2.502.157.763-.114 2.352-.962 2.684-1.891.331-.929.331-1.726.231-1.891-.099-.165-.364-.264-.76-.463z"/>
      </svg>
      <span className="absolute right-full mr-3 whitespace-nowrap bg-black/85 text-white text-xs font-medium px-3 py-1.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none">
        Chateá con nosotros
      </span>
    </a>
  );
}
