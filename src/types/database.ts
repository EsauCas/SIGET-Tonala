/**
 * Tipos del modelo de datos de SIGET-Tonalá.
 * Espejo tipado de supabase/schema.sql. Los IDs son UUID en PostgreSQL y
 * cadenas en TypeScript; las fechas son ISO 8601 en UTC.
 */

export type Rol = 'ciudadano' | 'secretaria' | 'bomberos' | 'proteccion_civil' | 'admin';

export type ClaveDependencia = 'bomberos' | 'proteccion_civil' | 'ventanilla';

export type EstadoDependencia =
  | 'pendiente'
  | 'turnado'
  | 'en_inspeccion'
  | 'observaciones'
  | 'aprobado'
  | 'rechazado';

/** Las cinco etapas del semáforo. "Rechazado" es una etiqueta de la etapa roja. */
export type EtapaGeneral = 'recepcion' | 'turnado' | 'verificacion' | 'observaciones' | 'aprobado';

export type ColorSemaforo = 'gris' | 'azul' | 'ambar' | 'rojo' | 'verde';

export type TipoHoras = 'naturales' | 'habiles';

export type EstadoNotificacion = 'pendiente' | 'enviado' | 'error';

export type TipoDocumento =
  | 'solicitud'
  | 'identificacion'
  | 'evidencia'
  | 'acuse'
  | 'dictamen'
  | 'otro';

export type Dictamen = 'aprobado' | 'rechazado' | 'observaciones';

export interface Profile {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  dependencia_id: string | null;
}

export interface Dependencia {
  id: string;
  clave: ClaveDependencia;
  nombre: string;
}

export interface Tramite {
  id: string;
  folio: string;
  numero_control: string;
  ciudadano_id: string;
  tipo_tramite: string;
  giro_principal: string;
  giros_anexos: string[];
  domicilio_negocio: string;
  /** Domicilio particular de la persona contribuyente (capture del asistente). */
  domicilio_contribuyente: string;
  /** Fecha de la solicitud en YYYY-MM-DD; distinta de created_at (auditoría). */
  fecha_solicitud: string;
  colonia: string;
  cp: string;
  superficie_m2: number;
  inversion_estimada: number;
  nombre_contribuyente: string;
  telefono: string;
  estado_general: EtapaGeneral;
  created_at: string;
  updated_at: string;
}

export interface TramiteDependencia {
  id: string;
  tramite_id: string;
  dependencia_id: string;
  estado: EstadoDependencia;
  turnado_at: string | null;
  acuse_at: string | null;
  dictamen_at: string | null;
  dictamen: string | null;
  motivo: string | null;
  oficio_id: string | null;
  sla_horas: number;
  pausado_desde: string | null;
  horas_pausadas: number;
  /** Fecha de visita de Protección Civil (YYYY-MM-DD). Opcional por compatibilidad. */
  fecha_visita?: string | null;
}

export interface OficioTurnado {
  id: string;
  numero_oficio: string;
  fecha_emision: string;
  dependencia_destino: string;
  sello_fecha: string | null;
  sello_hora: string | null;
  sello_folio: string | null;
  acuse_documento_id: string | null;
  created_by: string;
}

export interface Documento {
  id: string;
  tramite_id: string;
  tipo: TipoDocumento;
  storage_path: string;
  mime: string;
  size_bytes: number;
  created_by: string;
  created_at: string;
  /** Sólo demo: copia local en base64. Nunca se envía a Supabase Storage. */
  contenidoBase64?: string;
}

export interface HistorialEvento {
  id: string;
  tramite_id: string;
  actor_id: string;
  actor_rol: Rol;
  accion: string;
  datos_antes: string | null;
  datos_despues: string | null;
  created_at: string;
}

export interface Notificacion {
  id: string;
  tramite_id: string;
  destinatario: string;
  plantilla: string;
  asunto: string;
  estado: EstadoNotificacion;
  error_motivo: string | null;
  clave_idempotencia: string;
  intentos: number;
  created_at: string;
  enviado_at: string | null;
  /** Cuerpo renderizado de la plantilla (texto plano). */
  cuerpo?: string | null;
  /** HTML institucional renderizado, usado por la vista previa segura. */
  html?: string | null;
  /** Fase 6: dirección real a la que se envió el mensaje. */
  enviado_a?: string | null;
  /** Fase 6: destinatario original si se redirigió al buzón de pruebas. */
  destinatario_original?: string | null;
}

export interface ConfiguracionSla {
  id: string;
  dependencia_id: string;
  horas_limite: number;
  tipo_horas: TipoHoras;
  horas_alerta_previa: number;
}

export interface TramiteConDetalle extends Tramite {
  dependencias: TramiteDependencia[];
  documentos: Documento[];
}

/** Registro visual de correos simulados. Existe solo en modo demo. */
export interface CorreoSimulado {
  id: string;
  destinatario: string;
  asunto: string;
  cuerpo: string;
  html: string;
  plantilla: string;
  fecha: string;
  clave_idempotencia: string;
}
