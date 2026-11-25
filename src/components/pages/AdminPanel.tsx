'use client';

import {
  BellRing,
  Clock3,
  Mail,
  RotateCcw,
  ShieldCheck,
  Stamp,
  Timer,
  UsersRound
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useCorreos } from '@/components/EmailLogToast';
import { Aviso, Cargando, ErrorVista, fechaLegible } from '@/components/EstadosVista';
import { PageShell } from '@/components/layout/PageShell';
import { SeccionCard } from '@/components/layout/SeccionCard';
import { MensajeVacio } from '@/components/layout/MensajeVacio';
import {
  BOTON_PRIMARIO,
  BOTON_SECUNDARIO,
  CLASE_CAMPO,
  CLASE_ETIQUETA
} from '@/components/layout/estilos';
import { useRepository } from '@/components/RepositoryProvider';
import { useRelojDemo } from '@/components/useRelojDemo';
import { VistaCorreo } from '@/components/VistaCorreo';
import { CONFIGURACION_PREDETERMINADA } from '@/lib/domain/sla';
import { calcularMetricasTiemposMuertos, type MetricaTiempoMuerto } from '@/lib/notificaciones/metricas';
import { calcularRecordatorios, type EntradaRecordatorio } from '@/lib/notificaciones/recordatorios';
import { avanzarRelojDemo, reiniciarRelojDemo } from '@/lib/reloj-demo';
import type { EstadoAlmacenamientoDemo } from '@/lib/repository/types';
import type {
  CorreoSimulado,
  ConfiguracionSla,
  Dependencia,
  Notificacion,
  Profile,
  Rol,
  TipoHoras,
  TramiteConDetalle
} from '@/types/database';

interface FormaSla {
  horasLimite: string;
  horasAlerta: string;
  tipoHoras: TipoHoras;
}

const ROLES: readonly Rol[] = ['ciudadano', 'secretaria', 'bomberos', 'proteccion_civil', 'admin'];

const ETIQUETA_ROL: Readonly<Record<Rol, string>> = {
  ciudadano: 'Ciudadanía',
  secretaria: 'Ventanilla',
  bomberos: 'Bomberos',
  proteccion_civil: 'Protección Civil',
  admin: 'Administración'
};

function formaDesde(configuracion: ConfiguracionSla): FormaSla {
  return {
    horasLimite: String(configuracion.horas_limite),
    horasAlerta: String(configuracion.horas_alerta_previa),
    tipoHoras: configuracion.tipo_horas
  };
}

