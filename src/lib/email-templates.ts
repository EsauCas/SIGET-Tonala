/**
 * Plantillas de correo institucionales de SIGET-Tonalá.
 *
 * Funciones puras: reciben datos ya validados y devuelven asunto, texto plano y
 * HTML. No importan configuración ni repositorios, así que se pueden usar tanto
 * en un Route Handler como en pruebas unitarias sin efectos externos.
 *
 * Reglas visuales: sin imágenes remotas, contraste alto (#111827 sobre blanco),
 * tablas simples para clientes de correo y texto en lenguaje ciudadano.
 */

export type PlantillaCorreo =
  | 'confirmacion_tramite'
  | 'turnado_dependencia'
  | 'acuse_recibido'
  | 'recordatorio_sla'
  | 'observaciones_ciudadano'
  | 'licencia_aprobada';

export const PLANTILLAS_CORREO: readonly PlantillaCorreo[] = [
  'confirmacion_tramite',
  'turnado_dependencia',
  'acuse_recibido',
  'recordatorio_sla',
  'observaciones_ciudadano',
  'licencia_aprobada'
];

/** Nombres históricos usados por la bandeja; se conservan por compatibilidad. */
const ALIASES: Readonly<Record<string, PlantillaCorreo>> = {
  turno: 'turnado_dependencia',
  turnado: 'turnado_dependencia',
  acuse: 'acuse_recibido',
  acuse_ocr: 'acuse_recibido',
  recepcion: 'acuse_recibido',
  dictamen: 'observaciones_ciudadano',
  observaciones: 'observaciones_ciudadano',
  aprobado: 'licencia_aprobada',
  recordatorio: 'recordatorio_sla'
};

export interface DatosPlantillaCorreo {
  folio: string;
  nombreCiudadano?: string;
  dependencia?: string;
  motivo?: string;
  horasTranscurridas?: number;
  horasLimite?: number;
  esDemo?: boolean;
  enlaceSeguimiento?: string;
}

export interface CorreoRenderizado {
  asunto: string;
  texto: string;
  html: string;
}

