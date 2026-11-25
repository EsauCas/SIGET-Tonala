import { describe, expect, it } from 'vitest';
import {
  calcularSla,
  categorizarSla,
  finalizarPausa,
  horasHabilesEntre,
  iniciarPausa,
  type ConfiguracionSlaCalculo
} from '@/lib/domain/sla';

const configuracion: ConfiguracionSlaCalculo = {
  horas_limite: 72,
  horas_alerta_previa: 48,
  tipo_horas: 'naturales'
};

const inicio = new Date('2026-01-05T08:00:00.000Z');
const enHoras = (horas: number): Date => new Date(inicio.getTime() + horas * 3_600_000);

describe('categorizarSla con límites configurables', () => {
  it('48 horas exactas entra en por vencer y 72 exactas también', () => {
    expect(categorizarSla(47.99, configuracion)).toBe('en_tiempo');
    expect(categorizarSla(48, configuracion)).toBe('por_vencer');
    expect(categorizarSla(72, configuracion)).toBe('por_vencer');
    expect(categorizarSla(72.01, configuracion)).toBe('vencido');
  });

  it('respeta una configuración distinta a la predeterminada', () => {
    const personalizada: ConfiguracionSlaCalculo = {
      horas_limite: 24,
      horas_alerta_previa: 12,
      tipo_horas: 'naturales'
    };
    expect(categorizarSla(11, personalizada)).toBe('en_tiempo');
    expect(categorizarSla(24, personalizada)).toBe('por_vencer');
    expect(categorizarSla(25, personalizada)).toBe('vencido');
  });
});

describe('calcularSla', () => {
  it('cuenta dos relojes separados y detiene el de entrega con el acuse', () => {
    const resultado = calcularSla(
      {
        turnado_at: inicio.toISOString(),
        acuse_at: enHoras(12).toISOString(),
        dictamen_at: enHoras(60).toISOString()
      },
      configuracion,
      enHoras(100)
    );

    expect(resultado.entrega.transcurrido_horas).toBe(12);
    expect(resultado.entrega.detenido_en).toBe(enHoras(12).toISOString());
    expect(resultado.dictamen.transcurrido_horas).toBe(60);
    expect(resultado.dictamen.categoria).toBe('por_vencer');
  });

  it('pausa el dictamen durante observaciones y lo reanuda con la evidencia', () => {
    const pausadoDesde = iniciarPausa(enHoras(10));
    const reanudado = finalizarPausa(pausadoDesde, 0, enHoras(20), 'naturales');

    expect(reanudado.pausado_desde).toBeNull();
    expect(reanudado.horas_pausadas).toBe(10);

    const resultado = calcularSla(
      {
        turnado_at: inicio.toISOString(),
        pausado_desde: reanudado.pausado_desde,
        horas_pausadas: reanudado.horas_pausadas
      },
      configuracion,
      enHoras(60)
    );

    expect(resultado.dictamen.transcurrido_horas).toBe(50);
    expect(resultado.dictamen.categoria).toBe('por_vencer');
    expect(resultado.dictamen.pausado).toBe(false);
  });

  it('descuenta la pausa abierta mientras espera al ciudadano', () => {
    const resultado = calcularSla(
      {
        turnado_at: inicio.toISOString(),
        pausado_desde: enHoras(10).toISOString(),
        horas_pausadas: 0
      },
      configuracion,
      enHoras(30)
    );

    // El reloj corrió 10 h antes de la pausa; las 20 h de espera no cuentan.
    expect(resultado.dictamen.transcurrido_horas).toBe(10);
    expect(resultado.dictamen.categoria).toBe('en_tiempo');
    expect(resultado.dictamen.pausado).toBe(true);
  });

  it('acumula varias pausas sin perder las anteriores', () => {
    const segunda = finalizarPausa(enHoras(30).toISOString(), 10, enHoras(34), 'naturales');
    expect(segunda.horas_pausadas).toBe(14);
  });

  it('antes del turno ambos relojes están detenidos', () => {
    const resultado = calcularSla({ turnado_at: null }, configuracion, enHoras(100));
    expect(resultado.entrega.iniciado).toBe(false);
    expect(resultado.dictamen.iniciado).toBe(false);
    expect(resultado.dictamen.categoria).toBe('en_tiempo');
  });
});

describe('horas hábiles', () => {
  it('cuenta solo lunes a viernes de 9:00 a 17:00', () => {
    const viernes16 = new Date(2026, 0, 2, 16, 0, 0, 0);
    const lunes10 = new Date(2026, 0, 5, 10, 0, 0, 0);
    expect(horasHabilesEntre(viernes16, lunes10)).toBe(2);
  });

  it('el reloj hábil también respeta la pausa', () => {
    const configHabil: ConfiguracionSlaCalculo = { ...configuracion, tipo_horas: 'habiles' };
    const lunes9 = new Date(2026, 0, 5, 9, 0, 0, 0);
    const resultado = calcularSla(
      {
        turnado_at: lunes9.toISOString(),
        pausado_desde: new Date(2026, 0, 5, 10, 0, 0, 0).toISOString()
      },
      configHabil,
      new Date(2026, 0, 5, 12, 0, 0, 0)
    );
    expect(resultado.dictamen.transcurrido_horas).toBe(1);
    expect(resultado.dictamen.pausado).toBe(true);
  });

  it('un rango fuera del horario no acumula horas', () => {
    const sabado = new Date(2026, 0, 3, 10, 0, 0, 0);
    const domingo = new Date(2026, 0, 4, 17, 0, 0, 0);
    expect(horasHabilesEntre(sabado, domingo)).toBe(0);
  });
});
