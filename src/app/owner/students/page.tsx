import { redirect } from 'next/navigation';

/**
 * /students es el nombre viejo del panel. Lo dejamos por compat con
 * links viejos y bookmarks, pero redirige a /clientes (terminología
 * unificada del proyecto).
 */
export default function OldStudentsRedirect() {
  redirect('/clientes');
}
