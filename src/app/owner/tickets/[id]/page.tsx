import { redirect } from 'next/navigation';

export default async function OldTicketRedirect({
  params
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/soporte/${id}`);
}
