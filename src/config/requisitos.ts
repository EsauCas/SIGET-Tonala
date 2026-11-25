/**
 * Contenido editable de la guía ciudadana. Son TEXTOS DE EJEMPLO y no un
 * catálogo normativo: ningún requisito aquí debe interpretarse como oficial.
 * Si Padrón y Licencias define la lista definitiva, se sustituye este archivo.
 */

export const AVISO_REQUISITOS =
  'Contenido de ejemplo: por confirmar con Padrón y Licencias.';

export interface RequisitoLicencia {
  /** Clave estable para usarla en el tipo de trámite. */
  clave: 'Giro Blanco' | 'Giro Restringido' | 'Anuncios';
  /** Explicación en lenguaje ciudadano. */
  resumen: string;
  /** Viñetas cortas, sin jerga legal. */
  requisitos: readonly string[];
}

export const LICENCIAS: readonly RequisitoLicencia[] = [
  {
    clave: 'Giro Blanco',
    resumen: 'Para negocios que venden productos o dan servicios sin manejar sustancias ni equipos especiales.',
    requisitos: [
      'Datos del negocio y de la persona contribuyente.',
      'Domicilio donde atiendes al público.',
      'Identificación de la persona responsable (ejemplo).'
    ]
  },
  {
    clave: 'Giro Restringido',
    resumen: 'Para actividades que necesitan una revisión adicional por parte de Bomberos o Protección Civil.',
    requisitos: [
      'Datos del negocio y giro principal.',
      'Croquis sencillo del local (ejemplo).',
      'Revisión de Bomberos y/o Protección Civil.'
    ]
  },
  {
    clave: 'Anuncios',
    resumen: 'Para letreros, rótulos o anuncios visibles desde la vía pública.',
    requisitos: [
      'Domicilio donde se colocará el anuncio.',
      'Medidas aproximadas del anuncio (ejemplo).',
      'Datos de contacto de la persona responsable.'
    ]
  }
] as const;
