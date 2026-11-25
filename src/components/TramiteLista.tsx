'use client';

import Link from 'next/link';
import { deriveEstadoGeneral } from '@/lib/domain/estado-tramite';
import type { ColorSemaforo, TramiteConDetalle } from '@/types/database';

const CLASES: Readonly<Record<ColorSemaforo, string>> = {
  gris: 'border-slate-500 bg-slate-100 text-tinta',
  azul: 'border-semaforo-azul bg-blue-100 text-enfasis',
  ambar: 'border-semaforo-ambar bg-amber-100 text-semaforo-ambar',
  rojo: 'border-semaforo-rojo bg-red-100 text-semaforo-rojo',
  verde: 'border-semaforo-verde bg-green-100 text-semaforo-verde'
};

export function EtiquetaEstado({ tramite }: { tramite: TramiteConDetalle }) {
  const resultado = deriveEstadoGeneral(tramite.dependencias);
  return (
    <span className={`inline-block rounded-control border-2 px-3 py-1 text-base font-bold ${CLASES[resultado.color]}`}>
      {resultado.etiqueta}
    </span>
  );
}

export function ListaTramites({ tramites }: { tramites: readonly TramiteConDetalle[] }) {
  return (
    <ul className="mt-4 grid gap-3">
      {tramites.map((tramite) => (
        <li key={tramite.id} className="rounded-control border border-slate-300 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-tinta">{tramite.folio}</p>
              <p className="text-lg text-tinta">
                {tramite.giro_principal} · {tramite.colonia}
              </p>
              <p className="text-base text-tinta">
                Registro: {tramite.created_at.slice(0, 10)}
              </p>
            </div>
            <EtiquetaEstado tramite={tramite} />
          </div>
          <Link
            href={`/tramites/${tramite.id}`}
            className="mt-3 inline-flex min-h-tactil items-center rounded-control bg-enfasis px-4 py-2 text-lg font-semibold text-white"
          >
            Ver detalle de {tramite.folio}
          </Link>
        </li>
      ))}
    </ul>
  );
}
