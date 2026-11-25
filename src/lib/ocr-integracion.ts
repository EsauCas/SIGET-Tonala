'use client';

/**
 * Puente entre la revisión del escáner y el repositorio. Sólo se ejecuta
 * DESPUÉS de que una persona confirmó los datos en pantalla.
 */

import type { Actor, TramiteRepository } from '@/lib/repository/types';
import type { ArchivoOcrParaGuardar, ImagenOcr, SolicitudLeidaOcr } from '@/types/ocr';

/**
 * Prepara la imagen para guardarla como documento en el navegador. El
 * repositorio demo conserva el contenido en base64 cuando cabe y, si no,
 * guarda sólo la metadata; ningún archivo sale de esta computadora.
 */
export async function prepararArchivoOcr(
  repositorio: TramiteRepository,
  actor: Actor,
  imagen: ImagenOcr | undefined,
  solicitudes: readonly SolicitudLeidaOcr[]
): Promise<ArchivoOcrParaGuardar | undefined> {
  if (!imagen) return undefined;

  const base: ArchivoOcrParaGuardar = {
    nombre: imagen.nombre,
    mime: imagen.mime,
    sizeBytes: imagen.sizeBytes,
    ancho: imagen.ancho,
    alto: imagen.alto,
    ...(imagen.contenidoBase64 ? { contenidoBase64: imagen.contenidoBase64 } : {})
  };

  const primera = solicitudes[0];
  if (!primera) return base;

  const tramites = await repositorio.listarTramites({ actor });
  const tramite = tramites.find(
    (item) =>
      (primera.numero_control !== '' && item.numero_control === primera.numero_control) ||
      (primera.folio !== '' && item.folio === primera.folio)
  );
  if (!tramite) return base;

  const archivo = new File([imagen.blob], imagen.nombre, { type: imagen.mime });
  const subida = await repositorio.subirArchivo({
    tramiteId: tramite.id,
    archivo,
    tipo: 'acuse'
  });

  return {
    ...base,
    storagePath: subida.storagePath,
    ...(subida.contenidoBase64 && !base.contenidoBase64
      ? { contenidoBase64: subida.contenidoBase64 }
      : {})
  };
}
