'use client';

import { useId, type ReactNode } from 'react';
import { useDialogoAccesible } from '@/components/useDialogoAccesible';

interface DialogoConfirmacionProps {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  etiquetaConfirmar: string;
  onConfirmar(): void;
  onCancelar(): void;
  ocupado?: boolean;
  peligro?: boolean;
  children?: ReactNode;
}

/** Confirmación accesible: foco contenido, Esc cierra, cancelled safety. */
export function DialogoConfirmacion({
  abierto,
  titulo,
  mensaje,
  etiquetaConfirmar,
  onConfirmar,
  onCancelar,
  ocupado = false,
  peligro = false,
  children
}: DialogoConfirmacionProps) {
  const id = useId();
  const referencia = useDialogoAccesible(abierto, onCancelar);
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/60 p-4">
      <div
        ref={referencia}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`dialogo-${id}-titulo`}
        aria-describedby={`dialogo-${id}-mensaje`}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-control border-4 border-enfasis bg-white p-6"
      >
        <h2 id={`dialogo-${id}-titulo`} className="text-2xl font-bold text-tinta">{titulo}</h2>
        <p id={`dialogo-${id}-mensaje`} className="mt-2 text-lg leading-relaxed text-tinta">{mensaje}</p>
        {children}
        <p aria-live="polite" className="mt-3 text-lg font-semibold text-tinta">
          {ocupado ? 'Guardando... espera un momento.' : ''}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            data-inicial
            onClick={onCancelar}
            className="min-h-control rounded-control border-2 border-slate-500 bg-white px-5 py-3 text-lg font-bold text-tinta"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={onConfirmar}
            className={`min-h-control rounded-control px-5 py-3 text-lg font-bold text-white ${
              peligro ? 'bg-semaforo-rojo' : 'bg-enfasis'
            }`}
          >
            {etiquetaConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
