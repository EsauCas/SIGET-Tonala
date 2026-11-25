/**
 * Configuración de la aplicación congelada como demostración.
 *
 * Todo se ejecuta en el navegador: datos semilla, perfiles, correos simulados
 * y OCR local. No hay variables de entorno obligatorias ni secretos. La
 * arquitectura que se usaría en una instalación real quedó documentada en
 * docs/produccion-futura/ y no se importa desde esta aplicación.
 */
export const DEMO_MODE = true as const;

export const configuracionPublica = {
  modo: 'demo'
} as const;
