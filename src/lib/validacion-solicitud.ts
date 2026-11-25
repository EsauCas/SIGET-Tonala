import { TIPOS_TRAMITE } from '@/lib/catalogos';
import { now } from '@/lib/reloj-demo';
import type { Actor, CrearTramiteInput } from '@/lib/repository/types';
import type { ClaveDependencia, Tramite } from '@/types/database';

/**
 * Estado del asistente ciudadano. `numero_control`, `folio` y `fecha_solicitud`
 * se muestran como datos generados por el sistema; las demás propiedades sí se
 * capturan y se validan antes de guardar.
 */
export interface DatosSolicitud {
  numero_control: string;
  folio: string;
  fecha_solicitud: string;
  nombre_contribuyente: string;
  domicilio_contribuyente: string;
  domicilio_negocio: string;
  colonia: string;
  cp: string;
  telefono: string;
  tipo_tramite: string;
  giro_principal: string;
  giros_anexos: string;
  superficie_m2: string;
  inversion_estimada: string;
  dependenciasRequeridas: ClaveDependencia[];
}

export type CampoSolicitud = keyof DatosSolicitud;
export type ErroresSolicitud = Partial<Record<CampoSolicitud, string>>;

/** Fecha de hoy en formato YYYY-MM-DD, calculada sólo en cliente. */
export function hoyISO(): string {
  return now().toISOString().slice(0, 10);
}

/** Forma vacía sin fecha para evitar diferencias de hidratación servidor/cliente. */
export function crearFormaVacia(): DatosSolicitud {
  return {
    numero_control: '',
    folio: '',
    fecha_solicitud: '',
    nombre_contribuyente: '',
    domicilio_contribuyente: '',
    domicilio_negocio: '',
    colonia: '',
    cp: '',
    telefono: '',
    tipo_tramite: '',
    giro_principal: '',
    giros_anexos: '',
    superficie_m2: '',
    inversion_estimada: '',
    dependenciasRequeridas: []
  };
}

/**
 * Validación pura. Devuelve un mensaje por campo, en lenguaje claro, para que
 * el asistente pueda señalar el control exacto y anunciarlo con aria-live.
 */
export function validarSolicitud(forma: Readonly<DatosSolicitud>): ErroresSolicitud {
  const errores: ErroresSolicitud = {};

  if (!forma.nombre_contribuyente.trim()) {
    errores.nombre_contribuyente = 'Escribe el nombre de la persona contribuyente.';
  }
  if (!forma.domicilio_contribuyente.trim()) {
    errores.domicilio_contribuyente = 'Escribe tu domicilio particular.';
  }
  if (!forma.domicilio_negocio.trim()) {
    errores.domicilio_negocio = 'Escribe la calle y el número de tu negocio.';
  }
  if (!forma.colonia.trim()) {
    errores.colonia = 'Selecciona la colonia de tu negocio.';
  }
  if (!/^[0-9]{5}$/.test(forma.cp.trim())) {
    errores.cp = 'El código postal debe tener 5 números.';
  }
  if (forma.telefono.replace(/\D/g, '').length !== 10) {
    errores.telefono = 'Escribe un teléfono de 10 números.';
  }
  if (!forma.tipo_tramite.trim() || !TIPOS_TRAMITE.some((tipo) => tipo === forma.tipo_tramite)) {
    errores.tipo_tramite = 'Selecciona el tipo de licencia.';
  }
  if (!forma.giro_principal.trim()) {
    errores.giro_principal = 'Escribe el giro principal de tu negocio.';
  }

  const superficie = Number(forma.superficie_m2);
  if (forma.superficie_m2.trim() === '' || !Number.isFinite(superficie) || superficie <= 0) {
    errores.superficie_m2 = 'La superficie debe ser un número mayor a cero.';
  }

  const inversion = Number(forma.inversion_estimada);
  if (forma.inversion_estimada.trim() === '' || !Number.isFinite(inversion) || inversion < 0) {
    errores.inversion_estimada = 'La inversión debe ser un número de cero o más.';
  }

  if (forma.dependenciasRequeridas.length === 0) {
    errores.dependenciasRequeridas =
      'Selecciona Bomberos, Protección Civil o ambos para revisar tu solicitud.';
  }

  return errores;
}

/** Primer mensaje de error, para el anuncio aria-live de la pantalla. */
export function primerError(errores: Readonly<ErroresSolicitud>): string | null {
  const valores = Object.values(errores);
  return valores.length > 0 && typeof valores[0] === 'string' ? valores[0] : null;
}

export function aCrearTramiteInput(
  actor: Actor,
  forma: Readonly<DatosSolicitud>
): CrearTramiteInput {
  return {
    actor,
    tipo_tramite: forma.tipo_tramite,
    giro_principal: forma.giro_principal.trim(),
    giros_anexos: forma.giros_anexos
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
    domicilio_negocio: forma.domicilio_negocio.trim(),
    domicilio_contribuyente: forma.domicilio_contribuyente.trim(),
    fecha_solicitud: forma.fecha_solicitud || hoyISO(),
    colonia: forma.colonia.trim(),
    cp: forma.cp.trim(),
    superficie_m2: Number(forma.superficie_m2),
    inversion_estimada: Number(forma.inversion_estimada),
    nombre_contribuyente: forma.nombre_contribuyente.trim(),
    telefono: forma.telefono.trim(),
    dependenciasRequeridas: [...forma.dependenciasRequeridas]
  };
}

/** Folio y número de control son generados; nunca se toman del formulario. */
export function datosGenerados(tramite: Tramite): Pick<
  DatosSolicitud,
  'folio' | 'numero_control' | 'fecha_solicitud'
> {
  return {
    folio: tramite.folio,
    numero_control: tramite.numero_control,
    fecha_solicitud: tramite.fecha_solicitud
  };
}
