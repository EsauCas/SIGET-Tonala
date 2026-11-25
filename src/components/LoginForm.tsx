'use client';

import Link from 'next/link';
import { Vacio } from '@/components/EstadosVista';
import { BOTON_PRIMARIO } from '@/components/layout/estilos';

/** Esta instalación no tiene contraseñas: se entra con el selector de perfiles. */
export function LoginForm() {
  return (
    <Vacio
      titulo="Entra con un perfil de demostración"
      mensaje="Esta ejecución no usa contraseñas. Elige uno de los cinco perfiles que aparecen arriba y regresa al inicio para ver su panel."
    >
      <Link href="/" className={`${BOTON_PRIMARIO} mt-4`}>
        Ir al inicio
      </Link>
    </Vacio>
  );
}
