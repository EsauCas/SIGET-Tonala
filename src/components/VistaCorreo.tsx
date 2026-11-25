'use client';

import { Eye } from 'lucide-react';
import { useId, useState } from 'react';
import { BOTON_PRIMARIO } from '@/components/layout/estilos';
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
            ? 'mt-2 inline-flex min-h-tactil items-center gap-3 rounded-control border-2 border-bordeCampo bg-superficie px-4 py-2 text-lg font-bold text-barro'
            : 'mt-3 inline-flex min-h-control items-center gap-3 rounded-control border-2 border-bordeCampo bg-superficie px-5 py-3 text-lg font-bold text-barro'
        }
      >
        <Eye aria-hidden="true" className="h-5 w-5" />
        Ver correo
      </button>

      {abierto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-tinta/70 p-4">
          <div
            ref={referencia}
            role="dialog"
            aria-modal="true"
            aria-labelledby={idTitulo}
            aria-describedby={idDescripcion}
            className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-control border-2 border-barro bg-superficie p-5"
          >
            <h2 id={idTitulo} className="text-2xl font-bold text-cafe">Vista previa del correo</h2>
            <p id={idDescripcion} className="mt-3 text-lg leading-relaxed text-tinta">
              {plantilla ? `Plantilla: ${plantilla}. ` : ''}Correo simulado: no sale de esta computadora.
            </p>
            <p className="mt-3 break-words text-lg font-semibold text-tinta">Asunto: {asunto}</p>
            <iframe
              title={`Vista previa del correo: ${asunto}`}
              srcDoc={html}
              sandbox=""
              className="mt-4 min-h-[24rem] w-full flex-1 rounded-control border-2 border-bordeCampo bg-superficie"
            />
            <button type="button" data-inicial onClick={() => setAbierto(false)} className={`${BOTON_PRIMARIO} mt-4`}>
              Cerrar vista previa
            </button>
          </div>
        </div>
      )}
    </>
  );
}
