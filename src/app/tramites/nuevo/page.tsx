import { AsistenteTramite } from '@/components/AsistenteTramite';

export const metadata = { title: 'Nuevo trámite · SIGET-Tonalá' };

/** Atajo histórico al mismo asistente de tres pasos de /tramites. */
export default function PaginaNuevoTramite() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10">
      <h1 className="text-3xl font-bold text-cafe">Iniciar nuevo trámite</h1>
      <p className="mt-3 text-lg leading-relaxed text-tinta">
        Llena los datos de tu negocio. Los campos marcados como (obligatorio) son necesarios.
        Después podrás ver en qué etapa va tu solicitud.
      </p>
      <div className="mt-8">
        <AsistenteTramite />
      </div>
    </main>
  );
}