/** Panel de administración de la demostración: roles, plazos, reloj y correos. */
export function AdminPanel() {
  const { repositorio, listo, demo } = useRepository();
  const { actor, perfil } = useAuth();
  const procesarCorreos = useCorreos();
  const ahora = useRelojDemo();
  const [configuracion, setConfiguracion] = useState<ConfiguracionSla[]>([]);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [correos, setCorreos] = useState<CorreoSimulado[]>([]);
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [tramites, setTramites] = useState<TramiteConDetalle[]>([]);
  const [dependencias, setDependencias] = useState<Dependencia[]>([]);
  const [formas, setFormas] = useState<Record<string, FormaSla>>({});
  const [roles, setRoles] = useState<Record<string, Rol>>({});
  const [almacenamiento, setAlmacenamiento] = useState<EstadoAlmacenamientoDemo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [exito, setExito] = useState(false);
  const [guardando, setGuardando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!repositorio || !listo || perfil?.rol !== 'admin') return;
    setCargando(true);
    try {
      const [configs, notificaciones, correosDemo, personas, expedientes, catalogo] = await Promise.all([
        repositorio.listarConfiguracionSla(),
        repositorio.listarNotificaciones(),
        demo?.listarCorreosSimulados() ?? Promise.resolve([] as CorreoSimulado[]),
        repositorio.listarUsuarios(),
        repositorio.listarTramites(),
        repositorio.listarDependencias()
      ]);
      setConfiguracion(configs);
      setNotificaciones(notificaciones);
      setCorreos(correosDemo);
      setUsuarios(personas);
      setTramites(expedientes);
      setDependencias(catalogo);
      setFormas(Object.fromEntries(configs.map((config) => [config.id, formaDesde(config)])));
      setRoles(Object.fromEntries(personas.map((persona) => [persona.id, persona.rol])));
      setAlmacenamiento(demo?.estadoAlmacenamiento?.() ?? null);
      setError('');
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo cargar la administración.');
    } finally {
      setCargando(false);
    }
  }, [demo, listo, perfil?.rol, repositorio]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const metricas = useMemo<MetricaTiempoMuerto[]>(
    () => calcularMetricasTiemposMuertos(tramites, dependencias, configuracion, ahora),
    [ahora, configuracion, dependencias, tramites]
  );

  if (perfil && perfil.rol !== 'admin') {
    return (
      <PageShell
        titulo="Esta sección es sólo para administración"
        descripcion="Tu perfil no puede cambiar la configuración. Puedes consultar el resto del sistema con normalidad."
      >
        <MensajeVacio
          titulo="No hay cambios que hacer aquí"
          descripcion="Si necesitas ajustar plazos o roles, pide apoyo a la persona administradora."
          accion={
            <Link href="/" className={BOTON_PRIMARIO}>
              Volver al inicio
            </Link>
          }
        />
      </PageShell>
    );
  }

  function avisar(texto: string, fueExito: boolean): void {
    setMensaje(texto);
    setExito(fueExito);
  }

  function avanzarReloj(horas: number): void {
    try {
      avanzarRelojDemo(horas);
      avisar(`El reloj avanzó ${horas} horas. Vuelve a mirar el semáforo y los plazos.`, true);
    } catch (fallo) {
      avisar(fallo instanceof Error ? fallo.message : 'No se pudo mover el reloj.', false);
    }
  }

  function restablecerReloj(): void {
    reiniciarRelojDemo();
    avisar('El reloj volvió a la hora real.', true);
  }

  async function guardar(configuracionItem: ConfiguracionSla): Promise<void> {
    if (!repositorio || !actor) return;
    const forma = formas[configuracionItem.id] ?? formaDesde(configuracionItem);
    const limite = Number(forma.horasLimite);
    const alerta = Number(forma.horasAlerta);
    if (!Number.isFinite(limite) || !Number.isFinite(alerta) || limite <= 0 || alerta <= 0 || alerta >= limite) {
      avisar('La alerta debe ser menor al límite y ambos deben ser mayores a cero.', false);
      return;
    }

    setGuardando(configuracionItem.id);
    try {
      await repositorio.actualizarConfiguracionSla({
        actor,
        id: configuracionItem.id,
        horasLimite: limite,
        horasAlertaPrevia: alerta,
        tipoHoras: forma.tipoHoras
      });
      avisar('Plazos actualizados correctamente.', true);
      await cargar();
    } catch (fallo) {
      avisar(fallo instanceof Error ? fallo.message : 'No se pudo guardar la configuración.', false);
    } finally {
      setGuardando(null);
    }
  }

  async function guardarRol(usuario: Profile): Promise<void> {
    if (!repositorio || !actor) return;
    const rol = roles[usuario.id] ?? usuario.rol;
    setGuardando(usuario.id);
    try {
      await repositorio.actualizarRolUsuario({ actor, id: usuario.id, rol });
      avisar(`Rol de ${usuario.nombre} actualizado.`, true);
      await cargar();
    } catch (fallo) {
      avisar(fallo instanceof Error ? fallo.message : 'No se pudo actualizar el rol.', false);
    } finally {
      setGuardando(null);
    }
  }

  async function reintentar(notificacion: Notificacion): Promise<void> {
    if (!repositorio) return;
    setGuardando(notificacion.id);
    try {
      await repositorio.reintentarNotificacion(notificacion.clave_idempotencia);
      await procesarCorreos(notificacion.clave_idempotencia);
      avisar('El correo volvió a enviarse.', true);
      await cargar();
    } catch (fallo) {
      avisar(fallo instanceof Error ? fallo.message : 'No se pudo reintentar el correo.', false);
    } finally {
      setGuardando(null);
    }
  }

  async function vaciarPendientes(): Promise<void> {
    setGuardando('cola');
    try {
      await procesarCorreos();
      avisar('Se procesaron los correos pendientes.', true);
      await cargar();
    } catch (fallo) {
      avisar(fallo instanceof Error ? fallo.message : 'No se pudo procesar la cola.', false);
    } finally {
      setGuardando(null);
    }
  }

  async function enviarRecordatorios(): Promise<void> {
    if (!repositorio) return;
    setGuardando('recordatorios');
    try {
      const entradas: EntradaRecordatorio[] = [];
      for (const tramite of tramites) {
        for (const renglon of tramite.dependencias) {
          entradas.push({
            tramite,
            renglon,
            dependencia: dependencias.find((item) => item.id === renglon.dependencia_id),
            configuracion: configuracion.find((item) => item.dependencia_id === renglon.dependencia_id) ?? {
              id: `predeterminada-${renglon.dependencia_id}`,
              dependencia_id: renglon.dependencia_id,
              ...CONFIGURACION_PREDETERMINADA
            }
          });
        }
      }

      const planeados = calcularRecordatorios(entradas, ahora);
      const claves = new Set(notificaciones.map((item) => item.clave_idempotencia));
      let nuevos = 0;
      for (const planeado of planeados) {
        if (claves.has(planeado.claveIdempotencia)) continue;
        await repositorio.registrarNotificacion({
          tramiteId: planeado.tramiteId,
          destinatario: planeado.destinatario,
          plantilla: planeado.plantilla,
          asunto: planeado.asunto,
          cuerpo: planeado.cuerpo,
          claveIdempotencia: planeado.claveIdempotencia
        });
        claves.add(planeado.claveIdempotencia);
        nuevos += 1;
      }

      if (nuevos > 0 || notificaciones.some((item) => item.estado === 'pendiente')) {
        await procesarCorreos();
      }
      avisar(
        planeados.length === 0
          ? 'No hay plazos por vencer ni vencidos en este momento.'
          : nuevos === 0
            ? 'Los recordatorios de hoy ya estaban registrados; no se duplicaron.'
            : `Se registraron ${nuevos} recordatorio(s) y se enviaron sus correos simulados.`,
        true
      );
      await cargar();
    } catch (fallo) {
      avisar(fallo instanceof Error ? fallo.message : 'No se pudieron enviar los recordatorios.', false);
    } finally {
      setGuardando(null);
    }
  }

  async function reiniciarDatos(): Promise<void> {
    if (!demo) return;
    setGuardando('reiniciar');
    try {
      await demo.reiniciar();
      avisar('Los datos y el reloj volvieron al estado inicial de la demostración.', true);
      await cargar();
    } catch (fallo) {
      avisar(fallo instanceof Error ? fallo.message : 'No se pudo reiniciar la demostración.', false);
    } finally {
      setGuardando(null);
    }
  }

  if (cargando) {
    return (
      <PageShell titulo="Preparando la administración" descripcion="Estamos cargando perfiles, plazos y correos.">
        <Cargando mensaje="Cargando la configuración..." />
      </PageShell>
    );
  }
  if (error) {
    return (
      <PageShell titulo="No pudimos cargar la administración" descripcion="Tus datos siguen guardados. Inténtalo otra vez.">
        <ErrorVista mensaje={error} onReintentar={() => void cargar()} />
      </PageShell>
    );
  }

  const maxHoras = Math.max(1, ...metricas.map((item) => item.horasMaximas));

  return (
    <PageShell
      titulo="Administración"
      descripcion="¿Qué puedo hacer aquí? Ajusta roles y tiempos límite, revisa los correos simulados y consulta la espera de cada dependencia. Los cambios quedan registrados."
    >
      <Aviso mensaje={mensaje} exito={exito} />

      <SeccionCard
        numero={1}
        titulo="Controles de demostración"
        descripcion="Adelanta el reloj para ver cómo cambian los plazos sin esperar días reales. Nadie recibe correos fuera de esta computadora."
        icono={<Clock3 aria-hidden="true" className="h-7 w-7" />}
      >
        <p className="rounded-control border-l-8 border-barro bg-papel px-4 py-3 text-lg font-bold text-tinta">
          Hora de la demostración: {fechaLegible(ahora.toISOString())}
        </p>
        <p className="mt-4 text-lg leading-relaxed text-tinta">
          {almacenamiento?.disponible === false
            ? almacenamiento.mensaje
            : 'Los cambios se guardan en este navegador. Si cierras la pestaña, puedes reiniciarlos aquí.'}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={guardando !== null}
            onClick={() => avanzarReloj(24)}
            className={`${BOTON_PRIMARIO} disabled:opacity-60`}
          >
            <Clock3 aria-hidden="true" className="h-5 w-5" />
            Avanzar 24 h
          </button>
          <button
            type="button"
            disabled={guardando !== null}
            onClick={() => avanzarReloj(48)}
            className={`${BOTON_PRIMARIO} disabled:opacity-60`}
          >
            <Clock3 aria-hidden="true" className="h-5 w-5" />
            Avanzar 48 h
          </button>
          <button
            type="button"
            disabled={guardando !== null}
            onClick={() => avanzarReloj(72)}
            className={`${BOTON_PRIMARIO} disabled:opacity-60`}
          >
            <Clock3 aria-hidden="true" className="h-5 w-5" />
            Avanzar 72 h
          </button>
          <button
            type="button"
            disabled={guardando !== null}
            onClick={restablecerReloj}
            className={`${BOTON_SECUNDARIO} disabled:opacity-60`}
          >
            <Clock3 aria-hidden="true" className="h-5 w-5" />
            Restablecer reloj
          </button>
          <button
            type="button"
            disabled={guardando !== null}
            onClick={() => void enviarRecordatorios()}
            className={`${BOTON_PRIMARIO} disabled:opacity-60`}
          >
            <BellRing aria-hidden="true" className="h-5 w-5" />
            {guardando === 'recordatorios' ? 'Enviando recordatorios...' : 'Enviar recordatorios de tiempo de respuesta'}
          </button>
          <button
            type="button"
            disabled={guardando !== null}
            onClick={() => void reiniciarDatos()}
            className={`${BOTON_SECUNDARIO} disabled:opacity-60`}
          >
            <RotateCcw aria-hidden="true" className="h-5 w-5" />
            {guardando === 'reiniciar' ? 'Reiniciando datos...' : 'Reiniciar datos de demostración'}
          </button>
        </div>
      </SeccionCard>

      <SeccionCard
        numero={2}
        titulo="Usuarios y roles"
        descripcion="El rol se guarda en el perfil y no puede cambiarlo la persona usuaria."
        icono={<UsersRound aria-hidden="true" className="h-7 w-7" />}
      >
        {usuarios.length === 0 ? (
          <MensajeVacio
            titulo="No hay usuarios registrados"
            descripcion="Cuando haya perfiles en la demostración, aparecerán aquí para asignar su rol."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-lg text-tinta">
              <caption className="pb-3 text-left text-base text-tinta">Selecciona el rol y guarda para aplicar el cambio.</caption>
              <thead>
                <tr className="border-b-4 border-arena">
                  <th scope="col" className="py-2 pr-3">Nombre</th>
                  <th scope="col" className="py-2 pr-3">Correo</th>
                  <th scope="col" className="py-2 pr-3">Rol</th>
                  <th scope="col" className="py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((usuario) => (
                  <tr key={usuario.id} className="border-b-2 border-arena">
                    <td className="py-3 pr-3 font-semibold">{usuario.nombre}</td>
                    <td className="py-3 pr-3 break-all">{usuario.email}</td>
                    <td className="py-3 pr-3">
                      <label className="sr-only" htmlFor={`rol-${usuario.id}`}>Rol de {usuario.nombre}</label>
                      <select
                        id={`rol-${usuario.id}`}
                        className="min-h-tactil rounded-control border-2 border-bordeCampo bg-superficie px-3 text-base"
                        value={roles[usuario.id] ?? usuario.rol}
                        onChange={(evento) => setRoles((anterior) => ({ ...anterior, [usuario.id]: evento.target.value as Rol }))}
                      >
                        {ROLES.map((rol) => <option key={rol} value={rol}>{ETIQUETA_ROL[rol]}</option>)}
                      </select>
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        disabled={guardando === usuario.id}
                        onClick={() => void guardarRol(usuario)}
                        className="inline-flex min-h-tactil items-center rounded-control bg-barro px-4 py-2 text-base font-bold text-white disabled:opacity-60"
                      >
                        Guardar rol
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SeccionCard>

      <SeccionCard
        numero={3}
        titulo="Tiempos límite por dependencia"
        descripcion="Define cuántas horas tiene cada dependencia para dar su resultado y cuándo avisar."
        tono="ocre"
        icono={<Timer aria-hidden="true" className="h-7 w-7" />}
      >
        <div className="grid gap-5">
          {configuracion.length === 0 && (
            <MensajeVacio
              titulo="No hay tiempos límite registrados"
              descripcion="Cuando haya dependencias configuradas, podrás ajustar sus plazos aquí."
            />
          )}
          {configuracion.map((config) => {
            const forma = formas[config.id] ?? formaDesde(config);
            return (
              <form
                key={config.id}
                className="grid gap-4 rounded-control border-2 border-arena bg-papel p-5 sm:grid-cols-3"
                onSubmit={(evento) => {
                  evento.preventDefault();
                  void guardar(config);
                }}
              >
                <div>
                  <label className={CLASE_ETIQUETA} htmlFor={`limite-${config.id}`}>
                    Horas límite · {dependencias.find((item) => item.id === config.dependencia_id)?.nombre ?? config.dependencia_id}
                  </label>
                  <input
                    id={`limite-${config.id}`}
                    type="number"
                    min="1"
                    className={CLASE_CAMPO}
                    value={forma.horasLimite}
                    onChange={(evento) => setFormas((anterior) => ({
                      ...anterior,
                      [config.id]: { ...forma, horasLimite: evento.target.value }
                    }))}
                  />
                </div>
                <div>
                  <label className={CLASE_ETIQUETA} htmlFor={`alerta-${config.id}`}>
                    Avisar antes (horas)
                  </label>
                  <input
                    id={`alerta-${config.id}`}
                    type="number"
                    min="1"
                    className={CLASE_CAMPO}
                    value={forma.horasAlerta}
                    onChange={(evento) => setFormas((anterior) => ({
                      ...anterior,
                      [config.id]: { ...forma, horasAlerta: evento.target.value }
                    }))}
                  />
                </div>
                <div>
                  <label className={CLASE_ETIQUETA} htmlFor={`tipo-${config.id}`}>
                    Tipo de horas
                  </label>
                  <select
                    id={`tipo-${config.id}`}
                    className={CLASE_CAMPO}
                    value={forma.tipoHoras}
                    onChange={(evento) => setFormas((anterior) => ({
                      ...anterior,
                      [config.id]: { ...forma, tipoHoras: evento.target.value as TipoHoras }
                    }))}
                  >
                    <option value="naturales">Naturales (24/7)</option>
                    <option value="habiles">Hábiles (lun-vie 9-17 h)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={guardando === config.id}
                  className={`${BOTON_PRIMARIO} disabled:opacity-60 sm:col-span-3`}
                >
                  {guardando === config.id ? 'Guardando...' : 'Guardar tiempos límite'}
                </button>
              </form>
            );
          })}
        </div>
      </SeccionCard>

      <SeccionCard
        numero={4}
        titulo="Correos simulados: revisión"
        descripcion="Cada intento queda registrado con estado, motivo y número de intentos."
        icono={<Mail aria-hidden="true" className="h-7 w-7" />}
      >
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={guardando === 'cola'}
            onClick={() => void vaciarPendientes()}
            className={`${BOTON_PRIMARIO} disabled:opacity-60`}
          >
            {guardando === 'cola' ? 'Enviando...' : 'Enviar correos pendientes'}
          </button>
        </div>
        {notificaciones.length === 0 ? (
          <MensajeVacio
            titulo="Todavía no hay correos registrados"
            descripcion="Cuando se registre un aviso, podrás ver aquí si se envió o si falló."
          />
        ) : (
          <ul className="mt-5 grid gap-3">
            {notificaciones.map((notificacion) => (
              <li key={notificacion.id} className="rounded-control border-2 border-arena bg-papel p-4 text-lg leading-relaxed text-tinta">
                <p><strong>{notificacion.asunto}</strong> · {notificacion.estado} · {fechaLegible(notificacion.created_at)}</p>
                <p className="mt-1 break-all">Para: {notificacion.destinatario}</p>
                {notificacion.enviado_a && notificacion.enviado_a !== notificacion.destinatario && (
                  <p className="mt-1 break-all">Enviado a: {notificacion.enviado_a} · Destinatario original conservado</p>
                )}
                <p className="mt-1">Intentos: {notificacion.intentos}</p>
                {notificacion.error_motivo && <p className="mt-1 break-words">Motivo: {notificacion.error_motivo}</p>}
                {notificacion.estado === 'error' && (
                  <button
                    type="button"
                    disabled={guardando === notificacion.id}
                    onClick={() => void reintentar(notificacion)}
                    className="mt-3 inline-flex min-h-tactil items-center rounded-control border-2 border-barro bg-superficie px-4 py-2 text-base font-bold text-barro disabled:opacity-60"
                  >
                    Reintentar correo
                  </button>
                )}
                <VistaCorreo
                  asunto={notificacion.asunto}
                  html={notificacion.html ?? ''}
                  plantilla={notificacion.plantilla ?? undefined}
                  compacto
                />
              </li>
            ))}
          </ul>
        )}
      </SeccionCard>

      <SeccionCard
        numero={5}
        titulo="Espera antes de la constancia"
        descripcion="Horas promedio entre el envío a revisión y la constancia de recibido. La tabla repite los mismos datos."
        tono="ocre"
        icono={<Stamp aria-hidden="true" className="h-7 w-7" />}
      >
        {metricas.length === 0 ? (
          <MensajeVacio
            titulo="No hay datos suficientes"
            descripcion="Cuando haya constancias registradas, verás aquí el promedio de espera."
          />
        ) : (
          <>
            <svg
              viewBox={`0 0 600 ${Math.max(120, metricas.length * 70 + 40)}`}
              role="img"
              aria-labelledby="grafica-tiempos-titulo grafica-tiempos-desc"
              className="h-auto w-full"
            >
              <title id="grafica-tiempos-titulo">Horas promedio de espera por dependencia</title>
              <desc id="grafica-tiempos-desc">
                {metricas.map((item) => `${item.nombre}: ${item.horasPromedio} horas promedio`).join('. ')}
              </desc>
              {metricas.map((metrica, indice) => {
                const y = 20 + indice * 70;
                const ancho = Math.round((metrica.horasPromedio / maxHoras) * 380);
                return (
                  <g key={metrica.dependenciaId}>
                    <text x="10" y={y + 24} fontSize="16" fill="#2B1810">{metrica.nombre}</text>
                    <rect x="240" y={y + 6} width="380" height="26" fill="#D9C3A5" rx="6" />
                    <rect x="240" y={y + 6} width={ancho} height="26" fill="#8F3A18" rx="6" />
                    <text x="628" y={y + 24} fontSize="16" fill="#2B1810" textAnchor="end">
                      {metrica.horasPromedio} h
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left text-lg text-tinta">
                <caption className="pb-3 text-left text-base text-tinta">Promedio y máximo de espera en cada dependencia.</caption>
                <thead>
                  <tr className="border-b-4 border-arena">
                    <th scope="col" className="py-3 pr-3">Dependencia</th>
                    <th scope="col" className="py-3 pr-3">Expedientes</th>
                    <th scope="col" className="py-3 pr-3">Promedio (h)</th>
                    <th scope="col" className="py-3">Máximo (h)</th>
                  </tr>
                </thead>
                <tbody>
                  {metricas.map((metrica) => (
                    <tr key={metrica.dependenciaId} className="border-b-2 border-arena">
                      <td className="py-3 pr-3 font-semibold">{metrica.nombre}</td>
                      <td className="py-3 pr-3">{metrica.expedientes}</td>
                      <td className="py-3 pr-3">{metrica.horasPromedio}</td>
                      <td className="py-3">{metrica.horasMaximas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SeccionCard>

      <SeccionCard
        numero={6}
        titulo="Bandeja de correos simulados"
        descripcion="No se envían correos reales. Para probar un recordatorio manual, abre un expediente en Gestión y pulsa «Enviar recordatorio»."
        icono={<Mail aria-hidden="true" className="h-7 w-7" />}
      >
        {correos.length === 0 ? (
          <MensajeVacio
            titulo="Aún no hay correos simulados"
            descripcion="Registra un recordatorio desde la bandeja de trabajo para verlo aparecer aquí."
            accion={
              <Link href="/gestion" className={BOTON_SECUNDARIO}>
                Abrir bandeja de trabajo
              </Link>
            }
          />
        ) : (
          <ul className="grid gap-3">
            {correos.map((correo) => (
              <li key={correo.id} className="rounded-control border-2 border-arena bg-papel p-4 text-lg leading-relaxed text-tinta">
                <strong>{correo.asunto}</strong> · {correo.destinatario} · {fechaLegible(correo.fecha)}
                <span className="mt-1 block text-base">{correo.cuerpo}</span>
                <VistaCorreo
                  asunto={correo.asunto}
                  html={correo.html}
                  plantilla={correo.plantilla}
                  compacto
                />
              </li>
            ))}
          </ul>
        )}
      </SeccionCard>

      <SeccionCard
        numero={7}
        titulo="Auditoría"
        descripcion="Cada cambio queda en el historial, que no se puede modificar ni borrar."
        tono="ocre"
        icono={<ShieldCheck aria-hidden="true" className="h-7 w-7" />}
        accion={
          <Link href="/historial" className={BOTON_PRIMARIO}>
            Ver historial completo
          </Link>
        }
      >
        <p className="text-lg leading-relaxed text-tinta">
          Consulta la línea de tiempo de todos los movimientos, incluidos los correos simulados.
        </p>
      </SeccionCard>
    </PageShell>
  );
}
