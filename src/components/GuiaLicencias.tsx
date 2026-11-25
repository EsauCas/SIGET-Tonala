'use client';

import { FileText } from 'lucide-react';
import { AVISO_REQUISITOS, LICENCIAS } from '@/config/requisitos';

/** Guía visual. El contenido es editable y está marcado como ejemplo. */
export function GuiaLicencias() {
  return (
    <section aria-labelledby="guia-licencias" className="grid gap-5">
      <div>
        <h2 id="guia-licencias" className="text-2xl font-bold text-tinta">
          ¿Qué tipo de licencia necesitas?
        </h2>
        <p className="mt-2 text-lg leading-relaxed text-tinta">
          Elige la que mejor describa tu negocio. En el asistente podrás cambiar
          el tipo si lo necesitas.
        </p>
        <p className="mt-2 text-lg font-semibold text-alerta">{AVISO_REQUISITOS}</p>
      </div>

      <ul className="grid gap-4 md:grid-cols-3">
        {LICENCIAS.map((licencia) => (
          <li
            key={licencia.clave}
            className="rounded-control border-2 border-slate-300 bg-white p-5"
          >
            <FileText aria-hidden="true" className="h-9 w-9 text-enfasis" />
            <h3 className="mt-3 text-xl font-bold text-tinta">{licencia.clave}</h3>
            <p className="mt-2 text-lg leading-relaxed text-tinta">{licencia.resumen}</p>
            <p className="mt-4 text-lg font-semibold text-tinta">Qué tener a la mano:</p>
            <ul className="mt-2 list-disc space-y-2 pl-6 text-lg leading-relaxed text-tinta">
              {licencia.requisitos.map((requisito) => (
                <li key={requisito}>{requisito}</li>
              ))}
            </ul>
            <a
              href="#asistente"
              className="mt-4 inline-flex min-h-control items-center rounded-control border-2 border-enfasis px-5 py-3 text-lg font-bold text-enfasis"
            >
              Ir al asistente
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
