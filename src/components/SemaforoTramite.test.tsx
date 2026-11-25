// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SemaforoTramite } from '@/components/SemaforoTramite';
import type { ConfiguracionSla, EstadoDependencia, TramiteConDetalle, TramiteDependencia } from '@/types/database';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const ahora = new Date('2026-06-01T12:00:00.000Z');
const haceHoras = (horas: number) => new Date(ahora.getTime() - horas * 3_600_000).toISOString();

const configuracion: ConfiguracionSla[] = [
  {
    id: 'sla-1',
    dependencia_id: 'dep-bomberos',
    horas_limite: 72,
    horas_alerta_previa: 48,
    tipo_horas: 'naturales'
  }
];

function dependencia(
  id: string,
  estado: EstadoDependencia,
  opciones: Partial<TramiteDependencia> = {}
): TramiteDependencia {
  return {
    id,
    tramite_id: 'tramite-prueba',
    dependencia_id: 'dep-bomberos',
    estado,
    turnado_at: haceHoras(100),
    acuse_at: null,
    dictamen_at: null,
    dictamen: null,
    motivo: null,
    oficio_id: null,
    sla_horas: 72,
    pausado_desde: null,
    horas_pausadas: 0,
    ...opciones
  };
}

function tramite(dependencias: TramiteDependencia[]): TramiteConDetalle {
  return {
    id: 'tramite-prueba',
    folio: 'TT-2026-0099',
    numero_control: 'CTRL-2601-0099',
    ciudadano_id: 'usuario-ciudadana-01',
    tipo_tramite: 'Licencia de funcionamiento',
    giro_principal: 'Panadería',
    giros_anexos: [],
    domicilio_negocio: 'Calle Prueba 1',
    domicilio_contribuyente: 'Calle Prueba 1',
    fecha_solicitud: '2026-05-01',
    colonia: 'Centro',
    cp: '45400',
    superficie_m2: 40,
    inversion_estimada: 100000,
    nombre_contribuyente: 'Persona de prueba',
    telefono: '3331000000',
    estado_general: 'observaciones',
    created_at: haceHoras(120),
    updated_at: haceHoras(100),
    dependencias,
    documentos: []
  };
}

afterEach(() => {
  cleanup();
  push.mockClear();
});

describe('SemaforoTramite', () => {
  it('en rojo muestra etiqueta, paso, motivo, estados por dependencia y acción de evidencia', () => {
    render(
      <SemaforoTramite
        tramite={tramite([
          dependencia('td-1', 'aprobado', { dictamen_at: haceHoras(70), dictamen: 'aprobado' }),
          dependencia('td-2', 'observaciones', {
            motivo: 'Falta el croquis de salidas de emergencia.',
            pausado_desde: haceHoras(40),
            dictamen: 'observaciones'
          })
        ])}
        configuracionSla={configuracion}
        ahora={ahora}
      />
    );

    expect(screen.getByRole('heading', { name: 'Observaciones' })).toBeInTheDocument();
    expect(screen.getByLabelText('Paso 4 de 5')).toHaveTextContent('Paso 4 de 5');
    expect(screen.getByText('Falta el croquis de salidas de emergencia.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subir evidencia/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Estado de cada dependencia')).toBeInTheDocument();
    expect(screen.getByText(/Aprobado/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4');
  });

  it('avisa de retraso cuando el reloj de dictamen supera 72 horas', () => {
    render(
      <SemaforoTramite
        tramite={tramite([dependencia('td-1', 'turnado')])}
        configuracionSla={configuracion}
        ahora={ahora}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/Retraso detectado/);
    expect(screen.getByLabelText('Horas transcurridas del reloj de dictamen')).toHaveTextContent('100.0 horas');
    expect(screen.getByRole('heading', { name: 'Turnado' })).toBeInTheDocument();
  });

  it('en verde no ofrece subir evidencia y marca el paso 5', () => {
    render(
      <SemaforoTramite
        tramite={tramite([
          dependencia('td-1', 'aprobado', { dictamen_at: haceHoras(70), dictamen: 'aprobado' })
        ])}
        configuracionSla={configuracion}
        ahora={ahora}
      />
    );

    expect(screen.getByRole('heading', { name: 'Aprobado' })).toBeInTheDocument();
    expect(screen.getByLabelText('Paso 5 de 5')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /subir evidencia/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el botón de evidencia respeta un manejador inyectado y sin él navega al detalle', () => {
    const onSubirEvidencia = vi.fn();
    const { rerender } = render(
      <SemaforoTramite
        tramite={tramite([
          dependencia('td-1', 'observaciones', { motivo: 'Falta un documento.' })
        ])}
        configuracionSla={configuracion}
        ahora={ahora}
        onSubirEvidencia={onSubirEvidencia}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /subir evidencia/i }));
    expect(onSubirEvidencia).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();

    rerender(
      <SemaforoTramite
        tramite={tramite([
          dependencia('td-1', 'observaciones', { motivo: 'Falta un documento.' })
        ])}
        configuracionSla={configuracion}
        ahora={ahora}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /subir evidencia/i }));
    expect(push).toHaveBeenCalledWith('/tramites/tramite-prueba#evidencia');
  });

  it('en rechazado explica el motivo pero no ofrece subir evidencia', () => {
    render(
      <SemaforoTramite
        tramite={tramite([
          dependencia('td-1', 'rechazado', { motivo: 'No hay extintor vigente.' })
        ])}
        configuracionSla={configuracion}
        ahora={ahora}
      />
    );

    expect(screen.getByRole('heading', { name: 'Rechazado' })).toBeInTheDocument();
    expect(screen.getByText('No hay extintor vigente.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /subir evidencia/i })).not.toBeInTheDocument();
    expect(
      screen.getByText('Si el trámite fue rechazado, llama a la ventanilla para saber qué sigue.')
    ).toBeInTheDocument();
  });
});
