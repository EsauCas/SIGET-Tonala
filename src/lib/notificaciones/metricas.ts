/** Métricas puras de tiempos muertos para el panel de administración. */

import { CONFIGURACION_PREDETERMINADA, calcularSla } from '@/lib/domain/sla';
import { now } from '@/lib/reloj-demo';
import type { ConfiguracionSla, Dependencia, TramiteConDetalle } from '@/types/database';

export interface MetricaTiempoMuerto {
  dependenciaId: string;
  nombre: string;
  expedientes: number;
  horasPromedio: number;
  horasMaximas: number;
}

/**
 * "Tiempo muerto" es el reloj de entrega: desde que se turna el oficio hasta
 * que se registra el acuse sellado. Si aún no hay acuse se mide hasta `ahora`.
 */
export function calcularMetricasTiemposMuertos(
  tramites: readonly TramiteConDetalle[],
  dependencias: readonly Dependencia[],
  configuracion: readonly ConfiguracionSla[],
  ahora: Date = now()
): MetricaTiempoMuerto[] {
  const acumulados = new Map<string, { total: number; max: number; cantidad: number }>();

  for (const tramite of tramites) {
    for (const renglon of tramite.dependencias) {
      if (!renglon.turnado_at) continue;
      const reloj = calcularSla(
        {
          turnado_at: renglon.turnado_at,
          acuse_at: renglon.acuse_at,
          dictamen_at: renglon.dictamen_at,
          pausado_desde: renglon.pausado_desde,
          horas_pausadas: renglon.horas_pausadas
        },
        configuracion.find((item) => item.dependencia_id === renglon.dependencia_id) ??
          CONFIGURACION_PREDETERMINADA,
        ahora
      );
      const horas = reloj.entrega.transcurrido_horas;
      const actual = acumulados.get(renglon.dependencia_id) ?? { total: 0, max: 0, cantidad: 0 };
      actual.total += horas;
      actual.max = Math.max(actual.max, horas);
      actual.cantidad += 1;
      acumulados.set(renglon.dependencia_id, actual);
    }
  }

  return dependencias
    .map((dependencia) => {
      const datos = acumulados.get(dependencia.id) ?? { total: 0, max: 0, cantidad: 0 };
      return {
        dependenciaId: dependencia.id,
        nombre: dependencia.nombre,
        expedientes: datos.cantidad,
        horasPromedio: datos.cantidad > 0 ? Math.round(datos.total / datos.cantidad) : 0,
        horasMaximas: Math.round(datos.max)
      };
    })
    .sort((a, b) => b.horasPromedio - a.horasPromedio);
}
