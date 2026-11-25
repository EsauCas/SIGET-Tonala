/**
 * Reloj de demostración.
 *
 * Todas las vistas de SLA, recordatorios y fechas de la demo consultan `now()`.
 * Los botones de administración pueden adelantarlo 24/48/72 horas para mostrar
 * el paso de «en tiempo» a «por vencer» y «vencido» sin esperar días reales.
 * El desplazamiento se guarda en localStorage; si el navegador no permite
 * escribir, el reloj sigue funcionando durante la sesión.
 */

const HORA_MS = 60 * 60 * 1000;
export const CLAVE_RELOJ_DEMO = 'siget-tonala:demo:reloj:v2';

let desplazamientoMs = 0;
let inicializado = false;
const oyentes = new Set<() => void>();

function almacen(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function leerDesplazamiento(): number {
  const storage = almacen();
  if (!storage) return 0;
  try {
    const texto = storage.getItem(CLAVE_RELOJ_DEMO);
    if (!texto) return 0;
    const valor = Number(texto);
    return Number.isFinite(valor) ? valor : 0;
  } catch {
    return 0;
  }
}

function guardarDesplazamiento(): void {
  const storage = almacen();
  if (!storage) return;
  try {
    storage.setItem(CLAVE_RELOJ_DEMO, String(desplazamientoMs));
  } catch {
    // Sin almacenamiento el reloj continúa en memoria durante esta sesión.
  }
}

function notificar(): void {
  for (const oyente of oyentes) oyente();
}

/** Se llama al iniciar la app. `obligar` permite volver a leer en pruebas. */
export function inicializarRelojDemo(obligar = false): void {
  if (inicializado && !obligar) return;
  inicializado = true;
  desplazamientoMs = leerDesplazamiento();
}

export function ahoraDemo(): Date {
  return new Date(Date.now() + desplazamientoMs);
}

/** Nombre único para todo el cálculo de plazos de la aplicación demo. */
export function now(): Date {
  return ahoraDemo();
}

export function desplazamientoRelojDemoMs(): number {
  inicializarRelojDemo();
  return desplazamientoMs;
}

export function avanzarRelojDemo(horas: number): Date {
  inicializarRelojDemo();
  if (!Number.isFinite(horas) || horas <= 0) {
    throw new Error('El avance debe ser un número mayor a cero.');
  }
  desplazamientoMs += horas * HORA_MS;
  guardarDesplazamiento();
  notificar();
  return ahoraDemo();
}

export function reiniciarRelojDemo(): Date {
  inicializarRelojDemo();
  desplazamientoMs = 0;
  try {
    almacen()?.removeItem(CLAVE_RELOJ_DEMO);
  } catch {
    // No hay almacenamiento: basta con reiniciar el valor en memoria.
  }
  notificar();
  return ahoraDemo();
}

export function suscribirRelojDemo(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}
