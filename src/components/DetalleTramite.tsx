'use client';

import { AlertTriangle, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useCorreos } from '@/components/EmailLogToast';
import { Aviso, Cargando, ErrorVista, fechaLegible } from '@/components/EstadosVista';
import {
  BOTON_PRIMARIO,
  BOTON_SECUNDARIO,
  CLASE_CAMPO,
  CLASE_ETIQUETA,
  CLASE_ERROR
} from '@/components/layout/estilos';
import { SemaforoTramite } from '@/components/SemaforoTramite';
import { SubirEvidencia } from '@/components/SubirEvidencia';
import { useRepository } from '@/components/RepositoryProvider';
import { useRelojDemo } from '@/components/useRelojDemo';
import { CORREOS_EJEMPLO } from '@/lib/catalogos';
import { CONFIGURACION_PREDETERMINADA, calcularSla } from '@/lib/domain/sla';
import { renderizarCorreo } from '@/lib/email-templates';
import type { TramiteRepository } from '@/lib/repository/types';
import type {
  ClaveDependencia,
  ConfiguracionSla,
  Dependencia,
  Dictamen,
  HistorialEvento,
  TramiteConDetalle,
  TramiteDependencia
} from '@/types/database';

const ACCIONES: Readonly<Record<string, string>> = {
  tramite_creado: 'Se registró la solicitud',
  turnado_registrado: 'Se envió el oficio a revisión',
  acuse_registrado: 'Se registró la constancia de recibido',
  recepcion_registrada: 'La dependencia confirmó que recibió los documentos',
  dictamen_registrado: 'Se registró el resultado de la revisión',
  evidencia_entregada: 'La persona contribuyente entregó un documento',
  cambio_estado_dependencia: 'Cambió el estado de una revisión'
};

const FRANJAS: Readonly<Record<string, string>> = {
  pendiente: 'border-l-semaforo-gris bg-semaforo-fondo-gris',
  turnado: 'border-l-semaforo-azul bg-semaforo-fondo-azul',
  en_inspeccion: 'border-l-semaforo-ambar bg-semaforo-fondo-ambar',
  observaciones: 'border-l-semaforo-rojo bg-semaforo-fondo-rojo',
  aprobado: 'border-l-semaforo-verde bg-semaforo-fondo-verde',
  rechazado: 'border-l-semaforo-rojo bg-semaforo-fondo-rojo'
};

const BASE_DECISION =
  'inline-flex min-h-control items-center justify-center gap-3 rounded-control border-2 px-5 py-3 text-lg font-bold';

const CLASES_DECISION: Readonly<Record<Dictamen, string>> = {
  aprobado: `${BASE_DECISION} border-semaforo-verde bg-semaforo-fondo-verde text-tinta`,
  observaciones: `${BASE_DECISION} border-semaforo-ambar bg-semaforo-fondo-ambar text-tinta`,
  rechazado: `${BASE_DECISION} border-semaforo-rojo bg-semaforo-fondo-rojo text-tinta`
};

function iconoEstado(estado: string): ReactNode {
  if (estado === 'aprobado') return <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />;
  if (estado === 'observaciones' || estado === 'rechazado') {
    return <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0" />;
  }
  return <ClipboardCheck aria-hidden="true" className="h-5 w-5 shrink-0" />;
}

