import type { EnviadorCorreo } from '@/lib/notificaciones/servicio';

/**
 * Transporte de demostración: nunca usa internet. La latencia
 * breve hace visible el estado "enviando" en la interfaz y se inyecta en las
 * pruebas para que no dependan de temporizadores reales.
 */
export const enviadorSimulado: EnviadorCorreo = {
  async enviar(): Promise<void> {
    await new Promise((resolver) => {
      setTimeout(resolver, 120);
    });
  }
};
