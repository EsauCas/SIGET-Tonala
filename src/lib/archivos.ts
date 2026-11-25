/** Reglas de archivos compartidas por la UI, el adaptador demo y el de Supabase. */

export const MIMES_EVIDENCIA = new Set(['application/pdf', 'image/jpeg', 'image/png']);
export const TAMANO_MAXIMO_EVIDENCIA = 5 * 1024 * 1024;

/**
 * Límite superior para guardar una copia en base64 dentro de localStorage.
 * Los archivos más grandes se registran como simulados en la demo para no
 * llenar el almacenamiento del navegador; el límite de aceptación sigue siendo
 * 5 MB en ambos adaptadores.
 */
export const LIMITE_BASE64_DEMO = 2 * 1024 * 1024;

export function validarArchivoEvidencia(archivo: {
  type: string;
  size: number;
}): string | null {
  if (!MIMES_EVIDENCIA.has(archivo.type)) {
    return 'El archivo debe ser PDF, JPG o PNG.';
  }
  if (archivo.size <= 0) {
    return 'El archivo está vacío. Elige otro.';
  }
  if (archivo.size > TAMANO_MAXIMO_EVIDENCIA) {
    return 'El archivo pesa más de 5 MB. Elige uno más pequeño.';
  }
  return null;
}
