'use client';

import { AsistenteTramite } from '@/components/AsistenteTramite';
import { GuiaLicencias } from '@/components/GuiaLicencias';
import { ListadoTramites } from '@/components/pages/ListadoTramites';

/** Sección ciudadana: guía + asistente. Toda la lógica vive en cliente. */
export function SeccionTramites() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-10">
      <header>
        <h1 className="text-3xl font-bold text-tinta">Inicia tu trámite</h1>
        <p className="mt-2 text-lg leading-relaxed text-tinta">
          Primero conoce las opciones y después sigue el asistente, paso por paso.
          Tu avance se conserva si recargas la página.
        </p>
      </header>

      <GuiaLicencias />

      <div className="border-t-4 border-enfasis pt-8">
        <AsistenteTramite />
      </div>

      <p className="text-lg text-tinta">
        ¿Ya iniciaste un trámite?{' '}
        <a href="#lista-tramites" className="font-semibold text-enfasis underline">
          Busca su folio en el listado de abajo.
        </a>
      </p>
      <div id="lista-tramites" className="border-t-4 border-enfasis pt-8">
        <ListadoTramites />
      </div>
    </main>
  );
}
