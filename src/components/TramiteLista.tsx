'use client';

import { AlertTriangle, CheckCircle2, Circle, Clock3 } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BOTON_PRIMARIO } from '@/components/layout/estilos';
import { deriveEstadoGeneral } from '@/lib/domain/estado-tramite';
import type { ColorSemaforo, TramiteConDetalle } from '@/types/database';

const CLASES: Readonly<Record<ColorSemaforo, string>> = {
  gris: 'border-l-semaforo-gris bg-semaforo-fondo-gris text-tinta',
  azul: 'border-l-semaforo-azul bg-semaforo-fondo-azul text-tinta',
  ambar: 'border-l-semaforo-ambar bg-semaforo-fondo-ambar text-tinta',
  rojo: 'border-l-semaforo-rojo bg-semaforo-fondo-rojo text-tinta',
  verde: 'border-l-semaforo-verde bg-semaforo-fondo-verde text-tinta'
};

const ICONOS: Readonly<Record<ColorSemaforo, ReactNode>> = {
  gris: <Circle aria-hidden="true" className="h-4 w-4 shrink-0" />,
  azul: <Clock3 aria-hidden="true" className="h-4 w-4 shrink-0" />,
  ambar: <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />,
  rojo: <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />,
  verde: <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
};

export function EtiquetaEstado({ tramite }: { tramite: TramiteConDetalle }) {
  const resultado = deriveEstadoGeneral(tramite.dependencias);
  return (
    <span
      className={`inline-flex min-h-[36px] items-center gap-2 rounded-control border-2 border-l-8 border-arena px-3 py-1 text-lg font-bold ${CLASES[resultado.color]}`}
    >
      {ICONOS[resultado.color]}
      {resultado.etiqueta}
    </span>
  );
}

export function ListaTramites({ tramites }: { tramites: readonly TramiteConDetalle[] }) {
  return (
    <ul className="mt-4 grid gap-3">
      {tramites.map((tramite) => (
        <li key={tramite.id} className="rounded-control border-2 border-arena bg-superficie p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-tinta">{tramite.folio}</p>
              <p className="mt-1 text-lg text-tinta">
                {tramite.giro_principal} · {tramite.colonia}
              </p>
              <p className="mt-1 text-lg leading-relaxed text-tinta">
                Registro: {tramite.created_at.slice(0, 10)}
              </p>
            </div>
            <EtiquetaEstado tramite={tramite} />
          </div>
          <Link href={`/tramites/${tramite.id}`} className={`${BOTON_PRIMARIO} mt-4`}>
            Ver detalle de {tramite.folio}
          </Link>
        </li>
      ))}
    </ul>
  );
}
