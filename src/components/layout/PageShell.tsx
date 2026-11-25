import type { ReactNode } from 'react';

interface PageShellProps {
  titulo: string;
  descripcion: string;
  accionPrincipal?: ReactNode;
  accionesSecundarias?: ReactNode;
  children: ReactNode;
}

/** Molde común: título, una acción principal, secciones y pie global. */
export function PageShell({
  titulo,
  descripcion,
  accionPrincipal,
  accionesSecundarias,
  children
}: PageShellProps) {
  return (
    <main id="contenido" className="mx-auto w-full max-w-7xl px-4 py-8">
      <header className="max-w-4xl">
        <h1 className="text-3xl font-bold leading-tight text-cafe">{titulo}</h1>
        <p className="mt-3 text-lg leading-relaxed text-tinta">{descripcion}</p>
        {accionPrincipal && <div className="mt-6">{accionPrincipal}</div>}
        {accionesSecundarias && (
          <div className="mt-3 flex flex-wrap gap-3">{accionesSecundarias}</div>
        )}
      </header>

      <div className="mt-8 grid gap-8">{children}</div>
    </main>
  );
}
