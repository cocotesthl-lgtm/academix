export default async function StorefrontHome({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Catálogo de cursos</h1>
      <p className="opacity-70 mt-2">Tenant: {tenantId}</p>
    </div>
  );
}
