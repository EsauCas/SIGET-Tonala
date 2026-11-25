import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import { EmailLogToast } from '@/components/EmailLogToast';
import { Navbar } from '@/components/Navbar';
import { RepositoryProvider } from '@/components/RepositoryProvider';
import { DemoControls } from '@/components/demo/DemoControls';
import './globals.css';

export const metadata: Metadata = {
  title: 'SIGET-Tonalá',
  description: 'Sistema de Gestión y Trazabilidad de Trámites de Tonalá, Jalisco.'
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-lienzo text-tinta antialiased">
        <RepositoryProvider>
          <AuthProvider>
            <a
              href="#contenido"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-enfasis focus:px-5 focus:py-3 focus:text-lg focus:font-semibold focus:text-white"
            >
              Saltar al contenido
            </a>
            <Navbar />
            <DemoControls />
            <div id="contenido">{children}</div>
            <footer className="mx-auto w-full max-w-6xl px-5 py-8 text-lg font-semibold text-tinta">
              Sistema de demostración. Todos los datos son ficticios.
            </footer>
            <EmailLogToast />
          </AuthProvider>
        </RepositoryProvider>
      </body>
    </html>
  );
}
