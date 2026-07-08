import { NewCourseForm } from "@/components/owner/courses/NewCourseForm";
import { requireOwner } from "@/lib/auth/guards";
import { getTenantModules } from "@/lib/modules/queries";

export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  // Cargamos los módulos activos del tenant → el wizard filtra los product
  // types en base a esto. Ej: si 'ecommerce' está apagado, no aparece
  // 'Producto físico' como opción.
  const { tenant } = await requireOwner();
  const modules = await getTenantModules(tenant.id);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nueva publicación</h1>
        <p className="text-white/60 text-sm mt-1">
          Después de crearlo vas a poder agregar módulos y lecciones.
        </p>
      </div>
      <NewCourseForm modules={modules} />
    </div>
  );
}
