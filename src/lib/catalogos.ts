/**
 * Catálogos de contenido editable. Son ejemplos de Tonalá para la demo, NO
 * requisitos oficiales. Si el municipio define otros valores, se cambian aquí.
 */
export const COLONIAS_TONALA = [
  'Centro',
  'Lázaro Cárdenas',
  'Prados de la Providencia',
  'Jardines de Tonalá',
  'Villa de Tonalá',
  'El Rosario',
  'La Aurora',
  'Cerro del Cuatro'
] as const;

export const GIROS_TONALA = [
  'Abarrotes',
  'Panadería',
  'Taller mecánico',
  'Salón de belleza',
  'Restaurante',
  'Papelería',
  'Ferretería',
  'Venta de ropa'
] as const;

/** Incluye los tipos de la guía (config/requisitos.ts) y los usados por la semilla. */
export const TIPOS_TRAMITE = [
  'Giro Blanco',
  'Giro Restringido',
  'Anuncios',
  'Licencia de funcionamiento',
  'Permiso de funcionamiento'
] as const;

/** Correos de ejemplo para la demostración. NO son direcciones oficiales. */
export const CORREOS_EJEMPLO: Readonly<Record<'bomberos' | 'proteccion_civil' | 'ventanilla', string>> = {
  bomberos: 'bomberos.recordatorio@tonala-ejemplo.gob.mx',
  proteccion_civil: 'proteccioncivil.recordatorio@tonala-ejemplo.gob.mx',
  ventanilla: 'ventanilla@tonala-ejemplo.gob.mx'
};
