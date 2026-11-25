'use client';

import { Eye } from 'lucide-react';
import { useId, useState } from 'react';
import { useDialogoAccesible } from '@/components/useDialogoAccesible';

interface VistaCorreoProps {
  asunto: string;
  html?: string | null;
  plantilla?: string;
  compacto?: boolean;
}

/**
 * Vista previa del correo simulado. El HTML se pinta dentro de un iframe con
 * `sandbox` sin permisos: no puede ejecutar scripts ni abrir ventanas.
 */
export function VistaCorreo({ asunto, html, plantilla, compacto = false }: VistaCorreoProps) {
  const [abierto, setAbierto] = useState(false);
  const referencia = useDialogoAccesible(abierto, () => setAbierto(false));
  const idTitulo = useId();
  const idDescripcion = useId();

  if (!html?.trim()) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={
          compacto
            ? 'mt-2 inline-flex min-h-tactil items-center gap-2 rounded-control border-2 border-enfasis px-4 py-2 text-base font-semibold text-enfasis'
            : 'mt-3 inline-flex min-h-control items-center gap-3 rounded-control border-2 border-enfasis px-5 py-3 text-lg font-semibold text-enfasis'
        }
      >
        <Eye aria-hidden="true" className="h-5 w-5" />
        Ver correo
      </button>

      {abierto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div
            ref={referencia}
            role="dialog"
            aria-modal="true"
            aria-labelledby={idTitulo}
            aria-describedby={idDescripcion}
            className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-control border-4 border-enfasis bg-white p-5"
          >
            <h2 id={idTitulo} className="text-2xl font-bold text-tinta">Vista previa del correo</h2>
            <p id={idDescripcion} className="mt-1 text-lg text-tinta">
              {plantilla ? `Plantilla: ${plantilla}. ` : ''}Correo simulado: no sale de esta computadora.
            </p>
            <p className="mt-2 break-words text-lg font-semibold text-tinta">Asunto: {asunto}</p>
            <iframe
              title={`Vista previa del correo: ${asunto}`}
              srcDoc={html}
              sandbox=""
              className="mt-4 min-h-[24rem] w-full flex-1 rounded-control border-2 border-slate-400 bg-white"
            />
            <button
              type="button"
              data-inicial
              onClick={() => setAbierto(false)}
              className="mt-4 inline-flex min-h-control items-center rounded-control bg-enfasis px-5 py-3 text-lg font-semibold text-white"
            >
              Cerrar vista previa
            </button>
          </div>
        </div>
      )}
    </>
  );
}
