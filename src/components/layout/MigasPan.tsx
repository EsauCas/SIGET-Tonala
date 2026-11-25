'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Miga {
  etiqueta: string;
  href?: string;
}

function construir(pathname: string): Miga[] {
  const migas: Miga[] = [{ etiqueta: 'Inicio', href: '/' }];
  if (pathname === '/') return migas;

  const segmentos = pathname.split('/').filter(Boolean);
  const etiquetas: Record<string, string> = {
    tramites: 'Trámites',
    gestion: 'Gestionar trámites',
    historial: 'Historial',
    admin: 'Administración',
    nuevo: 'Nuevo trámite',
    login: 'Iniciar sesión'
  };

  segmentos.forEach((segmento, indice) => {
    const ultimo = indice === segmentos.length - 1;
    const etiqueta =
      etiquetas[segmento] ??
      (segmento.length === 36 || segmento.includes('tramite-') ? 'Detalle del trámite' : segmento);
    migas.push(ultimo ? { etiqueta } : { etiqueta, href: `/${segmentos.slice(0, indice + 1).join('/')}` });
  });
  return migas;
}

/** Ruta visible y audible: la persona siempre sabe dónde está. */
export function MigasPan() {
  const pathname = usePathname();
  const migas = construir(pathname);
  if (migas.length === 1) return null;

  return (
    <nav
      aria-label="Ruta de navegación"
      className="mx-auto w-full max-w-7xl px-4 py-3 text-lg text-tinta"
    >
      <ol className="flex flex-wrap items-center gap-2">
        {migas.map((miga, indice) => (
          <li key={`${miga.etiqueta}-${indice}`} className="flex items-center gap-2">
            {indice > 0 && <span aria-hidden="true">›</span>}
            {miga.href ? (
              <Link
                href={miga.href}
                className="inline-flex min-h-control items-center font-semibold underline decoration-2 underline-offset-4"
              >
                {miga.etiqueta}
              </Link>
            ) : (
              <span aria-current="page" className="font-bold">
                {miga.etiqueta}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
