import { describe, expect, it } from 'vitest';
import {
  aCrearTramiteInput,
  crearFormaVacia,
  primerError,
  validarSolicitud,
  type DatosSolicitud
} from '@/lib/validacion-solicitud';
import type { Actor } from '@/lib/repository/types';

function formaValida(): DatosSolicitud {
  return {
    ...crearFormaVacia(),
    fecha_solicitud: '2026-11-24',
    nombre_contribuyente: 'María Elena Ruiz',
    domicilio_contribuyente: 'Calle Reforma 12',
    domicilio_negocio: 'Av. Tonalá 100',
    colonia: 'Centro',
    cp: '45400',
    telefono: '3331000001',
    tipo_tramite: 'Giro Blanco',
    giro_principal: 'Panadería',
    giros_anexos: 'Venta de café, Venta de pan',
    superficie_m2: '48.5',
    inversion_estimada: '85000',
    dependenciasRequeridas: ['bomberos']
  };
}

describe('validarSolicitud', () => {
  it('acepta una solicitud completa', () => {
    expect(validarSolicitud(formaValida())).toEqual({});
  });

  it('pide los campos obligatorios con mensajes claros', () => {
    const errores = validarSolicitud(crearFormaVacia());
    expect(errores.nombre_contribuyente).toMatch(/nombre de la persona contribuyente/i);
    expect(errores.domicilio_contribuyente).toMatch(/domicilio particular/i);
    expect(errores.domicilio_negocio).toMatch(/calle y el número/i);
    expect(errores.colonia).toMatch(/selecciona la colonia/i);
    expect(errores.tipo_tramite).toMatch(/tipo de licencia/i);
    expect(errores.giro_principal).toMatch(/giro principal/i);
    expect(errores.dependenciasRequeridas).toMatch(/bomberos/i);
    expect(primerError(errores)).toBe(errores.nombre_contribuyente);
  });

  it('exige código postal de 5 dígitos y teléfono de 10 números', () => {
    const forma = { ...formaValida(), cp: '4540', telefono: '333100000' };
    const errores = validarSolicitud(forma);
    expect(errores.cp).toMatch(/5 números/i);
    expect(errores.telefono).toMatch(/10 números/i);
  });

  it('exige superficie mayor a cero e inversión numérica no negativa', () => {
    const forma = { ...formaValida(), superficie_m2: '0', inversion_estimada: '-5' };
    const errores = validarSolicitud(forma);
    expect(errores.superficie_m2).toMatch(/mayor a cero/i);
    expect(errores.inversion_estimada).toMatch(/cero o más/i);
  });

  it('rechaza texto que no sea número en superficie e inversión', () => {
    const errores = validarSolicitud({
      ...formaValida(),
      superficie_m2: 'mucho',
      inversion_estimada: 'poco'
    });
    expect(errores.superficie_m2).toBeDefined();
    expect(errores.inversion_estimada).toBeDefined();
  });

  it('convierte la forma al input del repositorio sin inventar folio ni control', () => {
    const actor: Actor = { id: 'u-1', rol: 'ciudadano', dependencia_id: null };
    const entrada = aCrearTramiteInput(actor, formaValida());
    expect(entrada.giros_anexos).toEqual(['Venta de café', 'Venta de pan']);
    expect(entrada.domicilio_contribuyente).toBe('Calle Reforma 12');
    expect(entrada.fecha_solicitud).toBe('2026-11-24');
    expect(entrada.superficie_m2).toBe(48.5);
    expect(entrada.inversion_estimada).toBe(85000);
    expect(entrada).not.toHaveProperty('folio');
    expect(entrada).not.toHaveProperty('numero_control');
  });
});
