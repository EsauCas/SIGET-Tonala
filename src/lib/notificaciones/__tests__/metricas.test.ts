import { describe, expect, it } from 'vitest';
import { calcularMetricasTiemposMuertos } from '@/lib/notificaciones/metricas';
import type { ConfiguracionSla, Dependencia, TramiteConDetalle, TramiteDependencia } from '@/types/database';

const AHORA = new Date('2026-11-25T12:00:00.000Z');

function dependencia(id = 'dep-bomberos', nombre = 'Bomberos Tonalá'): Dependencia {
  return { id, clave: id === 'dep-bomberos' ? 'bomberos' : 'proteccion_civil', nombre };
}

function configuracion(override: Partial<ConfiguracionSla> = {}): ConfiguracionSla {
  return {
    id: 'sla-1',
    dependencia_id: 'dep-bomberos',
    horas_limite: 72,
    horas_alerta_previa: 48,
    tipo_horas: 'naturales',
    ...override
  };
}

function fila(override: Partial<TramiteDependencia> = {}): TramiteDependencia {
  return {
    id: 'rd-1',
    tramite_id: 'tramite-1',
    dependencia_id: 'dep-bomberos',
    estado: 'en_inspeccion',
    turnado_at: '2026-11-25T04:00:00.000Z',
    acuse_at: '2026-11-25T10:00:00.000Z',
    dictamen_at: null,
    dictamen: null,
    motivo: null,
    oficio_id: null,
    sla_horas: 72,
    pausado_desde: null,
    horas_pausadas: 0,
    ...override
  };
}

function tramite(filas: TramiteDependencia[], id = 'tramite-1'): TramiteConDetalle {
  return {
    id,
    folio: `TT-2026-${id}`,
    numero_control: `VC-2026-${id}`,
    ciudadano_id: 'usuario-ciudadana-01',
    tipo_tramite: 'Licencia de funcionamiento',
    giro_principal: 'Abarrotes',
    giros_anexos: [],
    domicilio_negocio: 'Calle Centro 1',
    domicilio_contribuyente: 'Calle Centro 1',
    fecha_solicitud: '2026-11-20',
    colonia: 'Centro',
    cp: '45400',
    superficie_m2: 80,
    inversion_estimada: 50000,
    nombre_contribuyente: 'María Elena Ruiz',
    telefono: '3312345678',
    estado_general: 'verificacion',
    created_at: '2026-11-20T12:00:00.000Z',
    updated_at: '2026-11-20T12:00:00.000Z',
    dependencias: filas,
    documentos: []
  };
}

describe('calcularMetricasTiemposMuertos', () => {
  it('calcula promedio y máximo por dependencia y ordena de mayor a menor', () => {
    const metricas = calcularMetricasTiemposMuertos(
      [
        tramite([
          fila({ id: 'rd-1', turnado_at: '2026-11-25T04:00:00.000Z', acuse_at: '2026-11-25T10:00:00.000Z' }),
          fila({ id: 'rd-2', tramite_id: 'tramite-2', turnado_at: '2026-11-25T00:00:00.000Z', acuse_at: null }),
          fila({
            id: 'rd-3',
            tramite_id: 'tramite-3',
            dependencia_id: 'dep-pc',
            turnado_at: '2026-11-25T11:00:00.000Z',
            acuse_at: '2026-11-25T12:00:00.000Z'
          })
        ])
      ],
      [dependencia(), dependencia('dep-pc', 'Protección Civil Tonalá')],
      [configuracion(), configuracion({ id: 'sla-2', dependencia_id: 'dep-pc' })],
      AHORA
    );

    expect(metricas).toHaveLength(2);
    expect(metricas[0]).toMatchObject({
      dependenciaId: 'dep-bomberos',
      nombre: 'Bomberos Tonalá',
      expedientes: 2,
      horasPromedio: 9,
      horasMaximas: 12
    });
    expect(metricas[1]).toMatchObject({
      dependenciaId: 'dep-pc',
      expedientes: 1,
      horasPromedio: 1,
      horasMaximas: 1
    });
  });

  it('omite renglones sin turnar y reporta cero para dependencias sin expedientes', () => {
    const metricas = calcularMetricasTiemposMuertos(
      [tramite([fila({ id: 'sin-turno', turnado_at: null })])],
      [dependencia(), dependencia('dep-pc', 'Protección Civil Tonalá')],
      [configuracion()],
      AHORA
    );

    expect(metricas).toHaveLength(2);
    expect(metricas.every((item) => item.expedientes === 0 && item.horasPromedio === 0)).toBe(true);
  });

  it('aplica horas hábiles cuando la dependencia lo configura', () => {
    // Viernes 17:00 -> lunes 9:00: 64 h naturales, 0 h hábiles.
    const turnado = new Date(2026, 10, 20, 17, 0, 0).toISOString();
    const fin = new Date(2026, 10, 23, 9, 0, 0);
    const entrada = tramite([fila({ turnado_at: turnado, acuse_at: null })]);

    const naturales = calcularMetricasTiemposMuertos(
      [entrada],
      [dependencia()],
      [configuracion()],
      fin
    );
    const habiles = calcularMetricasTiemposMuertos(
      [entrada],
      [dependencia()],
      [configuracion({ tipo_horas: 'habiles' })],
      fin
    );

    expect(naturales[0]?.horasPromedio).toBe(64);
    expect(habiles[0]?.horasPromedio).toBe(0);
  });
});
