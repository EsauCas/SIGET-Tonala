'use client';

import { FileText } from 'lucide-react';
import { LICENCIAS } from '@/config/requisitos';

/** Tarjetas de licencia. El contenido es editable y está marcado como ejemplo. */
export function GuiaLicencias() {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {LICENCIAS.map((licencia) => (
        <li
          key={licencia.clave}
          className="rounded-control border-2 border-arena bg-superficie p-5"
        >
          <FileText aria-hidden="true" className="h-9 w-9 text-barro" />
          <h3 className="mt-3 text-xl font-bold text-cafe">{licencia.clave}</h3>
          <p className="mt-2 text-lg leading-relaxed text-tinta">{licencia.resumen}</p>
          <p className="mt-4 text-lg font-bold text-tinta">Qué tener a la mano:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6 text-lg leading-relaxed text-tinta">
            {licencia.requisitos.map((requisito) => (
              <li key={requisito}>{requisito}</li>
            ))}
          </ul>
          <a
            href="#asistente"
            className="mt-4 inline-flex min-h-control items-center rounded-control border-2 border-barro px-5 py-3 text-lg font-bold text-barro"
          >
            Ir al asistente
          </a>
        </li>
      ))}
    </ul>
  );
}
