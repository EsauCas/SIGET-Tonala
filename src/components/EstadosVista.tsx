import { AlertTriangle, CheckCircle2, ClipboardList, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { BOTON_PRIMARIO } from '@/components/layout/estilos';

/** Estados visibles y accesibles, reutilizados por todas las vistas. */

export function Cargando({ mensaje = 'Cargando información...' }: { mensaje?: string }) {
  return (
    <p
      aria-live="polite"
      className="flex items-start gap-3 rounded-control border-l-8 border-barro bg-papel p-5 text-lg font-semibold leading-relaxed text-tinta"
    >
      <Info aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" />
      {mensaje}
    </p>
  );
}

export function ErrorVista({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <div role="alert" className="rounded-control border-l-8 border-semaforo-rojo bg-semaforo-fondo-rojo p-5">
      <h2 className="flex items-start gap-3 text-2xl font-bold text-tinta">
        <AlertTriangle aria-hidden="true" className="mt-1 h-6 w-6 shrink-0" />
        No pudimos completar la acción
      </h2>
      <p className="mt-3 text-lg leading-relaxed text-tinta">{mensaje}</p>
      {onReintentar && (
        <button type="button" onClick={onReintentar} className={`${BOTON_PRIMARIO} mt-4`}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function Vacio({ titulo, mensaje, children }: { titulo: string; mensaje: string; children?: ReactNode }) {
  return (
    <div className="rounded-control border-2 border-arena bg-superficie p-5">
      <h2 className="flex items-start gap-3 text-2xl font-bold text-cafe">
        <ClipboardList aria-hidden="true" className="mt-1 h-6 w-6 shrink-0" />
        {titulo}
      </h2>
      <p className="mt-3 text-lg leading-relaxed text-tinta">{mensaje}</p>
      {children}
    </div>
  );
}

export function Aviso({ mensaje, exito = false }: { mensaje: string; exito?: boolean }) {
  if (!mensaje) return <p aria-live="polite" className="min-h-[28px]" />;
  return (
    <p
      aria-live="polite"
      className={`flex min-h-[44px] items-start gap-3 rounded-control border-l-8 p-3 text-lg font-semibold leading-relaxed text-tinta ${
        exito
          ? 'border-semaforo-verde bg-semaforo-fondo-verde'
          : 'border-semaforo-rojo bg-semaforo-fondo-rojo'
      }`}
    >
      {exito ? (
        <CheckCircle2 aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" />
      ) : (
        <AlertTriangle aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" />
      )}
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
