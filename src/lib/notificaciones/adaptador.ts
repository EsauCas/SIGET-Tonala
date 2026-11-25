import type { TramiteRepository } from '@/lib/repository/types';
import type { RegistroNotificaciones } from '@/lib/notificaciones/servicio';

/** Puente entre el contrato de persistencia y el procesador de correos. */
export function adaptadorCola(repositorio: TramiteRepository): RegistroNotificaciones {
  return {
    listarPendientes: () => repositorio.listarNotificacionesPendientes(),
    marcarIntento: (input) =>
      repositorio.marcarIntentoNotificacion({
        id: input.id,
        estado: input.estado,
        intentos: input.intentos,
        errorMotivo: input.errorMotivo,
        enviadoAt: input.enviadoAt,
        cuerpo: input.cuerpo,
        html: input.html,
        plantilla: input.plantilla,
        enviadoA: input.enviadoA,
        destinatarioOriginal: input.destinatarioOriginal
      }),
    datosTramite: async (tramiteId) => {
      const tramite = await repositorio.obtenerTramite(tramiteId);
      if (!tramite) return null;
      return { folio: tramite.folio, nombreCiudadano: tramite.nombre_contribuyente };
    }
  };
}
