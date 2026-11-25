import type { ReactNode } from 'react';

interface MensajeVacioProps {
  titulo: string;
  descripcion: string;
  accion?: ReactNode;
}

/** Estado vacío útil: siempre dice cuál es el siguiente paso. */
export function MensajeVacio({ titulo, descripcion, accion }: MensajeVacioProps) {
  return (
    <div role="status" className="rounded-control border-2 border-arena bg-superficie p-6">
      <h3 className="text-xl font-bold text-cafe">{titulo}</h3>
      <p className="mt-2 text-lg leading-relaxed text-tinta">{descripcion}</p>
      {accion && <div className="mt-5 flex flex-wrap gap-3">{accion}</div>}
    </div>
  );
}
