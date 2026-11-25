'use client';

import { ClipboardList, Mail, Stamp, Timer } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Cargando, ErrorVista, fechaLegible } from '@/components/EstadosVista';
import { PageShell } from '@/components/layout/PageShell';
import { SeccionCard } from '@/components/layout/SeccionCard';
import { MensajeVacio } from '@/components/layout/MensajeVacio';
import { CLASE_CAMPO, CLASE_ETIQUETA } from '@/components/layout/estilos';
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
  turnado_registrado: 'Enviado a revisión',
  acuse_registrado: 'Constancia de recibido registrada',
  recepcion_registrada: 'Recibimos los documentos',
  dictamen_registrado: 'Resultado de la revisión registrado',
  evidencia_entregada: 'Documento entregado',
  cambio_estado_dependencia: 'Cambio de estado',
  acuse_lote_ocr_registrado: 'Constancia de lote confirmada',
  acuse_ocr_confirmado: 'Constancia con lectura automática'
};

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

  if (cargando) {
    return (
      <PageShell titulo="Preparando el historial" descripcion="Estamos reuniendo los registros de tus trámites.">
        <Cargando mensaje="Leyendo la bitácora..." />
      </PageShell>
    );
  }
  if (error) {
    return (
      <PageShell titulo="No pudimos cargar el historial" descripcion="Tus registros siguen guardados. Inténtalo otra vez.">
        <ErrorVista mensaje={error} onReintentar={() => void cargar()} />
      </PageShell>
    );
  }
  if (!datos) return null;

  return (
    <PageShell
      titulo="Historial de trámites"
      descripcion="¿Qué puedo hacer aquí? Consulta quién hizo qué y cuándo. Estos registros no se pueden borrar ni cambiar. Si eres ciudadanía, sólo aparece tu expediente."
    >
      <SeccionCard
        numero={1}
        titulo="Buscar en el historial"
        descripcion="Elige un expediente o un rango de fechas para ver sólo lo que te interesa."
        tono="ocre"
        icono={<ClipboardList aria-hidden="true" className="h-7 w-7" />}
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={CLASE_ETIQUETA} htmlFor="filtrar-tramite">Expediente</label>
            <select id="filtrar-tramite" className={CLASE_CAMPO} value={tramiteId} onChange={(e) => setTramiteId(e.target.value)}>
              <option value="">Todos mis expedientes visibles</option>
              {datos.tramites.map((tramite) => (
                <option key={tramite.id} value={tramite.id}>{tramite.folio}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={CLASE_ETIQUETA} htmlFor="filtrar-dependencia">Dependencia</label>
            <select id="filtrar-dependencia" className={CLASE_CAMPO} value={dependenciaId} onChange={(e) => setDependenciaId(e.target.value)}>
              <option value="">Todas</option>
              {datos.dependencias.map((dependencia) => (
                <option key={dependencia.id} value={dependencia.id}>{dependencia.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={CLASE_ETIQUETA} htmlFor="filtrar-desde">Desde</label>
            <input id="filtrar-desde" type="date" className={CLASE_CAMPO} value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <label className={CLASE_ETIQUETA} htmlFor="filtrar-hasta">Hasta</label>
            <input id="filtrar-hasta" type="date" className={CLASE_CAMPO} value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>
        <p aria-live="polite" className="mt-5 rounded-control border-l-8 border-barro bg-papel px-4 py-3 text-lg font-bold text-tinta">
          {visibles.length} expediente(s) · {eventos.length} movimiento(s) · {correos.length} correo(s)
        </p>
      </SeccionCard>

      {visibles.length === 0 ? (
        <MensajeVacio
          titulo="No hay expedientes con esos filtros"
          descripcion="Prueba con otro expediente o amplía el rango de fechas."
          accion={
            <button
              type="button"
              className="min-h-control rounded-control border-2 border-barro bg-superficie px-5 py-3 text-lg font-bold text-barro"
              onClick={() => {
                setTramiteId('');
                setDependenciaId('');
                setDesde('');
                setHasta('');
              }}
            >
              Quitar filtros
            </button>
          }
        />
      ) : (
        <>
          <SeccionCard
            numero={2}
            titulo="Lo que pasó, en orden"
            descripcion="Del movimiento más reciente al más antiguo. Cada registro incluye fecha y quién lo hizo."
            icono={<ClipboardList aria-hidden="true" className="h-7 w-7" />}
          >
            {eventos.length === 0 ? (
              <MensajeVacio
                titulo="Sin movimientos en este rango"
                descripcion="Prueba con otras fechas o quita los filtros para ver todo el historial."
              />
            ) : (
              <ol className="grid gap-4 border-l-8 border-arena pl-5">
                {eventos.map((evento) => (
                  <li key={evento.id} className="relative rounded-control border-2 border-arena bg-superficie p-5">
                    <span aria-hidden="true" className="absolute -left-[1.85rem] top-5 h-4 w-4 rounded-full border-2 border-cafe bg-ocre" />
                    <p className="text-xl font-bold text-cafe">{ACCIONES[evento.accion] ?? evento.accion}</p>
                    <p className="mt-2 text-lg font-semibold text-tinta">
                      Folio {evento.folio} · {fechaLegible(evento.created_at)}
                    </p>
                    <p className="mt-1 text-lg text-tinta">
                      Lo hizo {nombrePersona(evento.actor_id)} · {ROLES[evento.actor_rol]}
                    </p>
                    {(evento.datos_antes || evento.datos_despues) && (
                      <details className="mt-3">
                        <summary className="min-h-tactil text-lg font-bold text-barro underline decoration-2 underline-offset-4">
                          Ver cambios antes y después
                        </summary>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-lg font-bold text-tinta">Antes</p>
                            <pre className="mt-2 whitespace-pre-wrap break-all rounded-control border-2 border-arena bg-papel p-3 text-base leading-relaxed text-tinta">
                              {evento.datos_antes ?? 'No había datos anteriores.'}
                            </pre>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-tinta">Después</p>
                            <pre className="mt-2 whitespace-pre-wrap break-all rounded-control border-2 border-arena bg-papel p-3 text-base leading-relaxed text-tinta">
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
          </SeccionCard>

          <SeccionCard
            numero={3}
            titulo="Tiempo de respuesta por dependencia"
            descripcion="Cuánto tardó cada dependencia en recibir los documentos y en dar su resultado."
            tono="ocre"
            icono={<Timer aria-hidden="true" className="h-7 w-7" />}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] border-collapse text-left text-lg text-tinta">
                <caption className="pb-3 text-left text-base leading-relaxed text-tinta">
                  El conteo de entrega se detiene cuando se registra la constancia de recibido.
                </caption>
                <thead>
                  <tr className="border-b-4 border-arena">
                    <th scope="col" className="py-3 pr-3">Expediente</th>
                    <th scope="col" className="py-3 pr-3">Dependencia</th>
                    <th scope="col" className="py-3 pr-3">Entrega</th>
                    <th scope="col" className="py-3 pr-3">Resultado</th>
                    <th scope="col" className="py-3">Situación</th>
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
                          ? 'En espera de tu documento'
                          : reloj.dictamen.categoria === 'vencido'
                            ? 'Vencido'
                            : reloj.dictamen.categoria === 'por_vencer'
                              ? 'Por vencer'
                              : 'En tiempo';
                      return (
                        <tr key={renglon.id} className="border-b-2 border-arena">
                          <td className="py-2 pr-3">{tramite.folio}</td>
                          <td className="py-2 pr-3">{nombreDependencia(renglon.dependencia_id)}</td>
                          <td className="py-3 pr-3">
                            {reloj.entrega.iniciado
                              ? `${Math.round(reloj.entrega.transcurrido_horas)} h${reloj.entrega.detenido_en ? ' (detenido)' : ''}`
                              : 'Aún no se envía'}
                          </td>
                          <td className="py-3 pr-3">
                            {reloj.dictamen.iniciado
                              ? `${Math.round(reloj.dictamen.transcurrido_horas)} h de ${reloj.dictamen.limite_horas} h`
                              : 'Aún no se envía'}
                          </td>
                          <td className="py-3 font-bold">{situacion}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </SeccionCard>

          <SeccionCard
            numero={4}
            titulo="Constancias de recibido registradas"
            descripcion="Sellos capturados por ventanilla. Sirven para detener el tiempo de entrega."
            icono={<Stamp aria-hidden="true" className="h-7 w-7" />}
          >
            {sellos.length === 0 ? (
              <MensajeVacio
                titulo="No hay constancias en este rango"
                descripcion="Cuando ventanilla registre una constancia de recibido, aparecerá aquí."
              />
            ) : (
              <ul className="grid gap-3">
                {sellos.map((oficio) => (
                  <li key={oficio.id} className="rounded-control border-2 border-arena bg-papel p-4 text-lg leading-relaxed text-tinta">
                    <strong className="text-xl text-cafe">{oficio.numero_oficio}</strong> · {nombreDependencia(oficio.dependencia_destino)}
                    <span className="mt-2 block">
                      Folio de la constancia: {oficio.sello_folio ?? 'sin capturar'} ·{' '}
                      {oficio.sello_fecha ? fechaLegible(`${oficio.sello_fecha}T${oficio.sello_hora ?? '00:00'}`) : 'sin fecha'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SeccionCard>

          <SeccionCard
            numero={5}
            titulo="Correos de la demostración"
            descripcion="Avisos simulados: no salen de esta computadora. Aquí ves su estado y motivo."
            tono="ocre"
            icono={<Mail aria-hidden="true" className="h-7 w-7" />}
          >
            {correos.length === 0 ? (
              <MensajeVacio
                titulo="No hay correos en este rango"
                descripcion="Cambia las fechas o consulta otro expediente para ver los avisos registrados."
              />
            ) : (
              <ul className="grid gap-3">
                {correos.map((correo) => (
                  <li key={correo.id} className="rounded-control border-2 border-arena bg-papel p-4 text-lg leading-relaxed text-tinta">
                    <strong className="text-xl text-cafe">{correo.asunto}</strong> · {correo.estado} · {fechaLegible(correo.created_at)}
                    <span className="mt-2 block">Para: {correo.destinatario}</span>
                    {correo.enviado_a && correo.enviado_a !== correo.destinatario && (
                      <span className="mt-2 block">Enviado a: {correo.enviado_a} (destinatario original conservado)</span>
                    )}
                    <span className="mt-2 block">Intentos: {correo.intentos}</span>
                    {correo.error_motivo && <span className="mt-2 block">Motivo: {correo.error_motivo}</span>}
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
          </SeccionCard>
        </>
      )}
    </PageShell>
  );
}
