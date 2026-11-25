import { describe, expect, it } from 'vitest';
import {
  canTransition,
  deriveEstadoGeneral,
  puedeOperarDependencia,
  resolucionConsolidada,
  type DependenciaParaEstado
} from '@/lib/domain/estado-tramite';
import type { EstadoDependencia, Rol } from '@/types/database';

function dep(estado: EstadoDependencia, motivo: string | null = null): DependenciaParaEstado {
  return { estado, motivo };
}

describe('deriveEstadoGeneral', () => {
  it('con dos dependencias, una aprobada y otra en observaciones, queda en rojo', () => {
    const resultado = deriveEstadoGeneral([dep('aprobado'), dep('observaciones', 'Falta el croquis')]);

    expect(resultado.etapa).toBe('observaciones');
    expect(resultado.color).toBe('rojo');
    expect(resultado.etiqueta).toBe('Observaciones');
    expect(resultado.motivo).toBe('Falta el croquis');
    expect(resolucionConsolidada([dep('aprobado'), dep('observaciones')])).toBe('no_aprobada');
  });

  it('muestra la etiqueta Rechazado y el motivo cuando alguna dependencia rechaza', () => {
    const resultado = deriveEstadoGeneral([
      dep('aprobado'),
      dep('rechazado', 'El local no cumple la salida de emergencia')
    ]);

    expect(resultado.color).toBe('rojo');
    expect(resultado.etiqueta).toBe('Rechazado');
    expect(resultado.motivo).toBe('El local no cumple la salida de emergencia');
  });

  it('solo es verde cuando todas las dependencias requeridas aprobaron', () => {
    const aprobadas = [dep('aprobado'), dep('aprobado')];
    expect(deriveEstadoGeneral(aprobadas).color).toBe('verde');
    expect(deriveEstadoGeneral(aprobadas).etapa).toBe('aprobado');
    expect(resolucionConsolidada(aprobadas)).toBe('aprobada');
  });

  it('prioriza revisión sobre turno y turno sobre recepción', () => {
    expect(deriveEstadoGeneral([dep('turnado'), dep('en_inspeccion')]).color).toBe('ambar');
    expect(deriveEstadoGeneral([dep('turnado'), dep('pendiente')]).color).toBe('azul');
    expect(deriveEstadoGeneral([dep('pendiente')]).color).toBe('gris');
  });

  it('sin dependencias requeridas queda en recepción', () => {
    expect(deriveEstadoGeneral([])).toMatchObject({ etapa: 'recepcion', color: 'gris' });
    expect(resolucionConsolidada([])).toBe('no_aprobada');
  });
});

describe('canTransition', () => {
  it('secretaría turna pero no dictamina', () => {
    expect(canTransition('secretaria', 'pendiente', 'turnado')).toBe(true);
    expect(canTransition('secretaria', 'turnado', 'en_inspeccion')).toBe(false);
    expect(canTransition('secretaria', 'en_inspeccion', 'aprobado')).toBe(false);
  });

  it('bomberos y protección civil reciben y dictaminan su revisión', () => {
    const roles: Rol[] = ['bomberos', 'proteccion_civil'];
    for (const rol of roles) {
      expect(canTransition(rol, 'turnado', 'en_inspeccion')).toBe(true);
      expect(canTransition(rol, 'en_inspeccion', 'aprobado')).toBe(true);
      expect(canTransition(rol, 'en_inspeccion', 'rechazado')).toBe(true);
      expect(canTransition(rol, 'en_inspeccion', 'observaciones')).toBe(true);
      expect(canTransition(rol, 'pendiente', 'turnado')).toBe(false);
      expect(canTransition(rol, 'aprobado', 'en_inspeccion')).toBe(false);
    }
  });

  it('el ciudadano solo entrega evidencia desde observaciones', () => {
    expect(canTransition('ciudadano', 'observaciones', 'en_inspeccion')).toBe(true);
    expect(canTransition('ciudadano', 'turnado', 'en_inspeccion')).toBe(false);
    expect(canTransition('ciudadano', 'en_inspeccion', 'aprobado')).toBe(false);
  });

  it('admin configura y audita, pero no opera el estado del trámite', () => {
    const estados: EstadoDependencia[] = [
      'pendiente',
      'turnado',
      'en_inspeccion',
      'observaciones',
      'aprobado',
      'rechazado'
    ];
    for (const origen of estados) {
      for (const destino of estados) {
        expect(canTransition('admin', origen, destino)).toBe(false);
      }
    }
  });

  it('los estados terminales no se reabren', () => {
    expect(canTransition('bomberos', 'aprobado', 'observaciones')).toBe(false);
    expect(canTransition('proteccion_civil', 'rechazado', 'en_inspeccion')).toBe(false);
  });
});

describe('puedeOperarDependencia', () => {
  it('cada dependencia solo opera sobre sus propios turnos', () => {
    expect(puedeOperarDependencia('bomberos', 'dep-bomberos', 'dep-bomberos')).toBe(true);
    expect(puedeOperarDependencia('bomberos', 'dep-bomberos', 'dep-pc')).toBe(false);
    expect(puedeOperarDependencia('proteccion_civil', null, 'dep-pc')).toBe(false);
    expect(puedeOperarDependencia('ciudadano', 'dep-bomberos', 'dep-bomberos')).toBe(false);
  });

  it('secretaría y admin pueden consultar cualquier dependencia', () => {
    expect(puedeOperarDependencia('secretaria', 'dep-ventanilla', 'dep-bomberos')).toBe(true);
    expect(puedeOperarDependencia('admin', null, 'dep-pc')).toBe(true);
  });
});
