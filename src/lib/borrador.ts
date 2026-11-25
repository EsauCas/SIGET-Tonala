import { crearFormaVacia, type DatosSolicitud } from '@/lib/validacion-solicitud';

/** Borrador del asistente: sessionStorage, para no mezclarlo con datos demo. */
const CLAVE_BORRADOR = 'siget-tonala:borrador-asistente';
const VERSION = 1;

interface PersistenciaBorrador {
  version: number;
  datos: DatosSolicitud;
}

function esDatosSolicitud(valor: unknown): valor is DatosSolicitud {
  if (typeof valor !== 'object' || valor === null) return false;
  const objeto = valor as Record<string, unknown>;
  const base = crearFormaVacia();
  return Object.keys(base).every((clave) => clave in objeto);
}

export function leerBorrador(almacen: Storage | null | undefined): DatosSolicitud | null {
  if (!almacen) return null;
  try {
    const texto = almacen.getItem(CLAVE_BORRADOR);
    if (!texto) return null;
    const persistido = JSON.parse(texto) as PersistenciaBorrador;
    if (persistido.version !== VERSION || !esDatosSolicitud(persistido.datos)) return null;
    return { ...crearFormaVacia(), ...persistido.datos };
  } catch {
    return null;
  }
}

export function guardarBorrador(almacen: Storage | null | undefined, datos: DatosSolicitud): void {
  if (!almacen) return;
  try {
    const persistencia: PersistenciaBorrador = { version: VERSION, datos };
    almacen.setItem(CLAVE_BORRADOR, JSON.stringify(persistencia));
  } catch {
    // Un navegador sin sessionStorage no impide usar el asistente.
  }
}

export function borrarBorrador(almacen: Storage | null | undefined): void {
  if (!almacen) return;
  try {
    almacen.removeItem(CLAVE_BORRADOR);
  } catch {
    // No hay nada que limpiar si el almacenamiento no está disponible.
  }
}
