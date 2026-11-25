// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AsistenteTramite } from '@/components/AsistenteTramite';
import type { Tramite } from '@/types/database';

const mocks = vi.hoisted(() => ({
  crearTramite: vi.fn(),
  encolarNotificacion: vi.fn()
}));

vi.mock('@/components/RepositoryProvider', () => ({
  useRepository: () => ({
    repositorio: {
      crearTramite: mocks.crearTramite,
      encolarNotificacion: mocks.encolarNotificacion
    },
    listo: true,
    demo: null,
    error: null,
    modo: 'demo'
  })
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    actor: { id: 'usuario-ciudadana-01', rol: 'ciudadano', dependencia_id: null },
    perfil: {
      id: 'usuario-ciudadana-01',
      nombre: 'María Elena Ruiz',
      email: 'maria@correo-ejemplo.mx',
      rol: 'ciudadano',
      dependencia_id: null
    },
    cargando: false,
    error: null,
    recargar: vi.fn()
  })
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

function tramiteDePrueba(): Tramite {
  return {
    id: 'tramite-nuevo',
    folio: 'TT-2026-0011',
    numero_control: 'CTRL-2611-0011',
    ciudadano_id: 'usuario-ciudadana-01',
    tipo_tramite: 'Giro Blanco',
    giro_principal: 'Panadería prueba',
    giros_anexos: ['Venta de café'],
    domicilio_negocio: 'Av. Tonalá 100',
    domicilio_contribuyente: 'Calle Reforma 12',
    fecha_solicitud: '2026-11-24',
    colonia: 'Centro',
    cp: '45400',
    superficie_m2: 48,
    inversion_estimada: 85000,
    nombre_contribuyente: 'María Elena Ruiz',
    telefono: '3331000001',
    estado_general: 'recepcion',
    created_at: '2026-11-24T12:00:00.000Z',
    updated_at: '2026-11-24T12:00:00.000Z'
  };
}

function cambiar(etiqueta: string, valor: string): void {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

function llenarForma(): void {
  cambiar('Nombre de la persona contribuyente', 'María Elena Ruiz');
  cambiar('Domicilio de la persona contribuyente', 'Calle Reforma 12');
  cambiar('Teléfono a 10 números', '3331000001');
  cambiar('Tipo de licencia', 'Giro Blanco');
  cambiar('Giro principal del negocio', 'Panadería prueba');
  cambiar('Otros giros (opcional, separa con comas)', 'Venta de café');
  cambiar('Calle y número del negocio', 'Av. Tonalá 100');
  cambiar('Colonia del negocio', 'Centro');
  cambiar('Código postal (5 números)', '45400');
  cambiar('Superficie en metros cuadrados', '48');
  cambiar('Inversión estimada en pesos', '85000');
  fireEvent.click(screen.getByLabelText('Bomberos Tonalá'));
}

describe('AsistenteTramite', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mocks.crearTramite.mockResolvedValue(tramiteDePrueba());
    mocks.encolarNotificacion.mockResolvedValue({
      id: 'notif-nueva',
      clave_idempotencia: 'confirmacion-tramite-nuevo'
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('no avanza con datos incompletos y muestra el error en lenguaje claro', () => {
    render(<AsistenteTramite />);
    expect(screen.getByText(/Paso 1 de 3/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Capturar datos a mano' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revisar mis datos' }));

    expect(document.getElementById('error-nombre_contribuyente')).toHaveTextContent(
      'Escribe el nombre de la persona contribuyente.'
    );
    expect(screen.getByText(/Paso 2 de 3/)).toBeInTheDocument();
    expect(mocks.crearTramite).not.toHaveBeenCalled();
  });

  it('guarda el trámite y encola la confirmación con clave idempotente', async () => {
    render(<AsistenteTramite />);

    fireEvent.click(screen.getByRole('button', { name: 'Capturar datos a mano' }));
    llenarForma();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar mis datos' }));

    expect(screen.getByText(/Paso 3 de 3/)).toBeInTheDocument();
    expect(screen.getByText('Panadería prueba')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar mi solicitud' }));

    await waitFor(() => expect(mocks.crearTramite).toHaveBeenCalledOnce());
    await waitFor(() => expect(mocks.encolarNotificacion).toHaveBeenCalledOnce());
    expect(mocks.crearTramite.mock.calls[0]?.[0]).toMatchObject({
      domicilio_contribuyente: 'Calle Reforma 12',
      fecha_solicitud: expect.any(String),
      dependenciasRequeridas: ['bomberos']
    });
    expect(mocks.encolarNotificacion.mock.calls[0]?.[0]).toMatchObject({
      claveIdempotencia: 'confirmacion-tramite-nuevo',
      plantilla: 'confirmacion_tramite'
    });
    expect(screen.getByRole('heading', { name: 'Tu solicitud quedó registrada' })).toBeInTheDocument();
    expect(screen.getByText(/TT-2026-0011/)).toBeInTheDocument();
    expect(window.sessionStorage.getItem('siget-tonala:borrador-asistente')).toBeNull();
  });

  it('conserva el borrador al recargar la pantalla', () => {
    const primera = render(<AsistenteTramite />);
    fireEvent.click(screen.getByRole('button', { name: 'Capturar datos a mano' }));
    cambiar('Giro principal del negocio', 'Panadería guardada');
    expect(window.sessionStorage.getItem('siget-tonala:borrador-asistente')).toContain('Panadería guardada');
    primera.unmount();

    render(<AsistenteTramite />);
    fireEvent.click(screen.getByRole('button', { name: 'Capturar datos a mano' }));
    expect(screen.getByLabelText('Giro principal del negocio')).toHaveValue('Panadería guardada');
  });
});
