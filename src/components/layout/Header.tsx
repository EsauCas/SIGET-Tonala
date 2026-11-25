'use client';

import { ClipboardCheck, ClipboardList, History, House, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import { ControlTamanoLetra } from '@/components/layout/ControlTamanoLetra';
import { MigasPan } from '@/components/layout/MigasPan';
import { PerfilDemo } from '@/components/layout/PerfilDemo';
import { useAuth } from '@/components/AuthProvider';

interface Enlace {
  href: string;
  etiqueta: string;
  Icono: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const ENLACES: readonly Enlace[] = [
  { href: '/', etiqueta: 'Inicio', Icono: House },
  { href: '/tramites', etiqueta: 'Trámites', Icono: ClipboardList },
  { href: '/gestion', etiqueta: 'Gestionar trámites', Icono: ClipboardCheck },
  { href: '/historial', etiqueta: 'Historial', Icono: History },
  { href: '/admin', etiqueta: 'Administración', Icono: ShieldCheck }
];

function Vasija() {
  return (
    <svg width="44" height="44" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        d="M18 6h12v5l-2 4c7 3 11 9 11 17 0 8-7 12-15 12S9 40 9 32c0-8 4-14 11-17l-2-4V6Z"
        fill="#E8B04B"
        stroke="#FFFFFF"
        strokeWidth="2"
      />
      <path d="M15 30c5 3 13 3 18 0M17 37c4 2 10 2 14 0" stroke="#4A2C1A" strokeWidth="2" fill="none" />
      <rect x="17" y="3" width="14" height="5" rx="2" fill="#FFFFFF" />
    </svg>
  );
}

/** Encabezado único: identidad, perfil, tamaño de letra y navegación siempre visible. */
export function Header() {
  const pathname = usePathname();
  const { perfil } = useAuth();
  const enlaces = ENLACES.filter((enlace) => enlace.href !== '/admin' || perfil?.rol === 'admin');

  return (
    <>
      <header className="w-full bg-cafe text-white">
        <div className="h-3 w-full overflow-hidden" aria-hidden="true">
          <svg width="100%" height="12" preserveAspectRatio="none" focusable="false">
            <defs>
              <pattern id="petatillo" width="32" height="12" patternUnits="userSpaceOnUse">
                <path d="M0 6 6 0M6 12 12 0M12 6 18 0M18 12 24 0M24 6 30 0" stroke="#E8B04B" strokeWidth="2" />
              </pattern>
            </defs>
            <rect width="100%" height="12" fill="url(#petatillo)" />
          </svg>
        </div>

        <div className="mx-auto w-full max-w-7xl px-4 pb-4 pt-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <Link href="/" className="flex min-h-[52px] items-center gap-3 rounded-control">
              <Vasija />
              <span>
                <span className="block text-2xl font-bold leading-tight">SIGET Tonalá</span>
                <span className="block text-lg">Padrón y Licencias</span>
              </span>
            </Link>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[540px]">
              <PerfilDemo />
              <ControlTamanoLetra />
            </div>
          </div>

          <nav aria-label="Navegación principal" className="mt-5">
            <ul className="grid grid-cols-2 gap-3 lg:flex lg:flex-wrap">
              {enlaces.map(({ href, etiqueta, Icono }) => {
                const activo = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
                return (
                  <li key={href} className={href === '/admin' ? 'col-span-2 lg:col-span-1' : ''}>
                    <Link
                      href={href}
                      aria-current={activo ? 'page' : undefined}
                      className={`flex min-h-[52px] items-center justify-center gap-2 rounded-control border-2 px-3 py-2 text-lg font-semibold ${
                        activo
                          ? 'border-ocre bg-ocre text-tinta underline decoration-4 underline-offset-4'
                          : 'border-arena bg-cafe text-white'
                      }`}
                    >
                      <Icono aria-hidden="true" className="h-6 w-6 shrink-0" />
                      <span>{etiqueta}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>
      <MigasPan />
    </>
  );
}