function escapar(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function horas(valor: number | undefined): string {
  if (valor === undefined || !Number.isFinite(valor)) return 'varias';
  return String(Math.round(valor));
}

function resolver(plantilla: string): PlantillaCorreo | null {
  if ((PLANTILLAS_CORREO as readonly string[]).includes(plantilla)) {
    return plantilla as PlantillaCorreo;
  }
  return ALIASES[plantilla] ?? null;
}

interface Contenido {
  titulo: string;
  asunto: string;
  parrafos: readonly string[];
  aviso?: string;
}

function contenido(plantilla: PlantillaCorreo, datos: DatosPlantillaCorreo): Contenido {
  const nombre = datos.nombreCiudadano?.trim() || 'Vecino(a)';
  const folio = datos.folio.trim() || '(sin folio)';
  const dependencia = datos.dependencia?.trim() || 'la dependencia correspondiente';
  const motivo = datos.motivo?.trim() || 'Revisa el detalle en el sistema.';

  switch (plantilla) {
    case 'confirmacion_tramite':
      return {
        titulo: 'Recibimos tu solicitud',
        asunto: `Recibimos tu solicitud ${folio}`,
        parrafos: [
          `${nombre}: registramos tu solicitud con folio ${folio}.`,
          'Puedes consultar en qué paso está cuando quieras. Guarda tu folio para dar seguimiento.',
          'No necesitas hacer nada más en este momento.'
        ]
      };
    case 'turnado_dependencia':
      return {
        titulo: 'Tu solicitud ya está en revisión',
        asunto: `Tu solicitud ${folio} fue enviada a revisión`,
        parrafos: [
          `${nombre}: tu solicitud con folio ${folio} fue enviada a ${dependencia}.`,
          'La dependencia revisará los documentos y registrará lo que encuentre.',
          'Te avisaremos cuando haya un cambio.'
        ]
      };
    case 'acuse_recibido':
      return {
        titulo: 'Confirmamos la recepción de tus documentos',
        asunto: `Confirmamos la recepción de tu expediente ${folio}`,
        parrafos: [
          `${nombre}: ${dependencia} confirmó que recibió los documentos de tu expediente ${folio}.`,
          'La revisión ya comenzó. Puedes consultar el avance en el sistema.'
        ]
      };
    case 'recordatorio_sla':
      return {
        titulo: 'Recordatorio: una revisión lleva más tiempo del previsto',
        asunto: `Recordatorio urgente: revisión del trámite ${folio}`,
        aviso: `La revisión lleva ${horas(datos.horasTranscurridas)} horas de un límite de ${horas(datos.horasLimite)} horas.`,
        parrafos: [
          `El expediente ${folio} fue turnado a ${dependencia} y todavía no tiene dictamen.`,
          'Revisa el expediente y registra el avance o el motivo de la espera.',
          'Este aviso se envía una sola vez al día para no repetir correos.'
        ]
      };
    case 'observaciones_ciudadano':
      return {
        titulo: 'Necesitamos un documento para continuar',
        asunto: `Tu trámite ${folio} necesita tu atención`,
        aviso: motivo,
        parrafos: [
          `${nombre}: ${dependencia} revisó tu expediente ${folio} y pide un documento.`,
          'Entra al sistema, revisa el motivo y sube el documento que se solicita.',
          'Cuando lo entregues, la revisión continuará automáticamente.'
        ]
      };
    case 'licencia_aprobada':
      return {
        titulo: 'Tu licencia fue aprobada',
        asunto: `Tu trámite ${folio} fue aprobado`,
        parrafos: [
          `${nombre}: todas las dependencias terminaron la revisión de tu expediente ${folio}.`,
          'El resultado de tu solicitud es aprobado.',
          'Si tienes dudas, consulta tu expediente o acude a ventanilla.'
        ]
      };
  }
}

/**
 * Arma el correo. Si la plantilla no es conocida, usa un texto genérico para
 * que el flujo nunca se bloquee por un valor heredado de fases anteriores.
 */
export function renderizarCorreo(
  plantilla: string,
  datos: DatosPlantillaCorreo
): CorreoRenderizado {
  const resuelta = resolver(plantilla);
  const contenidoBase: Contenido = resuelta
    ? contenido(resuelta, datos)
    : {
        titulo: 'Actualización de tu trámite',
        asunto: `Actualización de tu trámite ${datos.folio}`,
        parrafos: [
          `${datos.folio}: hay una actualización en tu expediente.`,
          'Consulta el detalle en SIGET-Tonalá.'
        ]
      };

  const textoLineas = [contenidoBase.titulo, ...contenidoBase.parrafos];
  if (contenidoBase.aviso) textoLineas.splice(1, 0, `Aviso: ${contenidoBase.aviso}`);
  if (datos.enlaceSeguimiento) textoLineas.push(`Consulta tu expediente aquí: ${datos.enlaceSeguimiento}`);
  if (datos.esDemo) {
    textoLineas.push('SISTEMA DE DEMOSTRACIÓN · Datos ficticios · No es un trámite oficial.');
  }
  textoLineas.push('Mensaje automático de SIGET-Tonalá. Por favor no respondas a este correo.');

  const parrafosHtml = contenidoBase.parrafos
    .map((parrafo) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#111827;">${escapar(parrafo)}</p>`)
    .join('');
  const avisoHtml = contenidoBase.aviso
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#FEF3C7;border-left:6px solid #92400E;"><tr><td style="padding:12px 16px;font-size:16px;line-height:1.6;color:#111827;">${escapar(contenidoBase.aviso)}</td></tr></table>`
    : '';
  const enlaceHtml = datos.enlaceSeguimiento
    ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#111827;"><a href="${escapar(datos.enlaceSeguimiento)}" style="color:#1D4ED8;text-decoration:underline;">Consultar mi expediente</a></p>`
    : '';
  const demoHtml = datos.esDemo
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#FEE2E2;border:2px solid #991B1B;"><tr><td style="padding:12px 16px;font-size:16px;font-weight:bold;line-height:1.6;color:#991B1B;">SISTEMA DE DEMOSTRACIÓN · Datos ficticios · No es un trámite oficial.</td></tr></table>`
    : '';

  const html = [
    '<!doctype html>',
    '<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:0;background:#F8FAFC;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:24px 12px;">',
    '<tr><td align="center">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#FFFFFF;border:2px solid #CBD5E1;border-radius:12px;">',
    '<tr><td style="padding:24px 28px 8px;">',
    '<p style="margin:0;font-size:18px;font-weight:bold;color:#111827;">SIGET-Tonalá</p>',
    '<p style="margin:4px 0 0;font-size:14px;color:#111827;">Dirección de Padrón y Licencias · Gobierno Municipal de Tonalá</p>',
    '</td></tr>',
    `<tr><td style="padding:16px 28px 0;"><h1 style="margin:0;font-size:24px;line-height:1.35;color:#111827;">${escapar(contenidoBase.titulo)}</h1></td></tr>`,
    `<tr><td style="padding:16px 28px 0;">${demoHtml}${avisoHtml}${parrafosHtml}${enlaceHtml}</td></tr>`,
    '<tr><td style="padding:8px 28px 24px;border-top:2px solid #E2E8F0;">',
    '<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#111827;">Mensaje automático de SIGET-Tonalá. Por favor no respondas a este correo.</p>',
    '</td></tr></table></td></tr></table></body></html>'
  ].join('');

  return { asunto: contenidoBase.asunto, texto: textoLineas.join('\n'), html };
}

/** Asunto derivado para los lugares que sólo registran el asunto (demo y cola). */
export function asuntoPlantilla(plantilla: string, datos: DatosPlantillaCorreo): string {
  return renderizarCorreo(plantilla, datos).asunto;
}
