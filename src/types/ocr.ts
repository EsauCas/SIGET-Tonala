/**
 * Contrato del asistente OCR. La Fase 5 sustituye el aviso de la Fase 4 por
 * lectura real, revisión editable y confirmación humana. Un resultado OCR
 * NUNCA modifica un expediente sin esa confirmación.
 *
 * Cambios aditivos respecto a Fase 4: `faltantes`, `advertencias`, `oficio`,
 * `solicitudes`, `imagen`, claves de campo para oficios y
 * `CampoOcr.validadoPorHumano`. `campos` sigue aceptando todas las claves de
 * la solicitud, así que `aplicarOcr` del asistente no cambia su contrato.
 */

export type FormatoOcr =
  | 'solicitud'
  | 'oficio_verificacion'
  | 'oficio_multidependencia'
  | 'desconocido';

/** Campos de la solicitud que puede proponer el lector. */
export type CampoSolicitudOcr =
  | 'numero_control'
  | 'folio'
  | 'fecha_solicitud'
  | 'nombre_contribuyente'
  | 'domicilio_contribuyente'
  | 'domicilio_negocio'
  | 'colonia'
  | 'cp'
  | 'telefono'
  | 'tipo_tramite'
  | 'giro_principal'
  | 'giros_anexos'
  | 'superficie_m2'
  | 'inversion_estimada';

/** Campos propios de los oficios sellados y de los acuses en lote. */
export type CampoOficioOcr =
  | 'numero_oficio'
  | 'fecha_emision'
  | 'dependencia_destino'
  | 'sello_fecha'
  | 'sello_hora'
  | 'sello_folio'
  | 'acuse_folio'
  | 'acuse_fecha'
  | 'acuse_hora';

export type ClaveCampoOcr =
  | CampoSolicitudOcr
  | CampoOficioOcr
  | `solicitud_${number}_numero_control`
  | `solicitud_${number}_folio`
  | `solicitud_${number}_giros`;

export interface CampoOcr {
  /** Texto leído, ya normalizado para mostrar en el formulario. */
  valor: string;
  /** Confianza de tesseract en escala 0-100 (heurística en pruebas de texto). */
  confianza: number;
  /** Verdadero si falta, si la confianza es menor a 80 o si es manuscrito. */
  requiereValidacion: boolean;
  /** Verdadero cuando la persona revisó y corrigió este campo en pantalla. */
  validadoPorHumano?: boolean;
}

/** Fila de la tabla de solicitudes que trae un oficio. */
export interface SolicitudLeidaOcr {
  numero_control: string;
  folio: string;
  giros: string[];
}

export interface SelloLeidoOcr {
  fecha: string;
  hora: string;
  /** Folio manuscrito: siempre requiere validación humana. */
  folio: string;
}

export interface AcuseLeidoOcr {
  folio: string;
  fecha: string;
  hora: string;
}

export interface OficioLeidoOcr {
  numero_oficio: string;
  fecha_emision: string;
  dependencia_destino: string;
  sello: SelloLeidoOcr | null;
  acuse: AcuseLeidoOcr | null;
  solicitudes: SolicitudLeidaOcr[];
}

/** Datos de la imagen procesada que se puede guardar como documento. */
export interface ArchivoOcrParaGuardar {
  nombre: string;
  mime: string;
  sizeBytes: number;
  ancho: number;
  alto: number;
  /** Ruta de la copia local del archivo; no se envía a ningún servidor. */
  storagePath?: string;
  contenidoBase64?: string;
}

export interface ImagenOcr extends ArchivoOcrParaGuardar {
  /** Blob ya preprocesado y comprimido; se usa para reconocer y no se persiste. */
  blob: Blob;
}

export interface ResultadoOcr {
  formato: FormatoOcr;
  campos: Partial<Record<ClaveCampoOcr, CampoOcr>>;
  /** Etiquetas legibles de los campos que no se pudieron leer. */
  faltantes: string[];
  /** Avisos en lenguaje ciudadano sobre baja confianza o formatos inesperados. */
  advertencias: string[];
  /** Datos estructurados del oficio (B o C), ya sincronizados con `campos`. */
  oficio?: OficioLeidoOcr;
  solicitudes?: SolicitudLeidaOcr[];
  imagen?: ImagenOcr;
  /** Texto íntegro del documento, útil para la revisión y la auditoría. */
  textoCompleto: string;
}

export interface OcrScannerProps {
  formato: FormatoOcr | 'auto';
  onConfirm(resultado: ResultadoOcr): void;
  onCancel(): void;
  onManual?(): void;
  /**
   * Los paneles de acuse lo usan cuando la sesión no es de ventanilla.
   * En Fase 5 ya no hay botón deshabilitado "de adorno" en flujos válidos.
   */
  confirmarDeshabilitado?: boolean;
  etiquetaConfirmar?: string;
}
