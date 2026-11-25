import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveEstadoGeneral } from '@/lib/domain/estado-tramite';
import { calcularSla, CONFIGURACION_PREDETERMINADA } from '@/lib/domain/sla';
import { claveRecordatorio, numeroOficio, resumenUrgencia } from '@/lib/gestion';
import { DemoRepository } from '@/lib/repository/demo-repository';
import { IDS_DEMO } from '@/lib/repository/demo-seed';
import type { Actor } from '@/lib/repository/types';
import type { Profile, TramiteDependencia } from '@/types/database';

class LocalStorageMemoria {
  private readonly datos = new Map<string, string>();
  getItem(clave: string): string | null { return this.datos.get(clave) ?? null; }
  setItem(clave: string, valor: string): void { void this.datos.set(clave, valor); }
  removeItem(clave: string): void { void this.datos.delete(clave); }
}

function instalarLocalStorage(): DemoRepository {
  const memoria = new LocalStorageMemoria();
  vi.stubGlobal('window', { localStorage: memoria });
  return new DemoRepository();
}

async function actor(repositorio: DemoRepository, id: string): Promise<Actor> {
  const perfiles = await repositorio.listarPerfiles();
  const perfil = perfiles.find((item: Profile) => item.id === id);
  if (!perfil) throw new Error('Perfil de prueba no encontrado');
  return { id: perfil.id, rol: perfil.rol, dependencia_id: perfil.dependencia_id };
}

async function crearDosDependencias(repositorio: DemoRepository): Promise<string> {
  const ciudadana = await actor(repositorio, IDS_DEMO.ciudadana);
  const tramite = await repositorio.crearTramite({
    actor: ciudadana,
    tipo_tramite: 'Licencia de funcionamiento',
    giro_principal: 'Panadería de prueba',
    giros_anexos: [],
    domicilio_negocio: 'Calle Prueba 4',
    colonia: 'Centro',
    cp: '45400',
    superficie_m2: 40,
    inversion_estimada: 2000,
    nombre_contribuyente: 'Persona de prueba',
    telefono: '3331000000',
    dependenciasRequeridas: ['bomberos', 'proteccion_civil']
  });
  return tramite.id;
}

async function preparar(
  repositorio: DemoRepository,
  tramiteId: string,
  secretaria: Actor,
  bomberos: Actor,
  pc: Actor
): Promise<{ bomberosFila: TramiteDependencia; pcFila: TramiteDependencia }> {
  const detalle = await repositorio.obtenerTramite(tramiteId);
  if (!detalle) throw new Error('Trámite no encontrado');
  await repositorio.turnarTramite({
    actor: secretaria,
    tramiteDependenciaIds: detalle.dependencias.map((item) => item.id)
  });
  const actualizado = await repositorio.obtenerTramite(tramiteId);
  if (!actualizado) throw new Error('Trámite no encontrado');

  const bomberosFila = actualizado.dependencias.find((item) => item.dependencia_id === bomberos.dependencia_id);
  const pcFila = actualizado.dependencias.find((item) => item.dependencia_id === pc.dependencia_id);
  if (!bomberosFila || !pcFila) throw new Error('Dependencias no encontradas');

  await repositorio.registrarRecepcion({ actor: bomberos, tramiteDependenciaId: bomberosFila.id });
  await repositorio.registrarRecepcion({ actor: pc, tramiteDependenciaId: pcFila.id });
  return { bomberosFila, pcFila };
}

