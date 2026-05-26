import { NewCourseForm } from "@/components/owner/courses/NewCourseForm";

export const dynamic = "force-dynamic";

export default function NewCoursePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nuevo curso</h1>
        <p className="text-white/60 text-sm mt-1">
          Después de crearlo vas a poder agregar módulos y lecciones.
        </p>
      </div>
      <NewCourseForm />
    </div>
  );
}
