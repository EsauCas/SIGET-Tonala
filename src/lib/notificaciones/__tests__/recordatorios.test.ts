import { describe, expect, it } from 'vitest';
import { CORREOS_EJEMPLO } from '@/lib/catalogos';
import { calcularRecordatorios, type EntradaRecordatorio } from '@/lib/notificaciones/recordatorios';
import type { ConfiguracionSla, Dependencia, Tramite, TramiteDependencia } from '@/types/database';

const AHORA = new Date('2026-11-25T12:00:00.000Z');

function tramite(): Tramite {
  return {
    id: 'tramite-1',
    folio: 'TT-2026-0001',
    numero_control: 'VC-2026-0001',
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
    updated_at: '2026-11-20T12:00:00.000Z'
  };
}

function renglon(override: Partial<TramiteDependencia> = {}): TramiteDependencia {
  return {
    id: 'rd-1',
    tramite_id: 'tramite-1',
    dependencia_id: 'dep-bomberos',
    estado: 'en_inspeccion',
    turnado_at: '2026-11-23T12:00:00.000Z',
    acuse_at: null,
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

function dependencia(): Dependencia {
  return { id: 'dep-bomberos', clave: 'bomberos', nombre: 'Bomberos Tonalá' };
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

function entrada(
  fila: TramiteDependencia = renglon(),
  config: ConfiguracionSla = configuracion(),
  dep: Dependencia | undefined = dependencia()
): EntradaRecordatorio {
  return { tramite: tramite(), renglon: fila, dependencia: dep, configuracion: config };
}

describe('calcularRecordatorios', () => {
  it('genera alerta en el umbral previo y vencido pasado el límite, con clave por día', () => {
    const planeados = calcularRecordatorios(
      [
        entrada(renglon({ id: 'rd-alerta', turnado_at: '2026-11-23T12:00:00.000Z' })),
        entrada(renglon({ id: 'rd-vencido', turnado_at: '2026-11-22T11:00:00.000Z' }))
      ],
      AHORA
    );

    expect(planeados).toHaveLength(2);
    expect(planeados[0]).toMatchObject({
      claveIdempotencia: 'recordatorio-rd-alerta-2026-11-25-alerta',
      severidad: 'alerta',
      horasTranscurridas: 48,
      horasLimite: 72,
      plantilla: 'recordatorio_sla',
      tramiteId: 'tramite-1',
      destinatario: CORREOS_EJEMPLO.bomberos
    });
    expect(planeados[1]).toMatchObject({
      claveIdempotencia: 'recordatorio-rd-vencido-2026-11-25-vencido',
      severidad: 'vencido',
      horasTranscurridas: 73
    });
    expect(planeados[0]?.cuerpo).toContain('48 horas');
    expect(planeados[0]?.asunto).toContain('TT-2026-0001');
  });

  it('no avisa antes del umbral ni duplica una misma clave', () => {
    const temprano = calcularRecordatorios(
      [entrada(renglon({ turnado_at: '2026-11-24T12:00:00.000Z' }))],
      AHORA
    );
    expect(temprano).toHaveLength(0);

    const duplicados = calcularRecordatorios(
      [entrada(), entrada({ ...renglon() })],
      AHORA
    );
    expect(duplicados).toHaveLength(1);
  });

  it('omite renglones sin turnar, con dictamen, terminales y en espera del ciudadano', () => {
    const omitidos = calcularRecordatorios(
      [
        entrada(renglon({ id: 'sin-turno', turnado_at: null })),
        entrada(renglon({ id: 'con-dictamen', dictamen_at: '2026-11-24T10:00:00.000Z' })),
        entrada(renglon({ id: 'aprobado', estado: 'aprobado' })),
        entrada(renglon({ id: 'rechazado', estado: 'rechazado' })),
        entrada(renglon({ id: 'en-pausa', pausado_desde: '2026-11-24T12:00:00.000Z' }))
      ],
      AHORA
    );

    expect(omitidos).toHaveLength(0);
  });

  it('respeta el tipo de horas configurado (naturales contra hábiles)', () => {
    // Viernes 10:00 -> lunes 10:00: 72 h naturales, 8 h hábiles.
    const inicio = new Date(2026, 10, 20, 10, 0, 0).toISOString();
    const fin = new Date(2026, 10, 23, 10, 0, 0);

    const naturales = calcularRecordatorios(
      [entrada(renglon({ id: 'natural', turnado_at: inicio }), configuracion())],
      fin
    );
    const habiles = calcularRecordatorios(
      [
        entrada(
          renglon({ id: 'habil', turnado_at: inicio }),
          configuracion({ tipo_horas: 'habiles' })
        )
      ],
      fin
    );

    expect(naturales).toHaveLength(1);
    expect(naturales[0]?.severidad).toBe('alerta');
    expect(naturales[0]?.horasTranscurridas).toBe(72);
    expect(habiles).toHaveLength(0);
  });

  it('usa ventanilla como destino cuando no se conoce la dependencia', () => {
    const planeados = calcularRecordatorios(
      [{ tramite: tramite(), renglon: renglon(), dependencia: undefined, configuracion: configuracion() }],
      AHORA
    );
    expect(planeados[0]?.destinatario).toBe(CORREOS_EJEMPLO.ventanilla);
  });
});
