import Link from 'next/link';
import type { ReactNode } from 'react';

interface TarjetaAccionProps {
  href: string;
  titulo: string;
  descripcion: string;
  cta: string;
  icono: ReactNode;
  destacada?: boolean;
}

/** Tarjeta grande de acción: enlace real, con ícono, texto y verbo concreto. */
export function TarjetaAccion({
  href,
  titulo,
  descripcion,
  cta,
  icono,
  destacada = false
}: TarjetaAccionProps) {
  return (
    <Link
      href={href}
      className={`flex min-h-[180px] flex-col rounded-control border-2 p-6 text-tinta ${
        destacada ? 'border-barro bg-superficie' : 'border-arena bg-superficie'
      }`}
    >
      <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-ocre">
        {icono}
      </span>
      <strong className="mt-4 text-xl font-bold leading-tight">{titulo}</strong>
      <span className="mt-2 block flex-1 text-lg leading-relaxed">{descripcion}</span>
      <span className="mt-5 inline-flex min-h-[52px] items-center justify-center rounded-control bg-barro px-5 py-3 text-lg font-bold text-white">
        {cta}
      </span>
    </Link>
  );
}
