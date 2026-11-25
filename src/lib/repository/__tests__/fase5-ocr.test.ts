import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canTransition, puedeConfirmarAcuseOcr } from '@/lib/domain/estado-tramite';
import { DemoRepository } from '@/lib/repository/demo-repository';
import { IDS_DEMO } from '@/lib/repository/demo-seed';
import type { Actor } from '@/lib/repository/types';
import type { OficioTurnado, Profile } from '@/types/database';

/** Los folios y sellos de este archivo son SINTÉTICOS (Fase 5). */

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

function instalarLocalStorage(): void {
  vi.stubGlobal('window', { localStorage: new LocalStorageMemoria() });
}

async function actor(repositorio: DemoRepository, id: string): Promise<Actor> {
  const perfiles = await repositorio.listarPerfiles();
  const perfil = perfiles.find((item: Profile) => item.id === id);
  if (!perfil) throw new Error('Perfil de prueba no encontrado');
  return { id: perfil.id, rol: perfil.rol, dependencia_id: perfil.dependencia_id };
}

interface Escenario {
  repositorio: DemoRepository;
  ciudadana: Actor;
  secretaria: Actor;
  bomberos: Actor;
  tramiteId: string;
  oficio: OficioTurnado;
}

async function escenarioTurnado(dependencias: readonly ('bomberos' | 'proteccion_civil')[]): Promise<Escenario> {
  instalarLocalStorage();
  const repositorio = new DemoRepository();
  const ciudadana = await actor(repositorio, IDS_DEMO.ciudadana);
  const secretaria = await actor(repositorio, IDS_DEMO.secretaria);
  const bomberos = await actor(repositorio, IDS_DEMO.bomberos);

  const creado = await repositorio.crearTramite({
    actor: ciudadana,
    tipo_tramite: 'Licencia de funcionamiento',
    giro_principal: 'Panadería sintética',
    giros_anexos: [],
    domicilio_negocio: 'Calle Sintética 5',
    colonia: 'Centro',
    cp: '45400',
    superficie_m2: 40,
    inversion_estimada: 2000,
    nombre_contribuyente: 'Persona sintética',
    telefono: '3331000000',
    dependenciasRequeridas: [...dependencias]
  });
  const detalle = await repositorio.obtenerTramite(creado.id);
  const ids = (detalle?.dependencias ?? []).map((item) => item.id);
  const oficiosAntes = await repositorio.listarOficios();

  await repositorio.turnarTramite({ actor: secretaria, tramiteDependenciaIds: ids });

  const oficiosDespues = await repositorio.listarOficios();
  const oficio = oficiosDespues.find(
    (item) => !oficiosAntes.some((anterior) => anterior.id === item.id)
  );
  if (!oficio) throw new Error('No se creó el oficio de prueba');

  return { repositorio, ciudadana, secretaria, bomberos, tramiteId: creado.id, oficio };
}

describe('regla aditiva de confirmación de acuse OCR', () => {
  it('no relaja la transición manual, pero permite la confirmación humana de ventanilla', () => {
    expect(canTransition('secretaria', 'turnado', 'en_inspeccion')).toBe(false);
    expect(puedeConfirmarAcuseOcr('secretaria', 'turnado', 'en_inspeccion')).toBe(true);
    expect(puedeConfirmarAcuseOcr('bomberos', 'turnado', 'en_inspeccion')).toBe(false);
    expect(puedeConfirmarAcuseOcr('secretaria', 'aprobado', 'en_inspeccion')).toBe(false);
  });
});

