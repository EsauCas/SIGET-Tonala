'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Cargando, ErrorVista, Vacio, fechaLegible } from '@/components/EstadosVista';
import { useRepository } from '@/components/RepositoryProvider';
import { useRelojDemo } from '@/components/useRelojDemo';
import { VistaCorreo } from '@/components/VistaCorreo';
import { CONFIGURACION_PREDETERMINADA, calcularSla } from '@/lib/domain/sla';
import type {
  ConfiguracionSla,
  Dependencia,
  HistorialEvento,
  Notificacion,
  OficioTurnado,
  Profile,
  Rol,
  TramiteConDetalle
} from '@/types/database';

interface DatosHistorial {
  tramites: TramiteConDetalle[];
  eventos: Record<string, HistorialEvento[]>;
  oficios: OficioTurnado[];
  notificaciones: Notificacion[];
  dependencias: Dependencia[];
  configuracion: ConfiguracionSla[];
  personas: Profile[];
}

const ROLES: Readonly<Record<Rol, string>> = {
  ciudadano: 'Ciudadanía',
  secretaria: 'Ventanilla',
  bomberos: 'Bomberos',
  proteccion_civil: 'Protección Civil',
  admin: 'Administración'
};

const ACCIONES: Readonly<Record<string, string>> = {
  tramite_creado: 'Solicitud registrada',
  turnado_registrado: 'Oficio turnado',
  acuse_registrado: 'Acuse con sello registrado',
  recepcion_registrada: 'Recepción confirmada',
  dictamen_registrado: 'Dictamen emitido',
  evidencia_entregada: 'Documento entregado',
  cambio_estado_dependencia: 'Cambio de estado',
  acuse_lote_ocr_registrado: 'Acuse de lote confirmado',
  acuse_ocr_confirmado: 'Acuse con lectura automática'
};

const CLASE_CONTROL =
  'mt-2 min-h-control w-full rounded-control border-2 border-slate-400 bg-white px-4 py-3 text-lg';

function dia(iso: string): string {
  return iso.slice(0, 10);
}

