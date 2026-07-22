import { redirect } from 'next/navigation';

// La gestión de dominio vive ahora dentro de /owner/branding
// (sección "Dominio"). Redirect para preservar bookmarks/links viejos.
export default function DominioPageRedirect() {
  redirect('/owner/branding#dominio');
}
