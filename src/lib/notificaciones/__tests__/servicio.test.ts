import { describe, expect, it, vi } from 'vitest';
import { renderizarCorreo } from '@/lib/email-templates';
import {
  autorizarCron,
  esperaCreciente,
  procesarCola,
  puedeSolicitarCorreo,
  type EnviadorCorreo,
  type RegistroIntento,
  type RegistroNotificaciones
} from '@/lib/notificaciones/servicio';
import type { Notificacion } from '@/types/database';

function notificacion(
  id: string,
  clave: string,
  estado: Notificacion['estado'] = 'pendiente',
  intentos = 0
): Notificacion {
  return {
    id,
    tramite_id: 'tramite-1',
    destinatario: 'destinatario@ejemplo.mx',
    plantilla: 'confirmacion_tramite',
    asunto: `Recibimos tu solicitud TT-2026-${id}`,
    estado,
    error_motivo: null,
    clave_idempotencia: clave,
    intentos,
    created_at: '2026-11-25T08:00:00.000Z',
    enviado_at: null
  };
}

function registroInicial(filas: Notificacion[]): {
  registro: RegistroNotificaciones;
  intentos: RegistroIntento[];
} {
  const estado = [...filas];
  const intentos: RegistroIntento[] = [];
  return {
    intentos,
    registro: {
      // El contrato del repositorio devuelve sólo pendientes y fallidos, igual
      // que DemoRepository.listarNotificacionesPendientes.
      listarPendientes: async () =>
        estado
          .filter((item) => item.estado === 'pendiente' || item.estado === 'error')
          .map((item) => ({ ...item })),
      marcarIntento: async (input) => {
        intentos.push(input);
        const actual = estado.find((item) => item.id === input.id);
        if (!actual) throw new Error('No existe esa notificación.');
        const actualizado: Notificacion = {
          ...actual,
          estado: input.estado,
          intentos: input.intentos,
          error_motivo: input.errorMotivo,
          enviado_at: input.enviadoAt,
          enviado_a: input.enviadoA,
          destinatario_original: input.destinatarioOriginal
        };
        estado[estado.indexOf(actual)] = actualizado;
        return { ...actualizado };
      },
      datosTramite: async () => ({ folio: 'TT-2026-0001', nombreCiudadano: 'María Elena Ruiz' })
    }
  };
}

describe('plantillas de correo', () => {
  it('incluye versión de texto, aviso demo visible y ninguna imagen externa', () => {
    const correo = renderizarCorreo('confirmacion_tramite', {
      folio: 'TT-2026-0001',
      nombreCiudadano: 'María Elena Ruiz',
      esDemo: true
    });
    expect(correo.asunto).toContain('TT-2026-0001');
    expect(correo.texto).toContain('María Elena Ruiz');
    expect(correo.texto).toContain('Datos ficticios');
    expect(correo.html).toContain('SISTEMA DE DEMOSTRACIÓN');
    expect(correo.html).not.toMatch(/<img/);
  });

  it('muestra umbral urgente en el recordatorio y respeta alias históricos', () => {
    const urgente = renderizarCorreo('recordatorio_sla', {
      folio: 'TT-2026-0002',
      dependencia: 'Bomberos Tonalá',
      horasTranscurridas: 73,
      horasLimite: 72
    });
    expect(urgente.texto).toContain('73 horas');
    expect(renderizarCorreo('acuse_ocr', { folio: 'TT-2026-0003' }).asunto).toContain('TT-2026-0003');
  });
});

