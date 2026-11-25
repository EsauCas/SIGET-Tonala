// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailLogToast, useCorreos } from '@/components/EmailLogToast';

const mocks = vi.hoisted(() => ({
  procesarCola: vi.fn(),
  adaptadorCola: vi.fn(() => ({})),
  useRepository: vi.fn(),
  useAuth: vi.fn()
}));

vi.mock('@/components/RepositoryProvider', () => ({
  useRepository: mocks.useRepository
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mocks.useAuth
}));

vi.mock('@/lib/notificaciones/adaptador', () => ({
  adaptadorCola: mocks.adaptadorCola
}));

vi.mock('@/lib/notificaciones/servicio', () => ({
  procesarCola: mocks.procesarCola
}));

vi.mock('@/lib/notificaciones/simulado', () => ({
  enviadorSimulado: { enviar: vi.fn() }
}));

function aviso(
  estado: 'enviado' | 'error',
  override: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: `clave-1-${estado}`,
    asunto: 'Recibimos tu solicitud TT-2026-0001',
    destinatario: 'maria@correo-ejemplo.mx',
    enviadoA: 'maria@correo-ejemplo.mx',
    estado,
    errorMotivo: null,
    html: '<!doctype html><html lang="es"><body><p>Correo de ejemplo</p></body></html>',
    plantilla: 'acuse_recibido',
    ...override
  };
}

function publicar(detalle: Record<string, unknown>): void {
  act(() => {
    window.dispatchEvent(new CustomEvent('siget:correo', { detail: detalle }));
  });
}

function PruebaHook(): React.JSX.Element {
  const procesar = useCorreos();
  const [error, setError] = useState('');
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void procesar('clave-1').catch((fallo: unknown) => {
            setError(fallo instanceof Error ? fallo.message : 'No se pudo enviar el correo.');
          });
        }}
      >
        Procesar correo
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}

describe('EmailLogToast', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('no muestra nada hasta que hay un aviso', () => {
    const { container } = render(<EmailLogToast />);
    expect(container).toBeEmptyDOMElement();
  });

  it('anuncia el correo enviado en una región aria-live y permite descartarlo', () => {
    render(<EmailLogToast />);
    publicar(aviso('enviado'));

    expect(screen.getByRole('region', { name: 'Avisos de correo' })).toHaveAttribute(
      'aria-live',
      'polite'
    );
    expect(screen.getByText('Correo enviado')).toBeInTheDocument();
    expect(screen.getByText(/Asunto: Recibimos tu solicitud TT-2026-0001/)).toBeInTheDocument();
    expect(screen.getByText(/Para: maria@correo-ejemplo.mx/)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Descartar aviso: Recibimos tu solicitud TT-2026-0001'
      })
    );
    expect(screen.queryByText('Correo enviado')).not.toBeInTheDocument();
  });

  it('muestra el motivo del fallo y la dirección real cuando se redirigió', () => {
    render(<EmailLogToast />);
    publicar(
      aviso('error', {
        enviadoA: 'pruebas@correo-ejemplo.mx',
        errorMotivo: 'El correo simulado falló'
      })
    );

    expect(screen.getByText('No se pudo enviar el correo')).toBeInTheDocument();
    expect(screen.getByText(/Enviado a: pruebas@correo-ejemplo.mx/)).toBeInTheDocument();
    expect(screen.getByText(/Motivo: El correo simulado falló/)).toBeInTheDocument();
  });

  it('abre la vista previa del correo en un iframe sin permisos', () => {
    render(<EmailLogToast />);
    publicar(aviso('enviado', { html: '<p>Contenido de ejemplo</p>' }));

    fireEvent.click(screen.getByRole('button', { name: 'Ver correo' }));
    expect(screen.getByRole('dialog', { name: 'Vista previa del correo' })).toBeInTheDocument();
    expect(screen.getByText(/Plantilla: acuse_recibido/)).toBeInTheDocument();

    const iframe = document.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe).toHaveAttribute('srcdoc', '<p>Contenido de ejemplo</p>');
    expect(iframe).toHaveAttribute('sandbox', '');

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar vista previa' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('useCorreos', () => {
  beforeEach(() => {
    mocks.useAuth.mockReturnValue({
      actor: { id: 'usuario-secretaria-01', rol: 'secretaria', dependencia_id: null }
    });
    mocks.useRepository.mockReturnValue({
      repositorio: {},
      demo: { listarCorreosSimulados: vi.fn() },
      listo: true,
      error: null,
      modo: 'demo'
    });
    mocks.procesarCola.mockResolvedValue({
      procesados: 1,
      enviados: [
        {
          claveIdempotencia: 'clave-1',
          tramiteId: 'tramite-1',
          asunto: 'Correo de prueba',
          destinatario: 'maria@correo-ejemplo.mx',
          enviadoA: 'maria@correo-ejemplo.mx',
          estado: 'enviado',
          intentos: 1,
          errorMotivo: null,
          html: '<p>Correo de prueba</p>',
          plantilla: 'acuse_recibido'
        }
      ],
      fallidos: []
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('procesa la cola en el navegador sin llamar a ningún servidor', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(
      <>
        <EmailLogToast />
        <PruebaHook />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Procesar correo' }));

    await waitFor(() => expect(screen.getByText('Correo enviado')).toBeInTheDocument());
    expect(mocks.adaptadorCola).toHaveBeenCalledWith({});
    expect(mocks.procesarCola).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enviar: expect.any(Function) }),
      { claveIdempotencia: 'clave-1', esDemo: true }
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
