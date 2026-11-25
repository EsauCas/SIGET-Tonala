'use client';

import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { BOTON_PRIMARIO } from '@/components/layout/estilos';
import { useRepository } from '@/components/RepositoryProvider';

/** Botón funcional que restaura la semilla y el reloj de la demostración. */
export function DemoResetButton() {
  const { demo, listo } = useRepository();
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);

  if (!listo || !demo) return null;

  async function reiniciar(): Promise<void> {
    setOcupado(true);
    setMensaje('Devolviendo los datos de ejemplo a su estado inicial...');
    try {
      await demo?.reiniciar();
      setMensaje('Listo. Los datos de ejemplo volvieron a su estado inicial.');
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No se pudo reiniciar la demostración.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="mt-8 max-w-2xl rounded-control border-2 border-arena bg-superficie p-5">
      <h2 className="text-2xl font-bold text-cafe">Datos de demostración</h2>
      <p className="mt-3 text-lg leading-relaxed text-tinta">
        Puedes volver al estado inicial cuando quieras. No afecta a datos reales.
      </p>
      <button
        type="button"
        onClick={() => void reiniciar()}
        disabled={ocupado}
        className={`${BOTON_PRIMARIO} mt-4 disabled:cursor-not-allowed disabled:border-2 disabled:border-arena disabled:bg-arena disabled:text-tinta`}
      >
        <RotateCcw aria-hidden="true" className="h-5 w-5 shrink-0" />
        {ocupado ? 'Un momento...' : 'Reiniciar datos de demostración'}
      </button>
      <p aria-live="polite" className="mt-3 min-h-[28px] text-lg font-semibold text-tinta">
        {mensaje}
      </p>
    </section>
  );
}