describe('procesador de la cola', () => {
  it('envía una sola vez una clave repetida dentro del mismo lote', async () => {
    const { registro } = registroInicial([
      notificacion('n1', 'clave-unica'),
      notificacion('n2', 'clave-unica')
    ]);
    const enviar = vi.fn(async () => undefined);
    const enviador: EnviadorCorreo = { enviar };
    const reloj = { ahora: () => new Date('2026-11-25T09:00:00.000Z'), esperar: vi.fn(async () => undefined) };

    const primera = await procesarCola(registro, enviador, { reloj });

    expect(enviar).toHaveBeenCalledTimes(1);
    expect(primera.procesados).toBe(1);
    expect(primera.enviados).toHaveLength(1);
  });

  it('no reenvía en una segunda pasada un correo ya marcado como enviado', async () => {
    const { registro } = registroInicial([notificacion('n1', 'clave-unica')]);
    const enviar = vi.fn(async () => undefined);
    const reloj = { ahora: () => new Date('2026-11-25T09:00:00.000Z'), esperar: vi.fn(async () => undefined) };

    const primera = await procesarCola(registro, { enviar }, { reloj });
    const segunda = await procesarCola(registro, { enviar }, { reloj });

    expect(primera.enviados).toHaveLength(1);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(segunda.procesados).toBe(0);
  });

  it('reintenta hasta tres veces con espera creciente y registra cada intento', async () => {
    const { registro, intentos } = registroInicial([notificacion('n3', 'clave-reintentos')]);
    const enviar = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('Servicio no disponible'))
      .mockRejectedValueOnce(new Error('Servicio no disponible'))
      .mockResolvedValueOnce(undefined);
    const esperas: number[] = [];
    const esperar = vi.fn(async (milisegundos: number): Promise<void> => {
      esperas.push(milisegundos);
    });
    const reloj = { ahora: () => new Date('2026-11-25T09:00:00.000Z'), esperar };

    const resultado = await procesarCola(registro, { enviar }, { reloj });

    expect(resultado.enviados[0]?.intentos).toBe(3);
    expect(intentos.map((item) => item.estado)).toEqual(['error', 'error', 'enviado']);
    expect(esperas).toEqual([esperaCreciente(1), esperaCreciente(2)]);
  });

  it('agota los reintentos sin marcar el correo como enviado', async () => {
    const { registro } = registroInicial([notificacion('n4', 'clave-fallida')]);
    const enviar = vi.fn(async () => {
      throw new Error('Transporte simulado caído');
    });
    const reloj = { ahora: () => new Date(), esperar: vi.fn(async () => undefined) };

    const resultado = await procesarCola(registro, { enviar }, { reloj });

    expect(resultado.fallidos).toHaveLength(1);
    expect(resultado.fallidos[0]?.intentos).toBe(3);
    expect(resultado.fallidos[0]?.errorMotivo).toContain('Transporte simulado caído');
    expect(enviar).toHaveBeenCalledTimes(3);
  });

  it('redirige al buzón de pruebas y conserva el destinatario original', async () => {
    const { registro, intentos } = registroInicial([notificacion('n5', 'clave-redireccion')]);
    const enviar = vi.fn(async () => undefined);
    const reloj = { ahora: () => new Date(), esperar: vi.fn(async () => undefined) };

    const resultado = await procesarCola(registro, { enviar }, {
      redirigirA: 'pruebas@ejemplo.mx',
      reloj
    });

    expect(resultado.enviados[0]?.destinatario).toBe('destinatario@ejemplo.mx');
    expect(resultado.enviados[0]?.enviadoA).toBe('pruebas@ejemplo.mx');
    expect(enviar).toHaveBeenCalledWith(
      expect.objectContaining({ destinatario: 'pruebas@ejemplo.mx' })
    );
    expect(intentos[0]?.destinatarioOriginal).toBe('destinatario@ejemplo.mx');
  });
});

describe('autorización', () => {
  it('niega correos arbitrarios a ciudadanía y permite al personal', () => {
    expect(puedeSolicitarCorreo('ciudadano')).toBe(false);
    expect(puedeSolicitarCorreo('secretaria')).toBe(true);
    expect(puedeSolicitarCorreo('bomberos')).toBe(true);
    expect(puedeSolicitarCorreo('proteccion_civil')).toBe(true);
    expect(puedeSolicitarCorreo('admin')).toBe(true);
  });

  it('exige el secreto Bearer exacto para el cron', () => {
    expect(autorizarCron('Bearer secreto-correcto', 'secreto-correcto')).toBe(true);
    expect(autorizarCron('Bearer incorrecto', 'secreto-correcto')).toBe(false);
    expect(autorizarCron(null, 'secreto-correcto')).toBe(false);
    expect(autorizarCron('Bearer secreto', '')).toBe(false);
  });
});
