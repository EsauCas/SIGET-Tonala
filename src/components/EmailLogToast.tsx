'use client';

import { X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRepository } from '@/components/RepositoryProvider';
import { VistaCorreo } from '@/components/VistaCorreo';
import { adaptadorCola } from '@/lib/notificaciones/adaptador';
import { procesarCola, type ResultadoCola } from '@/lib/notificaciones/servicio';
import { enviadorSimulado } from '@/lib/notificaciones/simulado';

const EVENTO_CORREO = 'siget:correo';

interface AvisoCorreo {
  id: string;
  asunto: string;
  destinatario: string;
  enviadoA: string;
  estado: 'enviado' | 'error';
  errorMotivo: string | null;
  html: string;
  plantilla: string;
}

/**
 * Procesa la cola en el navegador con el transporte simulado. Nunca hay una
 * petición de correo a servidor: esta instalación no tiene backend de envío.
 */
export function useCorreos(): (claveIdempotencia?: string) => Promise<ResultadoCola | null> {
  const { repositorio } = useRepository();
  const { actor } = useAuth();

  return useCallback(
    async (claveIdempotencia?: string): Promise<ResultadoCola | null> => {
      if (!repositorio || !actor) return null;

      const resultado = await procesarCola(adaptadorCola(repositorio), enviadorSimulado, {
        claveIdempotencia,
        esDemo: true
      });

      for (const correo of [...resultado.enviados, ...resultado.fallidos]) {
        window.dispatchEvent(
          new CustomEvent<AvisoCorreo>(EVENTO_CORREO, {
            detail: {
              id: `${correo.claveIdempotencia}-${correo.intentos}`,
              asunto: correo.asunto,
              destinatario: correo.destinatario,
              enviadoA: correo.enviadoA,
              estado: correo.estado,
              errorMotivo: correo.errorMotivo,
              html: correo.html ?? '',
              plantilla: correo.plantilla ?? ''
            }
          })
        );
      }
      return resultado;
    },
    [actor, repositorio]
  );
}

/** Aviso accesible de cada correo enviado o simulado. Se descarta con teclado. */
export function EmailLogToast() {
  const [avisos, setAvisos] = useState<AvisoCorreo[]>([]);

  useEffect(() => {
    const escuchar = (evento: Event): void => {
      const detalle = (evento as CustomEvent<AvisoCorreo>).detail;
      if (!detalle) return;
      setAvisos((anteriores) =>
        anteriores.some((item) => item.id === detalle.id)
          ? anteriores
          : [...anteriores.slice(-2), detalle]
      );
    };
    window.addEventListener(EVENTO_CORREO, escuchar);
    return () => window.removeEventListener(EVENTO_CORREO, escuchar);
  }, []);

  const descartar = useCallback((id: string): void => {
    setAvisos((anteriores) => anteriores.filter((item) => item.id !== id));
  }, []);

  if (avisos.length === 0) return null;

  return (
    <section
      aria-label="Avisos de correo"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
    >
      {avisos.map((aviso) => (
        <div
          key={aviso.id}
          className={`rounded-control border-4 bg-white p-4 shadow-lg ${
            aviso.estado === 'enviado' ? 'border-semaforo-verde' : 'border-semaforo-rojo'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-tinta">
                {aviso.estado === 'enviado' ? 'Correo enviado' : 'No se pudo enviar el correo'}
              </p>
              <p className="mt-1 break-words text-base text-tinta">Asunto: {aviso.asunto}</p>
              <p className="mt-1 break-words text-base text-tinta">
                Para: {aviso.destinatario}
                {aviso.enviadoA !== aviso.destinatario && ` · Enviado a: ${aviso.enviadoA}`}
              </p>
              {aviso.errorMotivo && (
                <p className="mt-1 break-words text-base text-tinta">Motivo: {aviso.errorMotivo}</p>
              )}
              <VistaCorreo
                asunto={aviso.asunto}
                html={aviso.html}
                plantilla={aviso.plantilla}
                compacto
              />
            </div>
            <button
              type="button"
              onClick={() => descartar(aviso.id)}
              onKeyDown={(evento) => {
                if (evento.key === 'Escape') descartar(aviso.id);
              }}
              aria-label={`Descartar aviso: ${aviso.asunto}`}
              className="inline-flex min-h-tactil min-w-[44px] shrink-0 items-center justify-center rounded-control border-2 border-slate-400 p-2 text-tinta hover:bg-slate-100 focus-visible:outline focus-visible:outline-4 focus-visible:outline-enfasis"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
