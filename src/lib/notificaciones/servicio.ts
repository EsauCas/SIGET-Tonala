/**
 * Núcleo del envío de correos de SIGET-Tonalá.
 *
 * Toda la lógica de idempotencia, reintentos y renderizado vive aquí con
 * dependencias inyectadas, para poder probarla sin servicios externos.
 * Los Route Handlers sólo aportan la sesión verificada y los adaptadores reales.
 */

import { renderizarCorreo } from '@/lib/email-templates';
import { now } from '@/lib/reloj-demo';
import type { Notificacion, Rol } from '@/types/database';

export const MAX_INTENTOS = 3;

/** Espera creciente entre reintentos: 1 s, 2 s, 4 s. Inyectable en pruebas. */
export function esperaCreciente(intento: number): number {
  return 1000 * 2 ** Math.max(0, intento - 1);
}

export interface CorreoParaEnviar {
  claveIdempotencia: string;
  tramiteId: string;
  plantilla: string;
  destinatario: string;
  asunto: string;
  texto: string;
  html: string;
}

/** Adaptador de transporte: simulación local con latencia, sin red. */
export interface EnviadorCorreo {
  enviar(correo: CorreoParaEnviar): Promise<void>;
}

export interface RegistroIntento {
  id: string;
  estado: 'enviado' | 'error';
  intentos: number;
  errorMotivo: string | null;
  enviadoAt: string | null;
  cuerpo: string;
  html?: string;
  plantilla?: string;
  /** Dirección real a la que se envió el mensaje. */
  enviadoA: string;
  /** Dirección original cuando se redirigió al buzón de pruebas. */
  destinatarioOriginal: string;
}

export interface RegistroNotificaciones {
  listarPendientes(): Promise<Notificacion[]>;
  marcarIntento(input: RegistroIntento): Promise<Notificacion>;
  datosTramite?(tramiteId: string): Promise<{ folio: string; nombreCiudadano: string } | null>;
}

export interface RelojCola {
  ahora(): Date;
  esperar(milisegundos: number): Promise<void>;
}

export interface ResultadoCorreo {
  claveIdempotencia: string;
  tramiteId: string;
  asunto: string;
  destinatario: string;
  enviadoA: string;
  estado: 'enviado' | 'error';
  intentos: number;
  errorMotivo: string | null;
  html?: string;
  plantilla?: string;
}

export interface ResultadoCola {
  procesados: number;
  enviados: ResultadoCorreo[];
  fallidos: ResultadoCorreo[];
}

export interface OpcionesCola {
  /** Si llega, sólo se procesa esa clave (acciones puntuales y botón manual). */
  claveIdempotencia?: string;
  /** Máximo de intentos por correo; por defecto 3. */
  maxIntentos?: number;
  /** Buzón de pruebas: se muestra aquí y se conserva el destinatario original. */
  redirigirA?: string;
  esDemo?: boolean;
  reloj?: RelojCola;
}

const relojPredeterminado: RelojCola = {
  ahora: () => now(),
  esperar: (milisegundos) =>
    new Promise((resolver) => {
      setTimeout(resolver, milisegundos);
    })
};

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo enviar el correo.';
}

function esReintentable(notificacion: Notificacion, maxIntentos: number): boolean {
  if (notificacion.estado === 'pendiente') return notificacion.intentos < maxIntentos;
  return notificacion.estado === 'error' && notificacion.intentos > 0 && notificacion.intentos < maxIntentos;
}

/**
 * Toma las notificaciones pendientes (y las fallidas con intentos disponibles)
 * y las envía. Cada intento queda registrado con su estado y motivo.
 */
