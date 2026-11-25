'use client';

import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useRepository } from '@/components/RepositoryProvider';

/** Botón funcional que restaura la semilla y el reloj de la demostración. */
export function DemoResetButton() {
  const { demo, listo } = useRepository();
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);

  if (!listo || !demo) return null;

  async function reiniciar(): Promise<void> {
    setOcupado(true);
    setMensaje('Reiniciando datos...');
    try {
      await demo?.reiniciar();
      setMensaje('Los datos de demostración volvieron a su estado inicial.');
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No se pudo reiniciar la demostración.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="mt-8 max-w-2xl rounded-control border border-slate-300 bg-white p-5">
      <h2 className="text-xl font-bold text-tinta">Datos de demostración</h2>
      <p className="mt-2 text-lg text-tinta">
        Puedes volver al estado inicial cuando quieras. No afecta a datos reales.
      </p>
      <button
        type="button"
        onClick={() => void reiniciar()}
        disabled={ocupado}
        className="mt-4 inline-flex min-h-control items-center gap-3 rounded-control bg-enfasis px-5 py-3 text-lg font-semibold text-white disabled:opacity-60"
      >
        <RotateCcw aria-hidden="true" className="h-5 w-5" />
        {ocupado ? 'Reiniciando...' : 'Reiniciar datos de demostración'}
      </button>
      <p aria-live="polite" className="mt-3 min-h-[28px] text-lg text-tinta">
        {mensaje}
      </p>
    </section>
  );
}