/** Detalle del expediente con las acciones permitidas para cada rol. */
export function DetalleTramite({ id }: { id: string }) {
  const { repositorio, listo } = useRepository();
  const { actor, perfil } = useAuth();
  const ahora = useRelojDemo();
  const procesarCorreos = useCorreos();
  const [tramite, setTramite] = useState<TramiteConDetalle | null>(null);
  const [historial, setHistorial] = useState<HistorialEvento[]>([]);
  const [configuracion, setConfiguracion] = useState<ConfiguracionSla[]>([]);
  const [catalogo, setCatalogo] = useState<Dependencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [avisoExito, setAvisoExito] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [sellos, setSellos] = useState<Record<string, string>>({});
  const [motivos, setMotivos] = useState<Record<string, string>>({});

  const cargar = useCallback(async () => {
    if (!repositorio || !listo) return;
    setCargando(true);
    try {
      const [detalle, eventos, configs, dependencias] = await Promise.all([
        repositorio.obtenerTramite(id),
        repositorio.listarHistorial(id),
        repositorio.listarConfiguracionSla(),
        repositorio.listarDependencias()
      ]);
      if (!detalle) {
        setError('No encontramos ese trámite. Revisa el folio o vuelve al listado.');
        setTramite(null);
        return;
      }
      setTramite(detalle);
      setHistorial(eventos);
      setConfiguracion(configs);
      setCatalogo(dependencias);
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo cargar el expediente.');
    } finally {
      setCargando(false);
    }
  }, [id, listo, repositorio]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function ejecutar(
    operacion: (repositorio: TramiteRepository) => Promise<unknown>,
    mensaje: string
  ): Promise<void> {
    if (!repositorio) {
      setAviso('El repositorio aún no está listo. Espera un momento e inténtalo de nuevo.');
      setAvisoExito(false);
      return;
    }
    setOcupado(true);
    setAviso('');
    try {
      await operacion(repositorio);
      setAviso(mensaje);
      setAvisoExito(true);
      await cargar();
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No se pudo completar la acción. Inténtalo de nuevo.');
      setAvisoExito(false);
    } finally {
      setOcupado(false);
    }
  }

  function nombreDependencia(dependenciaId: string): string {
    return catalogo.find((item) => item.id === dependenciaId)?.nombre ?? dependenciaId;
  }

  function claveDependencia(dependenciaId: string): ClaveDependencia {
    return catalogo.find((item) => item.id === dependenciaId)?.clave ?? 'bomberos';
  }

  function esMio(dependencia: TramiteDependencia): boolean {
    return Boolean(actor && actor.dependencia_id === dependencia.dependencia_id);
  }

  function abrirEvidencia(): void {
    const seccion = document.getElementById('evidencia');
    seccion?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    seccion?.querySelector<HTMLInputElement>('input[type="file"]')?.focus();
  }

  async function enviarRecordatorio(dependencia: TramiteDependencia): Promise<void> {
    if (!tramite || !repositorio) return;
    const clave = `recordatorio-${dependencia.id}-${ahora.toISOString().slice(0, 10)}`;
    const destinatario = CORREOS_EJEMPLO[claveDependencia(dependencia.dependencia_id)];
    const sla = calcularSla(
      {
        turnado_at: dependencia.turnado_at,
        acuse_at: dependencia.acuse_at,
        dictamen_at: dependencia.dictamen_at,
        pausado_desde: dependencia.pausado_desde,
        horas_pausadas: dependencia.horas_pausadas
      },
      configuracion.find((item) => item.dependencia_id === dependencia.dependencia_id) ??
        CONFIGURACION_PREDETERMINADA,
      ahora
    );
    const correo = renderizarCorreo('recordatorio_sla', {
      folio: tramite.folio,
      dependencia: nombreDependencia(dependencia.dependencia_id),
      horasTranscurridas: sla.dictamen.transcurrido_horas,
      horasLimite: sla.dictamen.limite_horas
    });
    await ejecutar(async () => {
      await repositorio.registrarNotificacion({
        tramiteId: tramite.id,
        destinatario,
        plantilla: 'recordatorio_sla',
        asunto: correo.asunto,
        cuerpo: correo.texto,
        claveIdempotencia: clave
      });
      await procesarCorreos(clave);
    }, 'Recordatorio enviado. No se enviará otro hoy.');
  }

  if (cargando) {
    return <Cargando mensaje="Abriendo el expediente..." />;
  }

  if (error || !tramite) {
    return (
      <div className="mx-auto w-full max-w-5xl px-5 py-10">
        <ErrorVista mensaje={error || 'No se pudo abrir el expediente.'} onReintentar={() => void cargar()} />
      </div>
    );
  }

  if (!repositorio || !actor) {
    return (
      <div className="mx-auto w-full max-w-5xl px-5 py-10">
        <ErrorVista mensaje="No pudimos identificar tu sesión. Vuelve al inicio y selecciona un perfil válido." />
      </div>
    );
  }

  const esCiudadanoDueno = actor.rol === 'ciudadano' && tramite.ciudadano_id === actor.id;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-10">
      <div>
        <p className="text-lg font-semibold text-tinta">Folio {tramite.folio}</p>
        <h1 className="mt-2 text-3xl font-bold text-cafe">{tramite.giro_principal}</h1>
        <p className="mt-3 text-lg leading-relaxed text-tinta">
          {tramite.domicilio_negocio}, {tramite.colonia} · Registrado el {fechaLegible(tramite.created_at)}
        </p>
      </div>

      <SemaforoTramite
        tramite={tramite}
        configuracionSla={configuracion}
        catalogoDependencias={catalogo}
        ahora={ahora}
        onSubirEvidencia={abrirEvidencia}
      />

      <Aviso mensaje={aviso} exito={avisoExito} />

      <section aria-labelledby="revisiones" className="rounded-control border-2 border-arena bg-superficie p-5">
        <h2 id="revisiones" className="text-2xl font-bold text-cafe">Revisiones por dependencia</h2>
        <div id="evidencia" className="mt-4 grid gap-4">
          {tramite.dependencias.length === 0 && (
            <p className="rounded-control border-l-8 border-semaforo-gris bg-semaforo-fondo-gris p-4 text-lg leading-relaxed text-tinta">
              Esta solicitud aún no tiene dependencias asignadas.
            </p>
          )}
          {tramite.dependencias.map((dependencia) => {
            const configurada = configuracion.find(
              (item) => item.dependencia_id === dependencia.dependencia_id
            );
            const calculo = calcularSla(
              dependencia,
              configurada ?? CONFIGURACION_PREDETERMINADA,
              ahora
            );
            const motive = (motivos[dependencia.id] ?? '').trim();

            return (
              <article key={dependencia.id} className="rounded-control border-2 border-arena bg-superficie p-4">
                <div className={`rounded-control border-l-8 p-4 ${FRANJAS[dependencia.estado] ?? 'border-l-semaforo-gris bg-semaforo-fondo-gris'}`}>
                  <h3 className="text-xl font-bold text-cafe">{nombreDependencia(dependencia.dependencia_id)}</h3>
                  <p className="mt-2 flex items-center gap-3 text-lg font-semibold text-tinta">
                    {iconoEstado(dependencia.estado)}
                    Estado: <strong>{dependencia.estado.replace('_', ' ')}</strong>
                  </p>
                  <p className="mt-2 text-lg leading-relaxed text-tinta">
                    Tiempo de respuesta de la revisión: {calculo.dictamen.transcurrido_horas.toFixed(1)} h de{' '}
                    {calculo.dictamen.limite_horas} h · {calculo.dictamen.categoria.replace('_', ' ')}
                    {calculo.dictamen.pausado ? ' · en pausa' : ''}
                  </p>
                  {dependencia.motivo && (
                    <p className={`${CLASE_ERROR} flex items-start gap-2`}>
                      <AlertTriangle aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" />
                      Motivo: {dependencia.motivo}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3">
                  {actor?.rol === 'secretaria' && dependencia.estado === 'pendiente' && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => void ejecutar(
                        (repo) => repo.registrarTurno({ actor: actor, tramiteDependenciaId: dependencia.id }),
                        'El oficio se envió a revisión.'
                      )}
                      className={BOTON_PRIMARIO}
                    >
                      Enviar a revisión
                    </button>
                  )}

                  {actor?.rol === 'secretaria' && dependencia.estado === 'turnado' && (
                    <div className="w-full">
                      <label className={CLASE_ETIQUETA} htmlFor={`sello-${dependencia.id}`}>
                        Folio del sello de la constancia de recibido (obligatorio)
                      </label>
                      <input
                        id={`sello-${dependencia.id}`}
                        className={CLASE_CAMPO}
                        value={sellos[dependencia.id] ?? ''}
                        onChange={(evento) => setSellos((anterior) => ({ ...anterior, [dependencia.id]: evento.target.value }))}
                      />
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => void ejecutar(
                          (repo) => repo.registrarAcuse({
                            actor: actor,
                            tramiteDependenciaId: dependencia.id,
                            selloFolio: sellos[dependencia.id] ?? ''
                          }),
                          'Constancia de recibido registrada.'
                        )}
                        className={`${BOTON_PRIMARIO} mt-3`}
                      >
                        Registrar constancia de recibido
                      </button>
                    </div>
                  )}

                  {(actor?.rol === 'bomberos' || actor?.rol === 'proteccion_civil') && esMio(dependencia) && (
                    dependencia.estado === 'turnado' ? (
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => void ejecutar(
                          (repo) => repo.registrarRecepcion({ actor: actor, tramiteDependenciaId: dependencia.id }),
                          'Confirmado. Ya puedes registrar el resultado de la revisión.'
                        )}
                        className={BOTON_PRIMARIO}
                      >
                        Confirmar que recibimos el oficio
                      </button>
                    ) : dependencia.estado === 'en_inspeccion' ? (
                      <div className="w-full">
                        <label className={CLASE_ETIQUETA} htmlFor={`motivo-${dependencia.id}`}>
                          Motivo (obligatorio si no apruebas)
                        </label>
                        <textarea
                          id={`motivo-${dependencia.id}`}
                          rows={3}
                          className={CLASE_CAMPO}
                          value={motivos[dependencia.id] ?? ''}
                          onChange={(evento) => setMotivos((anterior) => ({ ...anterior, [dependencia.id]: evento.target.value }))}
                        />
                        <div className="mt-3 flex flex-wrap gap-3">
                          {(['aprobado', 'observaciones', 'rechazado'] as const).map((decision: Dictamen) => (
                            <button
                              key={decision}
                              type="button"
                              disabled={ocupado}
                              onClick={() => void ejecutar(
                                (repo) => repo.dictaminar({
                                  actor: actor,
                                  tramiteDependenciaId: dependencia.id,
                                  dictamen: decision,
                                  motivo: decision === 'aprobado' ? null : motive
                                }),
                                decision === 'aprobado'
                                  ? 'Resultado de la revisión: aprobado.'
                                  : decision === 'observaciones'
                                    ? 'Pedimos un documento. El tiempo de respuesta quedó en pausa.'
                                    : 'Rechazo registrado con su motivo.'
                              )}
                              className={CLASES_DECISION[decision]}
                            >
                              {decision === 'aprobado' ? 'Aprobar' : decision === 'observaciones' ? 'Pedir un documento' : 'Rechazar'}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null
                  )}

                  {esCiudadanoDueno && dependencia.estado === 'observaciones' && (
                    <div className="w-full">
                      <SubirEvidencia
                        tramiteId={tramite.id}
                        dependencia={dependencia}
                        nombreDependencia={nombreDependencia(dependencia.dependencia_id)}
                        onCompletado={() => void cargar()}
                      />
                    </div>
                  )}

                  {(dependencia.estado === 'turnado' || dependencia.estado === 'en_inspeccion') && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => void enviarRecordatorio(dependencia)}
                      className={BOTON_SECUNDARIO}
                    >
                      Enviar recordatorio
                    </button>
                  )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="documentos" className="rounded-control border-2 border-arena bg-superficie p-5">
        <h2 id="documentos" className="text-2xl font-bold text-cafe">Documentos del expediente</h2>
        {tramite.documentos.length === 0 ? (
          <p className="mt-3 text-lg leading-relaxed text-tinta">Todavía no hay documentos registrados.</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {tramite.documentos.map((documento) => (
              <li key={documento.id} className="rounded-control border-2 border-arena bg-papel p-4 text-lg leading-relaxed text-tinta">
                {documento.tipo} · {documento.mime} · {(documento.size_bytes / 1024).toFixed(0)} KB ·{' '}
                {fechaLegible(documento.created_at)}
                {documento.storage_path.startsWith('demo://') && ' · archivo simulado (demo)'}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="historial-detalle" className="rounded-control border-2 border-arena bg-superficie p-5">
        <h2 id="historial-detalle" className="text-2xl font-bold text-cafe">Historial de este trámite</h2>
        {historial.length === 0 ? (
          <p className="mt-3 text-lg leading-relaxed text-tinta">Aún no hay eventos registrados.</p>
        ) : (
          <ol className="mt-3 grid gap-3">
            {historial.map((evento) => (
              <li key={evento.id} className="rounded-control border-2 border-arena bg-papel p-4 text-lg leading-relaxed text-tinta">
                <strong>{ACCIONES[evento.accion] ?? evento.accion}</strong> · {evento.actor_rol} ·{' '}
                {fechaLegible(evento.created_at)}
                {evento.datos_despues && (
                  <span className="mt-2 block break-words text-lg">Detalle: {evento.datos_despues}</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {perfil?.rol === 'admin' && (
        <p className="text-lg text-tinta">Esta vista es de solo lectura para la administración.</p>
      )}
    </div>
  );
}
