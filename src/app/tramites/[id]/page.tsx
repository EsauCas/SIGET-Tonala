import { DetalleTramite } from '@/components/DetalleTramite';

export const metadata = { title: 'Detalle del trámite · SIGET-Tonalá' };

export default async function PaginaDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DetalleTramite id={id} />;
}