describe('Fase 4 · flujos de gestión', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('turna a dos dependencias con el mismo oficio consecutivo', async () => {
    const repositorio = instalarLocalStorage();
    const tramiteId = await crearDosDependencias(repositorio);
    const secretaria = await actor(repositorio, IDS_DEMO.secretaria);
    const detalle = await repositorio.obtenerTramite(tramiteId);
    if (!detalle) throw new Error('Trámite no encontrado');

    const turnados = await repositorio.turnarTramite({
      actor: secretaria,
      tramiteDependenciaIds: detalle.dependencias.map((item) => item.id)
    });

    expect(turnados).toHaveLength(2);
    expect(turnados.every((item) => item.estado === 'turnado' && item.turnado_at !== null)).toBe(true);
    const oficios = await repositorio.listarOficios();
    const recientes = oficios.filter((item) => item.numero_oficio.startsWith('DPL/VF/'));
    expect(recientes).toHaveLength(2);
    expect(new Set(recientes.map((item) => item.numero_oficio))).toEqual(new Set([numeroOficio(1)]));
  });

  it('una observaciones y otra aprobada mantiene el general en rojo; la corrección y doble aprobación lo ponen verde', async () => {
    const repositorio = instalarLocalStorage();
    const tramiteId = await crearDosDependencias(repositorio);
    const secretaria = await actor(repositorio, IDS_DEMO.secretaria);
    const bomberos = await actor(repositorio, IDS_DEMO.bomberos);
    const pc = await actor(repositorio, IDS_DEMO.proteccionCivil);
    const ciudadana = await actor(repositorio, IDS_DEMO.ciudadana);
    const { bomberosFila, pcFila } = await preparar(repositorio, tramiteId, secretaria, bomberos, pc);

    await repositorio.dictaminar({
      actor: bomberos,
      tramiteDependenciaId: bomberosFila.id,
      dictamen: 'observaciones',
      motivo: 'Falta limpiar el área de cocina.'
    });
    await repositorio.dictaminar({
      actor: pc,
      tramiteDependenciaId: pcFila.id,
      dictamen: 'aprobado',
      motivo: null,
      fechaVisita: '2026-11-24'
    });

    let detalle = await repositorio.obtenerTramite(tramiteId);
    let general = deriveEstadoGeneral(detalle?.dependencias ?? []);
    expect(general.etapa).toBe('observaciones');
    expect(general.color).toBe('rojo');

    await repositorio.agregarEvidencia({
      actor: ciudadana,
      tramiteDependenciaId: bomberosFila.id,
      tipo: 'evidencia',
      nombreArchivo: 'cocina.png',
      mime: 'image/png',
      sizeBytes: 1024,
      storagePath: 'demo/cocina.png'
    });
    detalle = await repositorio.obtenerTramite(tramiteId);
    const corregida = detalle?.dependencias.find((item) => item.id === bomberosFila.id);
    expect(corregida?.estado).toBe('en_inspeccion');
    expect(corregida?.pausado_desde).toBeNull();

    await repositorio.dictaminar({
      actor: bomberos,
      tramiteDependenciaId: bomberosFila.id,
      dictamen: 'aprobado',
      motivo: null
    });
    detalle = await repositorio.obtenerTramite(tramiteId);
    general = deriveEstadoGeneral(detalle?.dependencias ?? []);
    expect(general.color).toBe('verde');
    expect(detalle?.estado_general).toBe('aprobado');
  });

  it('bomberos no puede dictaminar sobre Protección Civil', async () => {
    const repositorio = instalarLocalStorage();
    const tramiteId = await crearDosDependencias(repositorio);
    const secretaria = await actor(repositorio, IDS_DEMO.secretaria);
    const bomberos = await actor(repositorio, IDS_DEMO.bomberos);
    const pc = await actor(repositorio, IDS_DEMO.proteccionCivil);
    const { pcFila } = await preparar(repositorio, tramiteId, secretaria, bomberos, pc);

    await expect(
      repositorio.dictaminar({
        actor: bomberos,
        tramiteDependenciaId: pcFila.id,
        dictamen: 'aprobado',
        motivo: null
      })
    ).rejects.toThrow(/dependencia/i);
  });

  it('un recordatorio repetido no duplica la notificación', async () => {
    const repositorio = instalarLocalStorage();
    const tramiteId = await crearDosDependencias(repositorio);
    const secretaria = await actor(repositorio, IDS_DEMO.secretaria);
    const bomberos = await actor(repositorio, IDS_DEMO.bomberos);
    const pc = await actor(repositorio, IDS_DEMO.proteccionCivil);
    const { bomberosFila } = await preparar(repositorio, tramiteId, secretaria, bomberos, pc);
    const clave = claveRecordatorio(bomberosFila.id, new Date());

    const cuerpo = {
      tramiteId,
      destinatario: 'bomberos.recordatorio@tonala.gob.mx',
      plantilla: 'recordatorio_sla',
      asunto: 'Recordatorio de revisión',
      cuerpo: 'La revisión lleva más tiempo del previsto.',
      claveIdempotencia: clave
    };
    await repositorio.registrarNotificacion(cuerpo);
    await repositorio.registrarNotificacion(cuerpo);
    const notificaciones = await repositorio.listarNotificaciones();
    expect(notificaciones.filter((item) => item.clave_idempotencia === clave)).toHaveLength(1);
  });

  it('el reloj de dictamen está en pausa durante observaciones y se reanuda al corregir', async () => {
    const repositorio = instalarLocalStorage();
    const tramiteId = await crearDosDependencias(repositorio);
    const secretaria = await actor(repositorio, IDS_DEMO.secretaria);
    const bomberos = await actor(repositorio, IDS_DEMO.bomberos);
    const pc = await actor(repositorio, IDS_DEMO.proteccionCivil);
    const ciudadana = await actor(repositorio, IDS_DEMO.ciudadana);
    const { bomberosFila } = await preparar(repositorio, tramiteId, secretaria, bomberos, pc);

    await repositorio.dictaminar({
      actor: bomberos,
      tramiteDependenciaId: bomberosFila.id,
      dictamen: 'observaciones',
      motivo: 'Se necesita el croquis del local.'
    });
    let detalle = await repositorio.obtenerTramite(tramiteId);
    let fila = detalle?.dependencias.find((item) => item.id === bomberosFila.id);
    expect(fila?.pausado_desde).not.toBeNull();
    const calculoPausado = calcularSla(
      fila as TramiteDependencia,
      CONFIGURACION_PREDETERMINADA,
      new Date(Date.now() + 10 * 60 * 60 * 1000)
    );
    expect(calculoPausado.dictamen.pausado).toBe(true);

    await repositorio.agregarEvidencia({
      actor: ciudadana,
      tramiteDependenciaId: bomberosFila.id,
      tipo: 'evidencia',
      nombreArchivo: 'croquis.pdf',
      mime: 'application/pdf',
      sizeBytes: 2048,
      storagePath: 'demo/croquis.pdf'
    });
    detalle = await repositorio.obtenerTramite(tramiteId);
    fila = detalle?.dependencias.find((item) => item.id === bomberosFila.id);
    expect(fila?.pausado_desde).toBeNull();
    const calculoActivo = calcularSla(fila as TramiteDependencia, CONFIGURACION_PREDETERMINADA);
    expect(calculoActivo.dictamen.pausado).toBe(false);
  });

  it('el resumen de urgencia crece con las horas y respeta la pausa', () => {
    const turnado = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString();
    const tramite = {
      dependencias: [{ turnado_at: turnado, pausado_desde: null, horas_pausadas: 0 }]
    } as Parameters<typeof resumenUrgencia>[0];
    expect(resumenUrgencia(tramite, []).categoria).toBe('por_vencer');
  });

  it('la visibilidad por actor oculta trámites no turnados a la dependencia', async () => {
    const repositorio = instalarLocalStorage();
    const bomberos = await actor(repositorio, IDS_DEMO.bomberos);
    const pc = await actor(repositorio, IDS_DEMO.proteccionCivil);
    const secretaria = await actor(repositorio, IDS_DEMO.secretaria);
    const ciudadana = await actor(repositorio, IDS_DEMO.ciudadana);

    const visiblesBomberos = await repositorio.listarTramites({ actor: bomberos });
    const visiblesPC = await repositorio.listarTramites({ actor: pc });
    const visiblesSecretaria = await repositorio.listarTramites({ actor: secretaria });
    const visiblesCiudadana = await repositorio.listarTramites({ actor: ciudadana });

    expect(visiblesCiudadana).toHaveLength(0);
    expect(visiblesSecretaria.length).toBeGreaterThan(visiblesBomberos.length);
    expect(visiblesBomberos.every((item) => item.dependencias.some((fila) => fila.dependencia_id === bomberos.dependencia_id && fila.turnado_at))).toBe(true);
    expect(visiblesPC.every((item) => item.dependencias.some((fila) => fila.dependencia_id === pc.dependencia_id && fila.turnado_at))).toBe(true);
  });
});
