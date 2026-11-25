import type { ReactNode } from 'react';

/** Estados visibles y accesibles, reutilizados por todas las vistas. */

export function Cargando({ mensaje = 'Cargando información...' }: { mensaje?: string }) {
  return (
    <p aria-live="polite" className="rounded-control border border-slate-300 bg-white p-5 text-lg text-tinta">
      {mensaje}
    </p>
  );
}

export function ErrorVista({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <div role="alert" className="rounded-control border-4 border-semaforo-rojo bg-red-50 p-5">
      <h2 className="text-xl font-bold text-semaforo-rojo">No pudimos completar la acción</h2>
      <p className="mt-2 text-lg text-tinta">{mensaje}</p>
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          className="mt-4 min-h-control rounded-control bg-enfasis px-5 py-3 text-lg font-semibold text-white"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

export function Vacio({ titulo, mensaje, children }: { titulo: string; mensaje: string; children?: ReactNode }) {
  return (
    <div className="rounded-control border border-slate-300 bg-white p-5">
      <h2 className="text-xl font-bold text-tinta">{titulo}</h2>
      <p className="mt-2 text-lg text-tinta">{mensaje}</p>
      {children}
    </div>
  );
}

export function Aviso({ mensaje, exito = false }: { mensaje: string; exito?: boolean }) {
  if (!mensaje) return <p aria-live="polite" className="min-h-[28px]" />;
  return (
    <p
      aria-live="polite"
      className={`min-h-[28px] rounded-control border-2 p-3 text-lg font-semibold ${
        exito ? 'border-semaforo-verde bg-green-50 text-semaforo-verde' : 'border-semaforo-rojo bg-red-50 text-semaforo-rojo'
      }`}
    >
      {mensaje}
    </p>
  );
}

export function fechaLegible(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(fecha);
}