/** Bitácora inmutable del expediente: eventos, sellos, plazos y correos. */
export function HistorialGlobal() {
  const { repositorio, listo } = useRepository();
  const { actor } = useAuth();
  const ahora = useRelojDemo();
  const [datos, setDatos] = useState<DatosHistorial | null>(null);
  const [tramiteId, setTramiteId] = useState('');
  const [dependenciaId, setDependenciaId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    if (!repositorio || !listo) return;
    setCargando(true);
    try {
      const tramites = await repositorio.listarTramites(actor ? { actor } : undefined);
      const historiales = await Promise.all(
        tramites.map(async (tramite) => ({
          id: tramite.id,
          eventos: await repositorio.listarHistorial(tramite.id)
        }))
      );
      const [oficios, notificaciones, dependencias, configuracion, personas] = await Promise.all([
        repositorio.listarOficios(),
        repositorio.listarNotificaciones(),
        repositorio.listarDependencias(),
        repositorio.listarConfiguracionSla(),
        repositorio.listarUsuarios().catch(() => [] as Profile[])
      ]);
      setDatos({
        tramites,
        eventos: Object.fromEntries(historiales.map((item) => [item.id, item.eventos])),
        oficios,
        notificaciones,
        dependencias,
        configuracion,
        personas
      });
      setError('');
    } catch (error) {
      setDatos(null);
      setError(error instanceof Error ? error.message : 'No se pudo cargar el historial.');
    } finally {
      setCargando(false);
    }
  }, [actor, listo, repositorio]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const visibles = useMemo(() => {
    if (!datos) return [];
    return datos.tramites
      .filter((tramite) => !tramiteId || tramite.id === tramiteId)
      .filter(
        (tramite) => !dependenciaId || tramite.dependencias.some((item) => item.dependencia_id === dependenciaId)
      );
  }, [datos, dependenciaId, tramiteId]);

  const idsVisibles = useMemo(() => new Set(visibles.map((tramite) => tramite.id)), [visibles]);

  const eventos = useMemo(() => {
    if (!datos) return [];
    return visibles
      .flatMap((tramite) => (datos.eventos[tramite.id] ?? []).map((evento) => ({ ...evento, folio: tramite.folio })))
      .filter((evento) => !desde || dia(evento.created_at) >= desde)
      .filter((evento) => !hasta || dia(evento.created_at) <= hasta)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [datos, desde, hasta, visibles]);

  const correos = useMemo(() => {
    if (!datos) return [];
    return datos.notificaciones
      .filter((item) => idsVisibles.has(item.tramite_id))
      .filter((item) => !desde || dia(item.created_at) >= desde)
      .filter((item) => !hasta || dia(item.created_at) <= hasta)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [datos, desde, hasta, idsVisibles]);

  const sellos = useMemo(() => {
    if (!datos) return [];
    const oficiosIds = new Set(
      visibles.flatMap((tramite) =>
        tramite.dependencias.map((item) => item.oficio_id).filter((id): id is string => Boolean(id))
      )
    );
    return datos.oficios.filter((oficio) => oficiosIds.has(oficio.id));
  }, [datos, visibles]);

  function nombreDependencia(id: string): string {
    return datos?.dependencias.find((item) => item.id === id)?.nombre ?? id;
  }

  function nombrePersona(id: string): string {
    return datos?.personas.find((item) => item.id === id)?.nombre ?? id;
  }

  if (cargando) return <main className="mx-auto w-full max-w-6xl px-5 py-10"><Cargando mensaje="Leyendo la bitácora..." /></main>;
  if (error) return <main className="mx-auto w-full max-w-6xl px-5 py-10"><ErrorVista mensaje={error} onReintentar={() => void cargar()} /></main>;
  if (!datos) return null;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <h1 className="text-3xl font-bold text-tinta">Historial de trámites</h1>
      <p className="mt-2 text-lg leading-relaxed text-tinta">
        Aquí se ve quién hizo qué y cuándo. Estos registros no se pueden borrar ni cambiar.
        Si eres ciudadanía, sólo aparece tu expediente.
      </p>

      <section aria-labelledby="filtros-historial" className="mt-6 rounded-control border-2 border-slate-300 bg-white p-5">
        <h2 id="filtros-historial" className="text-2xl font-bold text-tinta">Buscar en la bitácora</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-lg font-semibold text-tinta" htmlFor="filtrar-tramite">Expediente</label>
            <select id="filtrar-tramite" className={CLASE_CONTROL} value={tramiteId} onChange={(e) => setTramiteId(e.target.value)}>
              <option value="">Todos mis expedientes visibles</option>
              {datos.tramites.map((tramite) => (
                <option key={tramite.id} value={tramite.id}>{tramite.folio}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-lg font-semibold text-tinta" htmlFor="filtrar-dependencia">Dependencia</label>
            <select id="filtrar-dependencia" className={CLASE_CONTROL} value={dependenciaId} onChange={(e) => setDependenciaId(e.target.value)}>
              <option value="">Todas</option>
              {datos.dependencias.map((dependencia) => (
                <option key={dependencia.id} value={dependencia.id}>{dependencia.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-lg font-semibold text-tinta" htmlFor="filtrar-desde">Desde</label>
            <input id="filtrar-desde" type="date" className={CLASE_CONTROL} value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <label className="block text-lg font-semibold text-tinta" htmlFor="filtrar-hasta">Hasta</label>
            <input id="filtrar-hasta" type="date" className={CLASE_CONTROL} value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>
        <p aria-live="polite" className="mt-4 text-lg font-semibold text-tinta">
          {visibles.length} expediente(s) · {eventos.length} evento(s) · {correos.length} correo(s)
        </p>
      </section>

      {visibles.length === 0 ? (
        <div className="mt-6"><Vacio titulo="No hay expedientes" mensaje="No hay expedientes que coincidan con los filtros." /></div>
      ) : (
        <>
          <section aria-labelledby="bitacora" className="mt-6">
            <h2 id="bitacora" className="text-2xl font-bold text-tinta">Bitácora cronológica</h2>
            {eventos.length === 0 ? (
              <div className="mt-3"><Vacio titulo="Sin eventos en el rango" mensaje="Prueba con otro rango de fechas." /></div>
            ) : (
              <ol className="mt-4 grid gap-3">
                {eventos.map((evento) => (
                  <li key={evento.id} className="rounded-control border-2 border-slate-300 bg-white p-4">
                    <p className="text-lg font-bold text-tinta">{ACCIONES[evento.accion] ?? evento.accion}</p>
                    <p className="mt-1 text-lg text-tinta">
                      Folio {evento.folio} · {fechaLegible(evento.created_at)}
                    </p>
                    <p className="mt-1 text-lg text-tinta">
                      Actor: {nombrePersona(evento.actor_id)} · {ROLES[evento.actor_rol]}
                    </p>
                    {(evento.datos_antes || evento.datos_despues) && (
                      <details className="mt-2">
                        <summary className="min-h-tactil text-lg font-semibold text-enfasis">Ver cambios antes y después</summary>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div>
                            <p className="text-base font-bold text-tinta">Antes</p>
                            <pre className="mt-1 whitespace-pre-wrap break-all rounded-control bg-lienzo p-3 text-base text-tinta">
                              {evento.datos_antes ?? 'No había datos anteriores.'}
                            </pre>
                          </div>
                          <div>
                            <p className="text-base font-bold text-tinta">Después</p>
                            <pre className="mt-1 whitespace-pre-wrap break-all rounded-control bg-lienzo p-3 text-base text-tinta">
                              {evento.datos_despues ?? 'Sin cambios registrados.'}
                            </pre>
                          </div>
                        </div>
                      </details>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="tiempos" className="mt-8 rounded-control border-2 border-slate-300 bg-white p-5">
            <h2 id="tiempos" className="text-2xl font-bold text-tinta">Tiempos de respuesta por dependencia</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[42rem] border-collapse text-left text-lg text-tinta">
                <caption className="pb-2 text-left text-base text-tinta">
                  Reloj de entrega (turnado a acuse) y de dictamen, con las horas configuradas.
                </caption>
                <thead>
                  <tr className="border-b-2 border-slate-400">
                    <th scope="col" className="py-2 pr-3">Expediente</th>
                    <th scope="col" className="py-2 pr-3">Dependencia</th>
                    <th scope="col" className="py-2 pr-3">Entrega</th>
                    <th scope="col" className="py-2 pr-3">Dictamen</th>
                    <th scope="col" className="py-2">Situación</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.flatMap((tramite) =>
                    tramite.dependencias.map((renglon) => {
                      const configuracion = datos.configuracion.find((item) => item.dependencia_id === renglon.dependencia_id);
                      const reloj = calcularSla(
                        {
                          turnado_at: renglon.turnado_at,
                          acuse_at: renglon.acuse_at,
                          dictamen_at: renglon.dictamen_at,
                          pausado_desde: renglon.pausado_desde,
                          horas_pausadas: renglon.horas_pausadas
                        },
                        configuracion ?? CONFIGURACION_PREDETERMINADA,
                        ahora
                      );
                      const situacion =
                        reloj.dictamen.pausado
                          ? 'En espera de la ciudadanía'
                          : reloj.dictamen.categoria === 'vencido'
                            ? 'Vencido'
                            : reloj.dictamen.categoria === 'por_vencer'
                              ? 'Por vencer'
                              : 'En tiempo';
                      return (
                        <tr key={renglon.id} className="border-b border-slate-300">
                          <td className="py-2 pr-3">{tramite.folio}</td>
                          <td className="py-2 pr-3">{nombreDependencia(renglon.dependencia_id)}</td>
                          <td className="py-2 pr-3">
                            {reloj.entrega.iniciado
                              ? `${Math.round(reloj.entrega.transcurrido_horas)} h${reloj.entrega.detenido_en ? ' (detenido)' : ''}`
                              : 'Sin turnar'}
                          </td>
                          <td className="py-2 pr-3">
                            {reloj.dictamen.iniciado ? `${Math.round(reloj.dictamen.transcurrido_horas)} h de ${reloj.dictamen.limite_horas} h` : 'Sin turnar'}
                          </td>
                          <td className="py-2">{situacion}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="sellos" className="mt-8 rounded-control border-2 border-slate-300 bg-white p-5">
            <h2 id="sellos" className="text-2xl font-bold text-tinta">Sellos digitalizados</h2>
            {sellos.length === 0 ? (
              <p className="mt-2 text-lg text-tinta">No hay sellos registrados en el rango seleccionado.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {sellos.map((oficio) => (
                  <li key={oficio.id} className="rounded-control border border-slate-300 p-3 text-lg text-tinta">
                    <strong>{oficio.numero_oficio}</strong> · {nombreDependencia(oficio.dependencia_destino)}
                    <span className="mt-1 block">
                      Folio del sello: {oficio.sello_folio ?? 'sin capturar'} ·{' '}
                      {oficio.sello_fecha ? fechaLegible(`${oficio.sello_fecha}T${oficio.sello_hora ?? '00:00'}`) : 'sin fecha'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="correos" className="mt-8 rounded-control border-2 border-slate-300 bg-white p-5">
            <h2 id="correos" className="text-2xl font-bold text-tinta">Correos registrados</h2>
            {correos.length === 0 ? (
              <p className="mt-2 text-lg text-tinta">No hay correos en el rango seleccionado.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {correos.map((correo) => (
                  <li key={correo.id} className="rounded-control border border-slate-300 p-3 text-lg text-tinta">
                    <strong>{correo.asunto}</strong> · {correo.estado} · {fechaLegible(correo.created_at)}
                    <span className="mt-1 block">Para: {correo.destinatario}</span>
                    {correo.enviado_a && correo.enviado_a !== correo.destinatario && (
                      <span className="mt-1 block">Enviado a: {correo.enviado_a} (destinatario original conservado)</span>
                    )}
                    <span className="mt-1 block">Intentos: {correo.intentos}</span>
                    {correo.error_motivo && <span className="mt-1 block">Motivo: {correo.error_motivo}</span>}
                    <VistaCorreo
                      asunto={correo.asunto}
                      html={correo.html ?? ''}
                      plantilla={correo.plantilla ?? undefined}
                      compacto
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
