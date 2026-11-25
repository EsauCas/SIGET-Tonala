'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface Enlace {
  href: string;
  etiqueta: string;
}

const ENLACES: readonly Enlace[] = [
  { href: '/', etiqueta: 'Inicio' },
  { href: '/tramites', etiqueta: 'Trámites' },
  { href: '/gestion', etiqueta: 'Gestión' },
  { href: '/historial', etiqueta: 'Historial' }
];

/** Navegación principal con menú móvil y foco nativo por teclado. */
export function Navbar() {
  const pathname = usePathname();
  const { perfil } = useAuth();
  const [abierto, setAbierto] = useState(false);

  const enlaces: readonly Enlace[] =
    perfil?.rol === 'admin'
      ? [...ENLACES, { href: '/admin', etiqueta: 'Administración' }]
      : ENLACES;

  return (
    <header className="border-b border-slate-300 bg-white">
      <nav aria-label="Navegación principal" className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-5 py-4">
        <Link href="/" className="text-xl font-bold text-tinta">
          SIGET-Tonalá
        </Link>

        <button
          type="button"
          aria-expanded={abierto}
          aria-controls="menu-principal"
          onClick={() => setAbierto((valor) => !valor)}
          className="ml-auto inline-flex min-h-tactil items-center gap-2 rounded-control border-2 border-enfasis px-4 py-2 text-lg font-semibold text-enfasis md:hidden"
        >
          {abierto ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          {abierto ? 'Cerrar menú' : 'Abrir menú'}
        </button>

        <ul
          id="menu-principal"
          className={`${abierto ? 'flex' : 'hidden'} w-full flex-col gap-2 md:ml-auto md:flex md:w-auto md:flex-row md:items-center md:gap-1`}
        >
          {enlaces.map((enlace) => {
            const activo = pathname === enlace.href;
            return (
              <li key={enlace.href}>
                <Link
                  href={enlace.href}
                  aria-current={activo ? 'page' : undefined}
                  onClick={() => setAbierto(false)}
                  className={`block min-h-tactil rounded-control px-4 py-2 text-lg font-semibold ${
                    activo ? 'bg-blue-100 text-enfasis underline' : 'text-tinta hover:bg-slate-100'
                  }`}
                >
                  {enlace.etiqueta}
                </Link>
              </li>
            );
          })}
        </ul>

        {perfil && (
          <p className="w-full text-base text-tinta md:w-auto">
            {perfil.nombre} · demostración
          </p>
        )}
      </nav>
    </header>
  );
}
