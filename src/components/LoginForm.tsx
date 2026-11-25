'use client';

import Link from 'next/link';
import { Vacio } from '@/components/EstadosVista';

/** Esta instalación no tiene contraseñas: se entra con el selector de perfiles. */
export function LoginForm() {
  return (
    <Vacio
      titulo="Entra con un perfil de demostración"
      mensaje="Esta ejecución no usa contraseñas. Elige uno de los cinco perfiles que aparecen arriba y regresa al inicio para ver su panel."
    >
      <Link
        href="/"
        className="mt-4 inline-flex min-h-control items-center rounded-control bg-enfasis px-5 py-3 text-lg font-semibold text-white"
      >
        Ir al inicio
      </Link>
    </Vacio>
  );
}