export async function procesarCola(
  registro: RegistroNotificaciones,
  enviador: EnviadorCorreo,
  opciones: OpcionesCola = {}
): Promise<ResultadoCola> {
  const maxIntentos = Math.max(1, opciones.maxIntentos ?? MAX_INTENTOS);
  const reloj = opciones.reloj ?? relojPredeterminado;
  const resultado: ResultadoCola = { procesados: 0, enviados: [], fallidos: [] };
  const clavesVistas = new Set<string>();
  const pendientes = await registro.listarPendientes();

  for (const notificacion of pendientes) {
    if (opciones.claveIdempotencia && notificacion.clave_idempotencia !== opciones.claveIdempotencia) {
      continue;
    }
    // Una clave única nunca debe enviarse dos veces, ni dentro de un mismo lote.
    if (clavesVistas.has(notificacion.clave_idempotencia)) continue;
    if (!esReintentable(notificacion, maxIntentos)) continue;
    clavesVistas.add(notificacion.clave_idempotencia);

    const datosTramite = registro.datosTramite
      ? await registro.datosTramite(notificacion.tramite_id)
      : null;
    const plantilla = renderizarCorreo(notificacion.plantilla, {
      folio: datosTramite?.folio ?? notificacion.tramite_id,
      nombreCiudadano: datosTramite?.nombreCiudadano,
      esDemo: opciones.esDemo ?? false
    });

    const enviadoA = opciones.redirigirA?.trim() || notificacion.destinatario;
    const destinatarioOriginal = notificacion.destinatario;
    const correo: CorreoParaEnviar = {
      claveIdempotencia: notificacion.clave_idempotencia,
      tramiteId: notificacion.tramite_id,
      plantilla: notificacion.plantilla,
      destinatario: enviadoA,
      asunto: notificacion.asunto || plantilla.asunto,
      texto: plantilla.texto,
      html: plantilla.html
    };

    resultado.procesados += 1;
    let ultimoError = 'No se pudo enviar el correo.';
    let estadoFinal: 'enviado' | 'error' = 'error';
    let intentosFinales = notificacion.intentos;

    for (let intento = notificacion.intentos + 1; intento <= maxIntentos; intento += 1) {
      try {
        await enviador.enviar(correo);
        intentosFinales = intento;
        estadoFinal = 'enviado';
        await registro.marcarIntento({
          id: notificacion.id,
          estado: 'enviado',
          intentos: intento,
          errorMotivo: null,
          enviadoAt: reloj.ahora().toISOString(),
          cuerpo: plantilla.texto,
          html: plantilla.html,
          plantilla: notificacion.plantilla,
          enviadoA,
          destinatarioOriginal
        });
        break;
      } catch (error) {
        ultimoError = mensajeError(error);
        intentosFinales = intento;
        await registro.marcarIntento({
          id: notificacion.id,
          estado: 'error',
          intentos: intento,
          errorMotivo: ultimoError,
          enviadoAt: null,
          cuerpo: plantilla.texto,
          html: plantilla.html,
          plantilla: notificacion.plantilla,
          enviadoA,
          destinatarioOriginal
        });
        if (intento < maxIntentos) await reloj.esperar(esperaCreciente(intento));
      }
    }

    const item: ResultadoCorreo = {
      claveIdempotencia: notificacion.clave_idempotencia,
      tramiteId: notificacion.tramite_id,
      asunto: correo.asunto,
      destinatario: destinatarioOriginal,
      enviadoA,
      estado: estadoFinal,
      intentos: intentosFinales,
      errorMotivo: estadoFinal === 'enviado' ? null : ultimoError,
      html: plantilla.html,
      plantilla: notificacion.plantilla
    };
    if (estadoFinal === 'enviado') resultado.enviados.push(item);
    else resultado.fallidos.push(item);
  }

  return resultado;
}

/** Sólo personal autorizado puede pedir envíos: ciudadanía nunca correos arbitrarios. */
export function puedeSolicitarCorreo(rol: Rol): boolean {
  return rol === 'secretaria' || rol === 'bomberos' || rol === 'proteccion_civil' || rol === 'admin';
}

/** Comparación de longitud fija para el secreto del cron. Nunca usa DEMO_MODE. */
export function autorizarCron(autorizacion: string | null, secreto: string): boolean {
  if (!secreto || !autorizacion) return false;
  const esperado = `Bearer ${secreto}`;
  if (autorizacion.length !== esperado.length) return false;
  let diferencia = 0;
  for (let indice = 0; indice < esperado.length; indice += 1) {
    diferencia |= autorizacion.charCodeAt(indice) ^ esperado.charCodeAt(indice);
  }
  return diferencia === 0;
}
