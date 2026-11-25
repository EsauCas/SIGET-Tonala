'use client';

import { useId, type ReactNode } from 'react';

interface SeccionCardProps {
  titulo: string;
  descripcion?: string;
  numero?: number;
  icono?: ReactNode;
  tono?: 'cafe' | 'ocre';
  accion?: ReactNode;
  children: ReactNode;
}

/** Tarjeta de sección con banda, borde grueso y acción alineada a la izquierda. */
export function SeccionCard({
  titulo,
  descripcion,
  numero,
  icono,
  tono = 'cafe',
  accion,
  children
}: SeccionCardProps) {
  const id = useId();
  const banda = tono === 'ocre' ? 'bg-ocre text-tinta' : 'bg-cafe text-white';

  return (
    <section aria-labelledby={id}>
      <div aria-hidden="true" className="h-px w-full bg-arena" />
      <div className="mt-6 overflow-hidden rounded-control border-2 border-arena bg-superficie">
        <div className={`flex flex-wrap items-center gap-4 px-5 py-4 ${banda}`}>
          <span
            aria-hidden="true"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 ${
              tono === 'ocre' ? 'border-cafe text-cafe' : 'border-ocre text-tinta'
            } bg-ocre text-xl font-bold`}
          >
            {numero ?? icono ?? '•'}
          </span>
          <div className="min-w-0">
            <h2 id={id} className="text-xl font-bold leading-tight">
              {titulo}
            </h2>
            {descripcion && <p className="mt-1 text-lg">{descripcion}</p>}
          </div>
        </div>

        <div className="border-l-8 border-barro p-5">
          {children}
          {accion && <div className="mt-6 flex flex-wrap gap-3">{accion}</div>}
        </div>
      </div>
    </section>
  );
}
