import type { ArchivoOcrParaGuardar } from '@/types/ocr';
import type {
  ClaveDependencia,
  ConfiguracionSla,
  CorreoSimulado,
  Dependencia,
  Dictamen,
  Documento,
  EtapaGeneral,
  HistorialEvento,
  Notificacion,
  OficioTurnado,
  Profile,
  Rol,
  TipoDocumento,
  TipoHoras,
  Tramite,
  TramiteConDetalle,
  TramiteDependencia
} from '@/types/database';

/** Perfil ficticio seleccionado en la demostración. */
export interface Actor {
  id: string;
  rol: Rol;
  dependencia_id: string | null;
}

export interface FiltrosTramite {
  etapa?: EtapaGeneral;
  ciudadanoId?: string;
  dependenciaId?: string;
  busqueda?: string;
  /** Actor de la sesión. Opcional por compatibilidad; si llega, se aplica su visibilidad. */
  actor?: Actor;
}

export interface ArchivoParaSubir {
  tramiteId: string;
  archivo: File;
  tipo: TipoDocumento;
}

export interface ResultadoSubida {
  storagePath: string;
  mime: string;
  sizeBytes: number;
  nombreArchivo: string;
  /** Demo: copia en base64 cuando cabe en el almacenamiento local. */
  contenidoBase64?: string;
}

export interface CrearTramiteInput {
  actor: Actor;
  tipo_tramite: string;
  giro_principal: string;
  giros_anexos: string[];
  domicilio_negocio: string;
  /** Opcional por compatibilidad con el formulario anterior; el asistente lo captura. */
  domicilio_contribuyente?: string;
  /** Opcional por compatibilidad; por defecto se usa la fecha del alta. */
  fecha_solicitud?: string;
  colonia: string;
  cp: string;
  superficie_m2: number;
  inversion_estimada: number;
  nombre_contribuyente: string;
  telefono: string;
  dependenciasRequeridas: ClaveDependencia[];
}

export interface RegistrarTurnoInput {
  actor: Actor;
  tramiteDependenciaId: string;
}

/** Turno de uno o varios renglones con un mismo número de oficio consecutivo. */
export interface TurnarTramiteInput {
  actor: Actor;
  tramiteDependenciaIds: readonly string[];
}

export interface RegistrarAcuseInput {
  actor: Actor;
  tramiteDependenciaId: string;
  documentoId?: string;
  selloFolio: string;
  selloFecha?: string;
  selloHora?: string;
}

/** Confirmación humana del Parser B: sello leído de un oficio individual. */
export interface RegistrarAcuseOficioInput {
  actor: Actor;
  numero_oficio: string;
  selloFolio: string;
  selloFecha?: string;
  selloHora?: string;
  imagen?: ArchivoOcrParaGuardar;
}

export interface SolicitudAcuseInput {
  numero_control: string;
  folio: string;
  giros: readonly string[];
}

/** Confirmación humana del Parser C: acuse de un oficio multidependencia. */
export interface RegistrarAcuseLoteInput {
  actor: Actor;
  numero_oficio: string;
  acuseFolio: string;
  acuseFecha?: string;
  acuseHora?: string;
  solicitudes: readonly SolicitudAcuseInput[];
  imagen?: ArchivoOcrParaGuardar;
}

export interface ResultadoAcuseOficio {
  numero_oficio: string;
  tramitesActualizados: number;
  expedientes: TramiteDependencia[];
  aviso: string;
}

export interface ResultadoAcuseLote {
  numero_oficio: string;
  tramitesActualizados: number;
  foliosNoEncontrados: string[];
  notificaciones: number;
  reprocessado: boolean;
  aviso: string;
}

export interface RegistrarRecepcionInput {
  actor: Actor;
  tramiteDependenciaId: string;
}

export interface DictaminarInput {
  actor: Actor;
  tramiteDependenciaId: string;
  dictamen: Dictamen;
  motivo: string | null;
  /** Obligatorio en la práctica para Protección Civil; validado en el repositorio. */
  fechaVisita?: string;
}

export interface AgregarEvidenciaInput {
  actor: Actor;
  tramiteDependenciaId: string;
  tipo: TipoDocumento;
  nombreArchivo: string;
  mime: string;
  sizeBytes: number;
  storagePath: string;
  /** Demo: se guarda con el documento cuando el archivo cabe en local. */
  contenidoBase64?: string;
}

export interface RegistrarNotificacionInput {
  tramiteId: string;
  destinatario: string;
  plantilla: string;
  asunto: string;
  cuerpo: string;
  claveIdempotencia: string;
}

