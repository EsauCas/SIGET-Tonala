import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reiniciarRelojDemo } from '@/lib/reloj-demo';
import { DemoRepository } from '@/lib/repository/demo-repository';
import { IDS_DEMO } from '@/lib/repository/demo-seed';
import type { Actor } from '@/lib/repository/types';
import type { Profile } from '@/types/database';

class LocalStorageMemoria {
  private readonly datos = new Map<string, string>();

  getItem(clave: string): string | null {
    return this.datos.get(clave) ?? null;
  }

  setItem(clave: string, valor: string): void {
    this.datos.set(clave, valor);
  }

  removeItem(clave: string): void {
    this.datos.delete(clave);
  }
}

function instalarLocalStorage(): LocalStorageMemoria {
  const memoria = new LocalStorageMemoria();
  vi.stubGlobal('window', { localStorage: memoria });
  return memoria;
}

async function actor(repositorio: DemoRepository, id: string): Promise<Actor> {
  const perfiles = await repositorio.listarPerfiles();
  const perfil = perfiles.find((item: Profile) => item.id === id);
  if (!perfil) throw new Error('Perfil de prueba no encontrado');
  return { id: perfil.id, rol: perfil.rol, dependencia_id: perfil.dependencia_id };
}

describe('DemoRepository', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    reiniciarRelojDemo();
  });

  it('siembra 12 trámites, 5 perfiles y 3 dependencias, y persiste en localStorage', async () => {
    const memoria = instalarLocalStorage();
    const repositorio = new DemoRepository();

    expect(await repositorio.listarTramites()).toHaveLength(12);
    expect(await repositorio.listarPerfiles()).toHaveLength(5);
    expect(await repositorio.listarDependencias()).toHaveLength(3);
    expect(memoria.getItem('siget-tonala:demo')).toContain('"version":2');
  });

  it('vuelve a sembrar cuando cambia la versión de persistencia', async () => {
    const memoria = instalarLocalStorage();
    const primero = new DemoRepository();
    await primero.listarTramites();

    const guardado = JSON.parse(
      memoria.getItem('siget-tonala:demo') ?? '{}'
    ) as { version: number; estado: unknown };
    memoria.setItem('siget-tonala:demo', JSON.stringify({ ...guardado, version: 1 }));

    const segundo = new DemoRepository();
    expect(await segundo.listarTramites()).toHaveLength(12);
    expect(memoria.getItem('siget-tonala:demo')).toContain('"version":2');
  });

  it('el botón de reinicio devuelve los datos semilla', async () => {
    instalarLocalStorage();
    const repositorio = new DemoRepository();
    const ciudadana = await actor(repositorio, IDS_DEMO.ciudadana);

    await repositorio.crearTramite({
      actor: ciudadana,
      tipo_tramite: 'Licencia de funcionamiento',
      giro_principal: 'Panadería de prueba',
      giros_anexos: [],
      domicilio_negocio: 'Calle Prueba 1',
      colonia: 'Centro',
      cp: '45400',
      superficie_m2: 30,
      inversion_estimada: 1000,
      nombre_contribuyente: 'Persona de prueba',
      telefono: '3331000000',
      dependenciasRequeridas: ['bomberos']
    });
    expect(await repositorio.listarTramites()).toHaveLength(13);

    await repositorio.reiniciar();
    expect(await repositorio.listarTramites()).toHaveLength(12);
  });

  it('recorre el flujo completo y respeta las transiciones por rol', async () => {
    instalarLocalStorage();
    const repositorio = new DemoRepository();
    const ciudadana = await actor(repositorio, IDS_DEMO.ciudadana);
    const secretaria = await actor(repositorio, IDS_DEMO.secretaria);
    const bomberos = await actor(repositorio, IDS_DEMO.bomberos);

    const creado = await repositorio.crearTramite({
      actor: ciudadana,
      tipo_tramite: 'Licencia de funcionamiento',
      giro_principal: 'Ferretería de prueba',
      giros_anexos: [],
      domicilio_negocio: 'Calle Prueba 2',
      colonia: 'Centro',
      cp: '45400',
      superficie_m2: 40,
      inversion_estimada: 2000,
      nombre_contribuyente: 'Persona de prueba',
      telefono: '3331000000',
      dependenciasRequeridas: ['bomberos']
    });

    const detalleInicial = await repositorio.obtenerTramite(creado.id);
    const dependenciaInicial = detalleInicial?.dependencias[0];
    expect(dependenciaInicial).toBeDefined();
    if (!dependenciaInicial) throw new Error('Sin dependencia');
    expect(detalleInicial?.estado_general).toBe('recepcion');

    await expect(
      repositorio.registrarRecepcion({ actor: bomberos, tramiteDependenciaId: dependenciaInicial.id })
    ).rejects.toThrow('no puede pasar a inspección');

    await repositorio.registrarTurno({ actor: secretaria, tramiteDependenciaId: dependenciaInicial.id });
    await repositorio.registrarAcuse({
      actor: secretaria,
      tramiteDependenciaId: dependenciaInicial.id,
      selloFolio: 'SEL-PRUEBA-1'
    });
    await repositorio.registrarRecepcion({ actor: bomberos, tramiteDependenciaId: dependenciaInicial.id });

    await expect(
      repositorio.dictaminar({
        actor: ciudadana,
        tramiteDependenciaId: dependenciaInicial.id,
        dictamen: 'aprobado',
        motivo: null
      })
    ).rejects.toThrow('no puede operar');

    const observado = await repositorio.dictaminar({
      actor: bomberos,
      tramiteDependenciaId: dependenciaInicial.id,
      dictamen: 'observaciones',
      motivo: 'Falta una foto del local'
    });
    expect(observado.estado).toBe('observaciones');
    expect(observado.pausado_desde).not.toBeNull();

    const evidencia = await repositorio.agregarEvidencia({
      actor: ciudadana,
      tramiteDependenciaId: dependenciaInicial.id,
      tipo: 'evidencia',
      nombreArchivo: 'foto-local.pdf',
      mime: 'application/pdf',
      sizeBytes: 1024,
      storagePath: `${creado.id}/foto-local.pdf`
    });
    expect(evidencia.tramite_id).toBe(creado.id);

    const reanudado = await repositorio.obtenerTramite(creado.id);
    expect(reanudado?.dependencias[0]?.estado).toBe('en_inspeccion');
    expect(reanudado?.dependencias[0]?.pausado_desde).toBeNull();

    await repositorio.dictaminar({
      actor: bomberos,
      tramiteDependenciaId: dependenciaInicial.id,
      dictamen: 'aprobado',
      motivo: null
    });
    const final = await repositorio.obtenerTramite(creado.id);
    expect(final?.estado_general).toBe('aprobado');
    expect((await repositorio.listarHistorial(creado.id)).length).toBeGreaterThan(4);
  });

  it('la idempotencia evita duplicar notificaciones', async () => {
    instalarLocalStorage();
    const repositorio = new DemoRepository();
    const input = {
      tramiteId: 'tramite-001',
      destinatario: 'ejemplo@correo-ejemplo.mx',
      plantilla: 'recordatorio_sla',
      asunto: 'Recordatorio',
      cuerpo: 'Tu revisión sigue en plazo.',
      claveIdempotencia: 'clave-unica-prueba'
    };

    const primera = await repositorio.registrarNotificacion(input);
    const segunda = await repositorio.registrarNotificacion(input);
    expect(segunda.id).toBe(primera.id);
    expect((await repositorio.listarNotificaciones()).filter((item) => item.clave_idempotencia === input.claveIdempotencia)).toHaveLength(1);
  });

  it('crea en recepción con evento y aviso encolado, y la evidencia reanuda la revisión', async () => {
    instalarLocalStorage();
    const repositorio = new DemoRepository();
    const ciudadana = await actor(repositorio, IDS_DEMO.ciudadana);
    const secretaria = await actor(repositorio, IDS_DEMO.secretaria);
    const bomberos = await actor(repositorio, IDS_DEMO.bomberos);

    const creado = await repositorio.crearTramite({
      actor: ciudadana,
      tipo_tramite: 'Giro Blanco',
      giro_principal: 'Panadería Fase 3',
      giros_anexos: ['Venta de café'],
      domicilio_negocio: 'Calle Fase 3 número 1',
      domicilio_contribuyente: 'Calle Particular 5',
      fecha_solicitud: '2026-11-24',
      colonia: 'Centro',
      cp: '45400',
      superficie_m2: 50,
      inversion_estimada: 100000,
      nombre_contribuyente: 'Persona Fase 3',
      telefono: '3331000099',
      dependenciasRequeridas: ['bomberos']
    });

    const detalleInicial = await repositorio.obtenerTramite(creado.id);
    expect(detalleInicial?.estado_general).toBe('recepcion');
    expect(detalleInicial?.domicilio_contribuyente).toBe('Calle Particular 5');
    expect(detalleInicial?.fecha_solicitud).toBe('2026-11-24');
    expect((await repositorio.listarHistorial(creado.id)).some((item) => item.accion === 'tramite_creado')).toBe(true);

    const clave = `confirmacion-${creado.id}`;
    const notificacion = await repositorio.encolarNotificacion({
      tramiteId: creado.id,
      destinatario: 'persona@correo-ejemplo.mx',
      plantilla: 'confirmacion_tramite',
      asunto: `Recibimos tu solicitud ${creado.folio}`,
      cuerpo: 'Guarda tu folio para dar seguimiento.',
      claveIdempotencia: clave
    });
    expect(notificacion.clave_idempotencia).toBe(clave);
    const repetida = await repositorio.encolarNotificacion({
      tramiteId: creado.id,
      destinatario: 'otro@correo-ejemplo.mx',
      plantilla: 'confirmacion_tramite',
      asunto: 'Otro asunto',
      cuerpo: 'No debe duplicarse.',
      claveIdempotencia: clave
    });
    expect(repetida.id).toBe(notificacion.id);

    const dependencia = detalleInicial?.dependencias[0];
    if (!dependencia) throw new Error('Sin dependencia');
    await repositorio.registrarTurno({ actor: secretaria, tramiteDependenciaId: dependencia.id });
    await repositorio.registrarAcuse({
      actor: secretaria,
      tramiteDependenciaId: dependencia.id,
      selloFolio: 'SEL-FASE-3'
    });
    await repositorio.registrarRecepcion({ actor: bomberos, tramiteDependenciaId: dependencia.id });
    await repositorio.dictaminar({
      actor: bomberos,
      tramiteDependenciaId: dependencia.id,
      dictamen: 'observaciones',
      motivo: 'Falta una foto del local'
    });

    const archivo = { name: 'foto.pdf', type: 'application/pdf', size: 1024 } as unknown as File;
    const subida = await repositorio.subirArchivo({ tramiteId: creado.id, archivo, tipo: 'evidencia' });
    await repositorio.agregarEvidencia({
      actor: ciudadana,
      tramiteDependenciaId: dependencia.id,
      tipo: 'evidencia',
      nombreArchivo: subida.nombreArchivo,
      mime: subida.mime,
      sizeBytes: subida.sizeBytes,
      storagePath: subida.storagePath,
      contenidoBase64: subida.contenidoBase64
    });

    const final = await repositorio.obtenerTramite(creado.id);
    expect(final?.dependencias[0]?.estado).toBe('en_inspeccion');
    expect(final?.estado_general).toBe('verificacion');
    expect(final?.documentos.some((item) => item.tipo === 'evidencia')).toBe(true);
    expect((await repositorio.listarHistorial(creado.id)).some((item) => item.accion === 'evidencia_entregada')).toBe(true);
  });
});
