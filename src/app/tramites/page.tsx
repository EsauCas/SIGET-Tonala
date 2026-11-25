import { SeccionTramites } from '@/components/pages/SeccionTramites';

export const metadata = { title: 'Trámites · SIGET-Tonalá' };

/** Server Component delgado: la guía y el asistente se montan en cliente. */
export default function PaginaTramites() {
  return <SeccionTramites />;
}