export interface ActualizarSlaInput {
  actor: Actor;
  id: string;
  horasLimite: number;
  horasAlertaPrevia: number;
  tipoHoras: TipoHoras;
}

/** Fase 6: estado de un intento de envío reportado por la cola de correos. */
export interface RegistrarIntentoNotificacionInput {
  id: string;
  estado: 'enviado' | 'error';
  intentos: number;
  errorMotivo: string | null;
  enviadoAt: string | null;
  cuerpo: string;
  html?: string | null;
  plantilla?: string | null;
  enviadoA: string;
  destinatarioOriginal: string;
}

/** Fase 6: cambio de rol de un usuario. El servidor valida que no sea el propio admin. */
export interface ActualizarRolUsuarioInput {
  actor: Actor;
  id: string;
  rol: Rol;
}

/**
 * Contrato único de persistencia. El modo demo/prod se resuelve fuera de la UI
 * (config.ts + createRepository); ningún componente decide qué adaptador usar.
 */
export interface TramiteRepository {
  listarDependencias(): Promise<Dependencia[]>;
  listarTramites(filtros?: FiltrosTramite): Promise<TramiteConDetalle[]>;
  /** El actor opcional aplica la visibilidad por rol de la demostración. */
  obtenerTramite(id: string, actor?: Actor): Promise<TramiteConDetalle | null>;
  crearTramite(input: CrearTramiteInput): Promise<Tramite>;
  registrarTurno(input: RegistrarTurnoInput): Promise<TramiteDependencia>;
  turnarTramite(input: TurnarTramiteInput): Promise<TramiteDependencia[]>;
  registrarAcuse(input: RegistrarAcuseInput): Promise<TramiteDependencia>;
  /** Acuse OCR individual (Parser B). Sólo ventanilla y tras confirmación humana. */
  registrarAcuseOficio(input: RegistrarAcuseOficioInput): Promise<ResultadoAcuseOficio>;
  /** Acuse OCR en lote (Parser C). Transaccional, idempotente y sólo ventanilla. */
  registrarAcuseLote(input: RegistrarAcuseLoteInput): Promise<ResultadoAcuseLote>;
  registrarRecepcion(input: RegistrarRecepcionInput): Promise<TramiteDependencia>;
  dictaminar(input: DictaminarInput): Promise<TramiteDependencia>;
  agregarEvidencia(input: AgregarEvidenciaInput): Promise<Documento>;
  subirArchivo(input: ArchivoParaSubir): Promise<ResultadoSubida>;
  listarHistorial(tramiteId: string): Promise<HistorialEvento[]>;
  /** Documentos del expediente, para el panel de detalle. */
  listarDocumentos(tramiteId: string): Promise<Documento[]>;
  /** Oficios emitidos, para consecutivos y auditoría. */
  listarOficios(): Promise<OficioTurnado[]>;
  listarNotificaciones(): Promise<Notificacion[]>;
  registrarNotificacion(input: RegistrarNotificacionInput): Promise<Notificacion>;
  /** Alias de registro idempotente usado por el asistente al confirmar el alta. */
  encolarNotificacion(input: RegistrarNotificacionInput): Promise<Notificacion>;
  listarConfiguracionSla(): Promise<ConfiguracionSla[]>;
  actualizarConfiguracionSla(input: ActualizarSlaInput): Promise<ConfiguracionSla>;
  /** Fase 6 (aditivo): usuarios y roles para el panel de administración. */
  listarUsuarios(): Promise<Profile[]>;
  actualizarRolUsuario(input: ActualizarRolUsuarioInput): Promise<Profile>;
  /** Fase 6 (aditivo): cola de notificaciones y registro de cada intento. */
  listarNotificacionesPendientes(): Promise<Notificacion[]>;
  marcarIntentoNotificacion(input: RegistrarIntentoNotificacionInput): Promise<Notificacion>;
  /** Fase 6 (aditivo): vuelve a poner en cola un correo fallido para reintento manual. */
  reintentarNotificacion(claveIdempotencia: string): Promise<Notificacion | null>;
}

/** Capacidades exclusivas del adaptador demo, expuestas por el provider. */
export interface EstadoAlmacenamientoDemo {
  disponible: boolean;
  mensaje: string | null;
}

export interface DemoCapabilities {
  listarPerfiles(): Promise<Profile[]>;
  seleccionarPerfil(id: string): Promise<void>;
  obtenerPerfilActivo(): Promise<Profile | null>;
  suscribirPerfil(listener: (perfil: Profile | null) => void): () => void;
  reiniciar(): Promise<void>;
  listarCorreosSimulados(): Promise<CorreoSimulado[]>;
  estadoAlmacenamiento?(): EstadoAlmacenamientoDemo;
}