describe('Parser B · confirmación del acuse individual (datos sintéticos)', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('detiene el reloj de entrega, pasa a inspección y no duplica el evento al repetir', async () => {
    const escenario = await escenarioTurnado(['bomberos']);
    const entrada = {
      actor: escenario.secretaria,
      numero_oficio: escenario.oficio.numero_oficio,
      selloFolio: '7045',
      selloFecha: '2026-03-12',
      selloHora: '10:35'
    };

    const primera = await escenario.repositorio.registrarAcuseOficio(entrada);
    expect(primera.tramitesActualizados).toBe(1);

    const detalle = await escenario.repositorio.obtenerTramite(escenario.tramiteId);
    const fila = detalle?.dependencias[0];
    expect(fila?.estado).toBe('en_inspeccion');
    expect(fila?.acuse_at).not.toBeNull();
    expect(detalle?.estado_general).toBe('verificacion');

    const segunda = await escenario.repositorio.registrarAcuseOficio(entrada);
    expect(segunda.tramitesActualizados).toBe(0);
    expect(segunda.aviso).toContain('No se duplicó');

    const eventos = (await escenario.repositorio.listarHistorial(escenario.tramiteId)).filter(
      (item) => item.accion === 'acuse_ocr_registrado'
    );
    expect(eventos).toHaveLength(1);
  });

  it('rechaza la confirmación de un perfil que no es ventanilla', async () => {
    const escenario = await escenarioTurnado(['bomberos']);

    await expect(
      escenario.repositorio.registrarAcuseOficio({
        actor: escenario.bomberos,
        numero_oficio: escenario.oficio.numero_oficio,
        selloFolio: '7045'
      })
    ).rejects.toThrow('Solo la ventanilla');
  });
});

describe('Parser C · acuse en lote idempotente (datos sintéticos)', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('cierra todas las dependencias del trámite, reporta folios ausentes y no duplica al reprocesar', async () => {
    const escenario = await escenarioTurnado(['bomberos', 'proteccion_civil']);
    const creado = await escenario.repositorio.obtenerTramite(escenario.tramiteId);
    if (!creado) throw new Error('Trámite de prueba no encontrado');

    const entrada = {
      actor: escenario.secretaria,
      numero_oficio: escenario.oficio.numero_oficio,
      acuseFolio: '9012-A',
      solicitudes: [
        {
          numero_control: creado.numero_control,
          folio: creado.folio,
          giros: ['Panadería sintética', 'Repostería sintética']
        },
        { numero_control: 'CTRL-9999-9999', folio: '9999-Z', giros: [] }
      ]
    };

    const primera = await escenario.repositorio.registrarAcuseLote(entrada);
    expect(primera.reprocessado).toBe(false);
    expect(primera.tramitesActualizados).toBe(2);
    expect(primera.foliosNoEncontrados).toEqual(['9999-Z']);
    expect(primera.notificaciones).toBe(1);

    const detalle = await escenario.repositorio.obtenerTramite(escenario.tramiteId);
    expect(detalle?.dependencias.map((item) => item.estado)).toEqual([
      'en_inspeccion',
      'en_inspeccion'
    ]);
    expect(detalle?.giros_anexos).toContain('Repostería sintética');

    const eventosAntes = await escenario.repositorio.listarHistorial(escenario.tramiteId);
    const notificacionesAntes = await escenario.repositorio.listarNotificaciones();

    const segunda = await escenario.repositorio.registrarAcuseLote(entrada);
    expect(segunda.reprocessado).toBe(true);
    expect(segunda.tramitesActualizados).toBe(0);
    expect(segunda.foliosNoEncontrados).toEqual(['9999-Z']);

    expect(await escenario.repositorio.listarHistorial(escenario.tramiteId)).toHaveLength(
      eventosAntes.length
    );
    expect(await escenario.repositorio.listarNotificaciones()).toHaveLength(
      notificacionesAntes.length
    );
  });

  it('rechaza un folio de acuse vacío y un perfil no autorizado', async () => {
    const escenario = await escenarioTurnado(['bomberos']);

    await expect(
      escenario.repositorio.registrarAcuseLote({
        actor: escenario.secretaria,
        numero_oficio: escenario.oficio.numero_oficio,
        acuseFolio: '   ',
        solicitudes: []
      })
    ).rejects.toThrow('Confirma el folio del acuse');

    await expect(
      escenario.repositorio.registrarAcuseLote({
        actor: escenario.ciudadana,
        numero_oficio: escenario.oficio.numero_oficio,
        acuseFolio: '9012-A',
        solicitudes: []
      })
    ).rejects.toThrow('Solo la ventanilla');
  });
});
