import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import { EmailLogToast } from '@/components/EmailLogToast';
import { Header } from '@/components/layout/Header';
import { RepositoryProvider } from '@/components/RepositoryProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'SIGET-Tonalá',
  description: 'Sistema de Gestión y Trazabilidad de Trámites de Tonalá, Jalisco.'
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-papel text-tinta antialiased">
        <RepositoryProvider>
          <AuthProvider>
            <a
              href="#contenido"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-barro focus:px-5 focus:py-3 focus:text-lg focus:font-bold focus:text-white"
            >
              Ir al contenido
            </a>
            <Header />
            {children}
            <footer className="mx-auto w-full max-w-7xl border-t-4 border-arena px-4 py-8 text-lg font-semibold text-tinta">
              Sistema de demostración. Todos los datos son ficticios.
            </footer>
            <EmailLogToast />
          </AuthProvider>
        </RepositoryProvider>
      </body>
    </html>
  );
}
