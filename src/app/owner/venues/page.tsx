import { redirect } from 'next/navigation';

// La gestión de sedes vive ahora dentro de /owner/eventos/calendario
// (sección "Sedes / Sucursales"). Redirigimos cualquier bookmark/link viejo.
export default function VenuesPageRedirect() {
  redirect('/owner/eventos/calendario#sedes');
}
