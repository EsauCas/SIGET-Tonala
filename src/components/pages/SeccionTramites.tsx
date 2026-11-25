'use client';

import { FileText, ListChecks } from 'lucide-react';
import { AsistenteTramite } from '@/components/AsistenteTramite';
import { GuiaLicencias } from '@/components/GuiaLicencias';
import { ListadoTramites } from '@/components/pages/ListadoTramites';
import { PageShell } from '@/components/layout/PageShell';
import { SeccionCard } from '@/components/layout/SeccionCard';
import { AVISO_REQUISITOS } from '@/config/requisitos';

/** Sección ciudadana: guía + asistente. Toda la lógica vive en cliente. */
export function SeccionTramites() {
  return (
    <PageShell
      titulo="Inicia tu trámite"
      descripcion="¿Qué puedo hacer aquí? Elige la licencia, llena los datos y guarda tu solicitud. Tu avance se conserva si recargas la página."
    >
      <SeccionCard
        numero={1}
        titulo="Elige qué licencia necesitas"
        descripcion="Mira las opciones y qué tener a la mano. Después el asistente te guía."
        icono={<FileText aria-hidden="true" className="h-7 w-7" />}
      >
        <GuiaLicencias />
      </SeccionCard>

      <SeccionCard
        numero={2}
        titulo="Qué necesitas llevar"
        descripcion="Son ejemplos para que prepares tus datos antes de empezar."
        tono="ocre"
        icono={<ListChecks aria-hidden="true" className="h-7 w-7" />}
      >
        <ul className="list-disc space-y-3 pl-7 text-lg leading-relaxed text-tinta">
          <li>Tus datos y los de la persona contribuyente.</li>
          <li>La dirección donde atiendes al público.</li>
          <li>Un croquis sencillo del local, si tu giro lo requiere.</li>
          <li>Tu teléfono para recibir avisos.</li>
        </ul>
        <p className="mt-4 rounded-control border-l-4 border-barro bg-papel px-4 py-3 text-lg font-semibold text-tinta">
          {AVISO_REQUISITOS}
        </p>
      </SeccionCard>

      <SeccionCard
        numero={3}
        titulo="Llena tu solicitud"
        descripcion="Sigue los tres pasos. Puedes volver atrás sin perder lo que escribiste."
      >
        <div id="asistente">
          <AsistenteTramite />
        </div>
      </SeccionCard>

      <SeccionCard
        numero={4}
        titulo="¿Ya iniciaste un trámite?"
        descripcion="Busca su folio aquí para ver cómo va."
        tono="ocre"
      >
        <div id="lista-tramites">
          <ListadoTramites />
        </div>
      </SeccionCard>
    </PageShell>
  );
}
