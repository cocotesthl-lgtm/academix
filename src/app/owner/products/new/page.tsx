import { createProductAction } from '@/lib/products/actions';

export const dynamic = 'force-dynamic';

/**
 * /owner/products/new — stub que dispara la creación del producto
 * físico y redirige al editor. createProductAction ya hace el redirect
 * a /products/[id] internamente.
 *
 * Es un endpoint "acción como página" para que "+ Nuevo" en Mis publicaciones
 * pueda ser un Link normal en vez de un form. Idempotente vía slug
 * autogenerado ("nuevo-producto", "nuevo-producto-2", …).
 */
export default async function NewProductPage() {
  await createProductAction();
  return null; // createProductAction hace redirect
}
