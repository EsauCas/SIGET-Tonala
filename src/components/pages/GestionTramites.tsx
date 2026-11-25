'use client';

import { BellRing, CheckCircle2, ClipboardCheck, FileCheck2, Send, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AcuseIndividualPanel } from '@/components/AcuseIndividualPanel';
import { AcuseLotePanel } from '@/components/AcuseLotePanel';
import { DialogoConfirmacion } from '@/components/DialogoConfirmacion';
import { DrawerExpediente } from '@/components/DrawerExpediente';
import { Aviso, Cargando, ErrorVista } from '@/components/EstadosVista';
import { EtiquetaEstado } from '@/components/TramiteLista';
import { useAuth } from '@/components/AuthProvider';
import { useCorreos } from '@/components/EmailLogToast';
import { PageShell } from '@/components/layout/PageShell';
import { SeccionCard } from '@/components/layout/SeccionCard';
import { MensajeVacio } from '@/components/layout/MensajeVacio';
import { BOTON_PRIMARIO, CLASE_CAMPO } from '@/components/layout/estilos';
import { useRepository } from '@/components/RepositoryProvider';
import { useRelojDemo } from '@/components/useRelojDemo';
import { categoriaDelTramite, type CategoriaPanel } from '@/lib/domain/clasificacion';
import {
  claveAccion,
  claveRecordatorio,
  correoDe,
  esUrgente,
  filtrarBandeja,
  nombreDependencia,
  ordenarPorUrgencia,
  resumenUrgencia,
  claveDependencia,
  motivoEsValido,
  type ResumenUrgencia
} from '@/lib/gestion';
import { renderizarCorreo } from '@/lib/email-templates';
import type { Actor } from '@/lib/repository/types';
import type {
  ClaveDependencia,
  ConfiguracionSla,
  Dependencia,
  Dictamen,
  EstadoDependencia,
  TramiteConDetalle,
  TramiteDependencia
} from '@/types/database';

const ETIQUETA_ESTADO: Readonly<Record<EstadoDependencia, string>> = {
  pendiente: 'Aún no se envía',
  turnado: 'Enviado a revisión',
  en_inspeccion: 'Revisando el local',
  observaciones: 'Falta documentación',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado'
};

const COLOR_URGENCIA: Readonly<Record<ResumenUrgencia['categoria'], string>> = {
  en_tiempo: 'border-l-8 border-semaforo-verde bg-semaforo-fondo-verde text-tinta',
  por_vencer: 'border-l-8 border-semaforo-ambar bg-semaforo-fondo-ambar text-tinta',
  vencido: 'border-l-8 border-semaforo-rojo bg-semaforo-fondo-rojo text-tinta'
};

const CATEGORIAS: readonly CategoriaPanel[] = ['vencido', 'por_vencer', 'en_tiempo', 'pendiente'];

interface DatosBandeja {
  tramites: TramiteConDetalle[];
  catalogo: Dependencia[];
  configuracion: ConfiguracionSla[];
}

type Accion =
  | { tipo: 'turnar'; tramite: TramiteConDetalle }
  | { tipo: 'recepcion'; tramite: TramiteConDetalle; fila: TramiteDependencia }
  | { tipo: 'dictamen'; tramite: TramiteConDetalle; fila: TramiteDependencia }
  | { tipo: 'acuse'; tramite: TramiteConDetalle; fila: TramiteDependencia }
  | { tipo: 'recordatorio'; tramite: TramiteConDetalle; fila: TramiteDependencia };

/** Bandeja operativa. Toda decisión de autoridad se valida de nuevo en el repositorio. */
export function GestionTramites() {
  const { repositorio } = useRepository();
  const { actor, cargando: cargandoAuth } = useAuth();
  const ahora = useRelojDemo();
  const procesarCorreos = useCorreos();
  const [datos, setDatos] = useState<DatosBandeja | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [dependenciaFiltro, setDependenciaFiltro] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaPanel | ''>('');
  const [busqueda, setBusqueda] = useState('');
  const [accion, setAccion] = useState<Accion | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');
  const [aviso, setAviso] = useState('');
  const [exito, setExito] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!repositorio || !actor) return;
    setErrorCarga('');
    try {
      const [tramites, catalogo, configuracion] = await Promise.all([
        repositorio.listarTramites({ actor }),
        repositorio.listarDependencias(),
        repositorio.listarConfiguracionSla()
      ]);
      setDatos({ tramites, catalogo, configuracion });
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'No pudimos cargar la bandeja.');
    }
  }, [actor, repositorio]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Los paneles del inicio enlazan aquí con ?categoria=...; es sólo un filtro de vista.
  useEffect(() => {
    const valor = new URLSearchParams(window.location.search).get('categoria');
    if (valor && CATEGORIAS.includes(valor as CategoriaPanel)) setCategoriaFiltro(valor as CategoriaPanel);
  }, []);

  const visibles = useMemo(() => {
    if (!datos) return [];
    const clave = datos.catalogo.find((item) => item.id === dependenciaFiltro)?.clave as
      | ClaveDependencia
      | undefined;
    const filtrados = filtrarBandeja(datos.tramites, {
      actor,
      dependenciaId: dependenciaFiltro,
      dependenciaClave: clave,
      busqueda
    }).filter((tramite) =>
      categoriaFiltro === '' ||
      categoriaDelTramite(tramite, datos.configuracion, ahora) === categoriaFiltro
    );
    return ordenarPorUrgencia(filtrados, datos.configuracion, ahora);
  }, [actor, ahora, busqueda, categoriaFiltro, datos, dependenciaFiltro]);

  function notificar(mensaje: string, esExito = true): void {
    setAviso(mensaje);
    setExito(esExito);
  }

  async function encolar(
    tramite: TramiteConDetalle,
    fila: TramiteDependencia | null,
    tipo: string,
    asunto: string,
    cuerpo: string
  ): Promise<void> {
    if (!repositorio) return;
    const clave = fila
      ? claveRecordatorio(fila.id)
      : claveAccion(tipo, tramite.id, ahora.toISOString().slice(0, 10));
    const destino = fila ? correoDe(claveDependencia(fila.dependencia_id, datos?.catalogo ?? [])) : 'ventanilla@tonala.gob.mx';
    const correo = renderizarCorreo(tipo, {
      folio: tramite.folio,
      nombreCiudadano: tramite.nombre_contribuyente,
      dependencia: fila ? nombreDependencia(fila.dependencia_id, datos?.catalogo ?? []) : undefined
    });
    await repositorio.registrarNotificacion({
      tramiteId: tramite.id,
      destinatario: destino,
      plantilla: tipo,
      asunto: correo.asunto || asunto,
      cuerpo: correo.texto || cuerpo,
      claveIdempotencia: clave
    });
    // Si falla el aviso, la acción ya realizada no se revierte: el cron lo reintentará.
    void procesarCorreos(clave).catch(() => undefined);
  }

  async function ejecutar(queHacer: () => Promise<void>, mensaje: string): Promise<void> {
    if (!repositorio || !actor) return;
    setOcupado(true);
    setErrorAccion('');
    try {
      await queHacer();
      setAccion(null);
      notificar(mensaje);
      await cargar();
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : 'No pudimos completar la acción. Inténtalo de nuevo.');
    } finally {
      setOcupado(false);
    }
  }

  if (cargandoAuth) {
    return (
      <PageShell titulo="Preparando la bandeja" descripcion="Estamos verificando tu perfil de trabajo.">
        <Cargando mensaje="Verificando tu sesión..." />
      </PageShell>
    );
  }

  if (actor?.rol === 'ciudadano') {
    return (
      <PageShell
        titulo="Esta sección es para el personal municipal"
        descripcion="Tu solicitud se atiende en la sección de trámites. Ahí ves el avance y entregas documentos cuando se te pida."
      >
        <MensajeVacio
          titulo="Ir a tus trámites"
          descripcion="Consulta cómo va tu solicitud sin salir de tu perfil."
          accion={
            <Link href="/tramites" className={BOTON_PRIMARIO}>
              Ir a mis trámites
            </Link>
          }
        />
      </PageShell>
    );
  }

  if (!actor || !repositorio) {
    return (
      <PageShell titulo="No pudimos identificar tu sesión" descripcion="Vuelve al inicio y elige un perfil de prueba válido.">
        <ErrorVista mensaje="No pudimos identificar tu sesión. Vuelve al inicio y selecciona un perfil válido." />
      </PageShell>
    );
  }

  if (errorCarga) {
    return (
      <PageShell titulo="No pudimos abrir la bandeja" descripcion="Tus datos siguen guardados. Inténtalo otra vez.">
        <ErrorVista mensaje={errorCarga} onReintentar={() => void cargar()} />
      </PageShell>
    );
  }

  if (!datos) {
    return (
      <PageShell titulo="Preparando la bandeja" descripcion="Ordenando los trámites por urgencia.">
        <Cargando mensaje="Preparando la bandeja de trabajo..." />
      </PageShell>
    );
  }

  const esSecretaria = actor.rol === 'secretaria';

  return (
    <PageShell
      titulo="Gestionar trámites"
      descripcion="¿Qué puedo hacer aquí? Revisa primero lo vencido, registra la constancia de recibido y da el resultado de la revisión."
    >
      <Aviso mensaje={aviso} exito={exito} />

      <SeccionCard
        numero={1}
        titulo="Buscar y filtrar"
        descripcion="Elige una dependencia o escribe el folio. Los trámites urgentes aparecen primero."
        tono="ocre"
      >
        <p id="filtro-dependencia" className="text-lg font-bold text-tinta">Dependencia</p>
        <div className="mt-2 flex flex-wrap gap-3" role="group" aria-labelledby="filtro-dependencia">
          <button
            type="button"
            aria-pressed={dependenciaFiltro === ''}
            onClick={() => setDependenciaFiltro('')}
            className={`min-h-control rounded-control border-2 px-5 py-3 text-lg font-bold ${
              dependenciaFiltro === '' ? 'border-cafe bg-ocre text-tinta' : 'border-bordeCampo bg-superficie text-tinta'
            }`}
          >
            Todas
          </button>
          {datos.catalogo.map((item) => {
            const activo = dependenciaFiltro === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={activo}
                onClick={() => setDependenciaFiltro(item.id)}
                className={`min-h-control rounded-control border-2 px-5 py-3 text-lg font-bold ${
                  activo ? 'border-cafe bg-ocre text-tinta' : 'border-bordeCampo bg-superficie text-tinta'
                }`}
              >
                {item.nombre}
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          <p id="filtro-categoria" className="text-lg font-bold text-tinta">Tiempo de respuesta</p>
          <div className="mt-2 flex flex-wrap gap-3" role="group" aria-labelledby="filtro-categoria">
            <button
              type="button"
              aria-pressed={categoriaFiltro === ''}
              onClick={() => setCategoriaFiltro('')}
              className={`min-h-control rounded-control border-2 px-5 py-3 text-lg font-bold ${
                categoriaFiltro === '' ? 'border-cafe bg-ocre text-tinta' : 'border-bordeCampo bg-superficie text-tinta'
              }`}
            >
              Todos
            </button>
            {(['vencido', 'por_vencer', 'en_tiempo', 'pendiente'] as const).map((categoria) => {
              const activo = categoriaFiltro === categoria;
              const etiquetas: Record<CategoriaPanel, string> = {
                vencido: 'Vencidos',
                por_vencer: 'Por vencer',
                en_tiempo: 'En tiempo',
                pendiente: 'Por enviar'
              };
              return (
                <button
                  key={categoria}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setCategoriaFiltro(categoria)}
                  className={`min-h-control rounded-control border-2 px-5 py-3 text-lg font-bold ${
                    activo ? 'border-cafe bg-ocre text-tinta' : 'border-bordeCampo bg-superficie text-tinta'
                  }`}
                >
                  {etiquetas[categoria]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 max-w-xl">
          <label htmlFor="buscar-bandeja" className="text-lg font-bold text-tinta">Buscar por folio o nombre</label>
          <input
            id="buscar-bandeja"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Ej. TT-2026-0001 o María"
            className={CLASE_CAMPO}
          />
        </div>
      </SeccionCard>

      {visibles.length === 0 ? (
        <MensajeVacio
          titulo="No hay trámites con esos filtros"
          descripcion="Quita un filtro o escribe otro folio. Si aun así no aparece, todavía no hay trámites en esta bandeja."
          accion={
            <button
              type="button"
              className="min-h-control rounded-control border-2 border-barro bg-superficie px-5 py-3 text-lg font-bold text-barro"
              onClick={() => {
                setBusqueda('');
                setDependenciaFiltro('');
                setCategoriaFiltro('');
              }}
            >
              Quitar filtros
            </button>
          }
        />
      ) : (
        <SeccionCard
          numero={2}
          titulo="Trámites ordenados por urgencia"
          descripcion="Vencidos primero. La acción recomendada está resaltada; las demás están en «Más acciones»."
        >
          <section aria-label="Bandeja de trámites" className="hidden overflow-x-auto rounded-control border-2 border-arena bg-superficie md:block">
            <table className="w-full min-w-[900px] border-collapse text-base text-tinta">
              <caption className="sr-only">Trámites ordenados por urgencia en el tiempo de respuesta</caption>
              <thead className="bg-papel">
                <tr>
                  <th scope="col" className="p-3 text-left font-bold">Folio y persona</th>
                  <th scope="col" className="p-3 text-left font-bold">Situación</th>
                  <th scope="col" className="p-3 text-left font-bold">Estado por dependencia</th>
                  <th scope="col" className="p-3 text-left font-bold">Tiempo de respuesta</th>
                  <th scope="col" className="p-3 text-left font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((tramite) => (
                  <FilaBandeja
                    key={tramite.id}
                    tramite={tramite}
                    datos={datos}
                    actor={actor}
                    esSecretaria={esSecretaria}
                    onAccion={setAccion}
                    onDetalle={() => setDetalleId(tramite.id)}
                  />
                ))}
              </tbody>
            </table>
          </section>

          <ul className="grid gap-3 md:hidden">
            {visibles.map((tramite) => (
              <TarjetaBandeja
                key={tramite.id}
                tramite={tramite}
                datos={datos}
                actor={actor}
                esSecretaria={esSecretaria}
                onAccion={setAccion}
                onDetalle={() => setDetalleId(tramite.id)}
              />
            ))}
          </ul>
        </SeccionCard>
      )}

      <SeccionCard
        numero={3}
        titulo="Registrar constancias de recibido con el escáner"
        descripcion="La lectura del documento sólo propone datos. Revisa y confirma antes de guardar."
        tono="ocre"
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <AcuseIndividualPanel onListo={() => void cargar()} />
          <AcuseLotePanel onListo={() => void cargar()} />
        </div>
      </SeccionCard>

      <DrawerExpediente
        tramiteId={detalleId}
        catalogo={datos.catalogo}
        onCerrar={() => setDetalleId(null)}
      />

      {accion?.tipo === 'turnar' && (
        <DialogoTurnar
          tramite={accion.tramite}
          catalogo={datos.catalogo}
          ocupado={ocupado}
          error={errorAccion}
          onCancelar={() => { setAccion(null); setErrorAccion(''); }}
          onConfirmar={(ids) =>
            void ejecutar(async () => {
              if (!repositorio) return;
              await repositorio.turnarTramite({ actor, tramiteDependenciaIds: ids });
              await encolar(
                accion.tramite,
                null,
                'turnado',
                `Enviado a revisión: ${accion.tramite.folio}`,
                'Se envió la solicitud a las dependencias seleccionadas.'
              );
            }, 'Listo. Enviamos la solicitud a revisión y comenzó el conteo del tiempo.')
          }
        />
      )}

      {accion?.tipo === 'recepcion' && (
        <DialogoConfirmacion
          abierto
          titulo="Confirmar recepción de documentos"
          mensaje={`Confirma que ${nombreDependencia(accion.fila.dependencia_id, datos.catalogo)} recibió los documentos del folio ${accion.tramite.folio}.`}
          etiquetaConfirmar="Sí, ya los recibimos"
          ocupado={ocupado}
          onCancelar={() => { setAccion(null); setErrorAccion(''); }}
          onConfirmar={() =>
            void ejecutar(async () => {
              if (!repositorio) return;
              await repositorio.registrarRecepcion({ actor, tramiteDependenciaId: accion.fila.id });
              await encolar(accion.tramite, accion.fila, 'recepcion', `Recepción confirmada: ${accion.tramite.folio}`, 'La dependencia confirmó que recibió los documentos.');
            }, 'Listo. Confirmamos la recepción y comenzó la revisión.')
          }
        >
          <Aviso mensaje={errorAccion} />
        </DialogoConfirmacion>
      )}

      {accion?.tipo === 'dictamen' && (
        <DialogoDictamen
          accion={accion}
          catalogo={datos.catalogo}
          ocupado={ocupado}
          error={errorAccion}
          onCancelar={() => { setAccion(null); setErrorAccion(''); }}
          onConfirmar={(dictamen, motivo, fechaVisita) =>
            void ejecutar(async () => {
              if (!repositorio) return;
              await repositorio.dictaminar({
                actor,
                tramiteDependenciaId: accion.fila.id,
                dictamen,
                motivo,
                ...(fechaVisita ? { fechaVisita } : {})
              });
              await encolar(accion.tramite, accion.fila, 'dictamen', `Resultado de la revisión: ${accion.tramite.folio}`, `Se registró el resultado: ${dictamen}.`);
            }, 'Listo. Guardamos el resultado y avisamos a la persona contribuyente.')
          }
        />
      )}

      {accion?.tipo === 'acuse' && (
        <DialogoAcuse
          accion={accion}
          ocupado={ocupado}
          error={errorAccion}
          onCancelar={() => { setAccion(null); setErrorAccion(''); }}
          onConfirmar={(folioSello, fecha, hora) =>
            void ejecutar(async () => {
              if (!repositorio) return;
              await repositorio.registrarAcuse({
                actor,
                tramiteDependenciaId: accion.fila.id,
                selloFolio: folioSello,
                selloFecha: fecha,
                selloHora: hora
              });
              await encolar(accion.tramite, accion.fila, 'acuse', `Constancia registrada: ${accion.tramite.folio}`, 'Se registró la constancia con sello.');
            }, 'Listo. Guardamos la constancia y se detuvo el tiempo de entrega.')
          }
        />
      )}

      {accion?.tipo === 'recordatorio' && (
        <DialogoConfirmacion
          abierto
          titulo="Enviar recordatorio"
          mensaje={`Se registrará un recordatorio a ${nombreDependencia(accion.fila.dependencia_id, datos.catalogo)} para el folio ${accion.tramite.folio}. No se duplicará si ya se envió hoy.`}
          etiquetaConfirmar="Enviar recordatorio"
          ocupado={ocupado}
          onCancelar={() => { setAccion(null); setErrorAccion(''); }}
          onConfirmar={() =>
            void ejecutar(async () => {
              const clave = claveRecordatorio(accion.fila.id, ahora);
              const correo = renderizarCorreo('recordatorio_sla', {
                folio: accion.tramite.folio,
                dependencia: nombreDependencia(accion.fila.dependencia_id, datos.catalogo)
              });
              await repositorio.registrarNotificacion({
                tramiteId: accion.tramite.id,
                destinatario: correoDe(claveDependencia(accion.fila.dependencia_id, datos.catalogo)),
                plantilla: 'recordatorio_sla',
                asunto: correo.asunto,
                cuerpo: correo.texto,
                claveIdempotencia: clave
              });
              void procesarCorreos(clave).catch(() => undefined);
            }, 'Recordatorio registrado. No se enviará otro con la misma clave hoy.')
          }
        >
          <Aviso mensaje={errorAccion} />
        </DialogoConfirmacion>
      )}
    </PageShell>
  );
}

interface FilaProps {
  tramite: TramiteConDetalle;
  datos: DatosBandeja;
  actor: Actor;
  esSecretaria: boolean;
  onAccion(accion: Accion): void;
  onDetalle(): void;
}

function FilaBandeja({ tramite, datos, actor, esSecretaria, onAccion, onDetalle }: FilaProps) {
  const urgencia = resumenUrgencia(tramite, datos.configuracion);
  const pendientes = tramite.dependencias.filter((item) => item.estado === 'pendiente');

  return (
    <tr className="border-t-2 border-arena">
      <td className="p-3 align-top">
        <button type="button" onClick={onDetalle} className="min-h-tactil font-bold text-barro underline decoration-2 underline-offset-2">
          {tramite.folio}
        </button>
        <div>{tramite.nombre_contribuyente}</div>
        <div className="text-base">{tramite.giro_principal}</div>
      </td>
      <td className="p-3 align-top"><EtiquetaEstado tramite={tramite} /></td>
      <td className="p-3 align-top">
        <ul className="grid gap-1">
          {tramite.dependencias.map((item) => (
            <li key={item.id}>
              <strong>{nombreDependencia(item.dependencia_id, datos.catalogo)}:</strong>{' '}
              {ETIQUETA_ESTADO[item.estado]}
            </li>
          ))}
        </ul>
      </td>
      <td className="p-3 align-top">
        {urgencia.iniciado ? (
          <span className={`inline-block rounded-control border-2 px-2 py-1 font-bold ${COLOR_URGENCIA[urgencia.categoria]}`}>
            {Math.round(urgencia.horas)} h de {urgencia.limite} h
            {urgencia.pausado ? ' (en pausa)' : ''}
          </span>
        ) : (
          <span>Sin reloj iniciado</span>
        )}
      </td>
      <td className="p-3 align-top">
        <AccionesFila
          tramite={tramite}
          datos={datos}
          actor={actor}
          esSecretaria={esSecretaria}
          pendientes={pendientes}
          onAccion={onAccion}
          onDetalle={onDetalle}
        />
      </td>
    </tr>
  );
}

function TarjetaBandeja({ tramite, datos, actor, esSecretaria, onAccion, onDetalle }: FilaProps) {
  const urgencia = resumenUrgencia(tramite, datos.configuracion);
  const pendientes = tramite.dependencias.filter((item) => item.estado === 'pendiente');

  return (
    <li className="rounded-control border-2 border-arena bg-superficie p-4">
      <button type="button" onClick={onDetalle} className="min-h-tactil text-left text-xl font-bold text-barro underline decoration-2 underline-offset-2">
        {tramite.folio}
      </button>
      <p className="text-lg text-tinta">{tramite.nombre_contribuyente}</p>
      <div className="mt-2"><EtiquetaEstado tramite={tramite} /></div>
      <ul className="mt-2 grid gap-1 text-lg text-tinta">
        {tramite.dependencias.map((item) => (
          <li key={item.id}>
            <strong>{nombreDependencia(item.dependencia_id, datos.catalogo)}:</strong> {ETIQUETA_ESTADO[item.estado]}
          </li>
        ))}
      </ul>
      {urgencia.iniciado && (
        <p className={`mt-2 inline-block rounded-control border-2 px-3 py-1 font-bold ${COLOR_URGENCIA[urgencia.categoria]}`}>
          {Math.round(urgencia.horas)} h de {urgencia.limite} h{urgencia.pausado ? ' (en pausa)' : ''}
        </p>
      )}
      <div className="mt-3">
        <AccionesFila
          tramite={tramite}
          datos={datos}
          actor={actor}
          esSecretaria={esSecretaria}
          pendientes={pendientes}
          onAccion={onAccion}
          onDetalle={onDetalle}
        />
      </div>
    </li>
  );
}

interface AccionesProps extends FilaProps {
  pendientes: TramiteDependencia[];
}

interface AccionVisible {
  clave: string;
  etiqueta: string;
  icono: ReactNode;
  ejecutar(): void;
}

function AccionesFila({ tramite, datos, actor, esSecretaria, pendientes, onAccion, onDetalle }: AccionesProps) {
  const urgencia = resumenUrgencia(tramite, datos.configuracion);
  const turnado = tramite.dependencias.find((fila) => fila.estado === 'turnado');
  const recepcion = tramite.dependencias.find(
    (fila) => fila.estado === 'turnado' && fila.dependencia_id === actor.dependencia_id
  );
  const inspeccion = tramite.dependencias.find(
    (fila) => fila.estado === 'en_inspeccion' && fila.dependencia_id === actor.dependencia_id
  );
  const recordatorio = tramite.dependencias.find(
    (fila) => fila.dependencia_id && esUrgente(urgencia.categoria)
  );

  const todas: AccionVisible[] = [
    {
      clave: 'detalle',
      etiqueta: 'Ver expediente',
      icono: <ClipboardCheck aria-hidden="true" className="inline h-5 w-5" />,
      ejecutar: onDetalle
    }
  ];

  if (esSecretaria && pendientes.length > 0) {
    todas.push({
      clave: 'turnar',
      etiqueta: 'Enviar a revisión',
      icono: <Send aria-hidden="true" className="inline h-5 w-5" />,
      ejecutar: () => onAccion({ tipo: 'turnar', tramite })
    });
  }
  if (esSecretaria && turnado) {
    todas.push({
      clave: 'acuse',
      etiqueta: 'Registrar constancia de recibido',
      icono: <FileCheck2 aria-hidden="true" className="inline h-5 w-5" />,
      ejecutar: () => onAccion({ tipo: 'acuse', tramite, fila: turnado })
    });
  }
  if (recepcion) {
    todas.push({
      clave: `recepcion-${recepcion.id}`,
      etiqueta: 'Confirmar que recibimos los documentos',
      icono: <CheckCircle2 aria-hidden="true" className="inline h-5 w-5" />,
      ejecutar: () => onAccion({ tipo: 'recepcion', tramite, fila: recepcion })
    });
  }
  if (inspeccion) {
    todas.push({
      clave: `resultado-${inspeccion.id}`,
      etiqueta: 'Dar resultado de la revisión',
      icono: <ShieldAlert aria-hidden="true" className="inline h-5 w-5" />,
      ejecutar: () => onAccion({ tipo: 'dictamen', tramite, fila: inspeccion })
    });
  }
  if ((actor.rol === 'secretaria' || actor.rol === 'admin') && recordatorio) {
    todas.push({
      clave: `recordatorio-${recordatorio.id}`,
      etiqueta: 'Enviar recordatorio',
      icono: <BellRing aria-hidden="true" className="inline h-5 w-5" />,
      ejecutar: () => onAccion({ tipo: 'recordatorio', tramite, fila: recordatorio })
    });
  }

  // Prioridad de la acción recomendada: lo que desbloquea el trámite primero.
  const prioridad = ['turnar', 'acuse', 'recepcion', 'resultado', 'recordatorio'];
  const recomendada =
    todas
      .filter((accion) => prioridad.some((prefijo) => accion.clave.startsWith(prefijo)))
      .sort((a, b) => {
        const pa = prioridad.findIndex((prefijo) => a.clave.startsWith(prefijo));
        const pb = prioridad.findIndex((prefijo) => b.clave.startsWith(prefijo));
        return pa - pb;
      })[0] ?? todas[0];

  const secundarias = todas.filter((accion) => accion.clave !== recomendada.clave);
  const boton = 'inline-flex min-h-tactil items-center gap-2 rounded-control border-2 border-barro bg-superficie px-3 py-2 text-base font-bold text-barro';

  return (
    <div className="flex flex-wrap items-start gap-2">
      <button
        type="button"
        onClick={recomendada.ejecutar}
        className="inline-flex min-h-tactil items-center gap-2 rounded-control bg-barro px-3 py-2 text-base font-bold text-white"
      >
        {recomendada.icono}
        {recomendada.etiqueta}
      </button>

      {secundarias.length > 0 && (
        <details className="max-w-full">
          <summary className={`${boton} cursor-pointer list-none marker:hidden`}>
            Más acciones
          </summary>
          <div className="mt-2 grid gap-2 rounded-control border-2 border-arena bg-papel p-3">
            {secundarias.map((accion) => (
              <button key={accion.clave} type="button" onClick={accion.ejecutar} className={boton}>
                {accion.icono}
                {accion.etiqueta}
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

interface DialogoTurnarProps {
  tramite: TramiteConDetalle;
  catalogo: readonly Dependencia[];
  ocupado: boolean;
  error: string;
  onCancelar(): void;
  onConfirmar(ids: string[]): void;
}

function DialogoTurnar({ tramite, catalogo, ocupado, error, onCancelar, onConfirmar }: DialogoTurnarProps) {
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const pendientes = tramite.dependencias.filter((item) => item.estado === 'pendiente');

  function alternar(id: string): void {
    setSeleccion((actual) => actual.includes(id) ? actual.filter((item) => item !== id) : [...actual, id]);
  }

  return (
    <DialogoConfirmacion
      abierto
      titulo="Enviar a revisión"
      mensaje={`Elige a qué dependencias enviarás el folio ${tramite.folio}. Todas recibirán el mismo número de oficio.`}
      etiquetaConfirmar="Sí, enviar a revisión"
      ocupado={ocupado || seleccion.length === 0}
      onCancelar={onCancelar}
      onConfirmar={() => onConfirmar(seleccion)}
    >
      <Aviso mensaje={error} />
      <fieldset className="mt-4 grid gap-3">
        <legend className="text-lg font-bold text-tinta">Dependencias</legend>
        {pendientes.map((fila) => (
          <label key={fila.id} className="flex min-h-tactil items-center gap-3 text-lg text-tinta">
            <input
              type="checkbox"
              checked={seleccion.includes(fila.id)}
              onChange={() => alternar(fila.id)}
              className="h-6 w-6"
            />
            {nombreDependencia(fila.dependencia_id, catalogo)}
          </label>
        ))}
      </fieldset>
      {seleccion.length === 0 && (
        <p className="mt-3 text-lg font-semibold text-tinta">Selecciona al menos una dependencia.</p>
      )}
    </DialogoConfirmacion>
  );
}

interface DialogoDictamenProps {
  accion: Extract<Accion, { tipo: 'dictamen' }>;
  catalogo: readonly Dependencia[];
  ocupado: boolean;
  error: string;
  onCancelar(): void;
  onConfirmar(dictamen: Dictamen, motivo: string | null, fechaVisita?: string): void;
}

function DialogoDictamen({ accion, catalogo, ocupado, error, onCancelar, onConfirmar }: DialogoDictamenProps) {
  const esPC = claveDependencia(accion.fila.dependencia_id, catalogo) === 'proteccion_civil';
  const [dictamen, setDictamen] = useState<Dictamen>('aprobado');
  const [motivo, setMotivo] = useState('');
  const [fechaVisita, setFechaVisita] = useState('');
  const motivoValido = motivoEsValido(dictamen, motivo);
  const visitaValida = !esPC || /^\d{4}-\d{2}-\d{2}$/.test(fechaVisita);

  function confirmar(): void {
    onConfirmar(dictamen, dictamen === 'aprobado' ? null : motivo.trim(), visitaValida ? fechaVisita : undefined);
  }

  return (
    <DialogoConfirmacion
      abierto
      titulo="Dar resultado de la revisión"
      mensaje={`Registra lo que encontraste en el folio ${accion.tramite.folio} de ${nombreDependencia(accion.fila.dependencia_id, catalogo)}.`}
      etiquetaConfirmar="Guardar resultado"
      ocupado={ocupado || !motivoValido || !visitaValida}
      onCancelar={onCancelar}
      onConfirmar={confirmar}
    >
      <Aviso mensaje={error} />
      <div className="mt-4 grid gap-4">
        <fieldset>
          <legend className="text-lg font-bold text-tinta">¿Qué encontraste?</legend>
          {(['aprobado', 'observaciones', 'rechazado'] as const).map((opcion) => (
            <label key={opcion} className="mt-2 flex min-h-tactil items-center gap-3 text-lg text-tinta">
              <input
                type="radio"
                name="dictamen"
                value={opcion}
                checked={dictamen === opcion}
                onChange={() => setDictamen(opcion)}
                className="h-6 w-6"
              />
              {opcion === 'aprobado' ? 'Aprobado' : opcion === 'observaciones' ? 'Falta documentación' : 'Rechazado'}
            </label>
          ))}
        </fieldset>

        {dictamen !== 'aprobado' && (
          <div>
            <label htmlFor="motivo-dictamen" className="block text-lg font-bold text-tinta">
              Motivo (mínimo 10 caracteres)
            </label>
            <textarea
              id="motivo-dictamen"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-control border-2 border-bordeCampo bg-superficie p-3 text-lg text-tinta"
            />
            {!motivoValido && (
              <p className="mt-1 text-lg font-semibold text-tinta">Escribe un motivo claro de al menos 10 caracteres.</p>
            )}
          </div>
        )}

        {esPC && (
          <div>
            <label htmlFor="fecha-visita" className="block text-lg font-bold text-tinta">Fecha de tu visita</label>
            <input
              id="fecha-visita"
              type="date"
              value={fechaVisita}
              onChange={(e) => setFechaVisita(e.target.value)}
              className="mt-1 min-h-control w-full rounded-control border-2 border-bordeCampo bg-superficie px-3 text-lg text-tinta"
            />
            {!visitaValida && <p className="mt-1 text-lg font-semibold text-tinta">Captura la fecha de tu visita.</p>}
          </div>
        )}
      </div>
    </DialogoConfirmacion>
  );
}

interface DialogoAcuseProps {
  accion: Extract<Accion, { tipo: 'acuse' }>;
  ocupado: boolean;
  error: string;
  onCancelar(): void;
  onConfirmar(folio: string, fecha: string, hora: string): void;
}

function DialogoAcuse({ accion, ocupado, error, onCancelar, onConfirmar }: DialogoAcuseProps) {
  const [folio, setFolio] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const completo = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && /^\d{2}:\d{2}$/.test(hora) && folio.trim().length >= 4;

  return (
    <DialogoConfirmacion
      abierto
      titulo="Registrar constancia de recibido"
      mensaje={`Captura los datos del sello de la constancia del folio ${accion.tramite.folio}.`}
      etiquetaConfirmar="Guardar constancia"
      ocupado={ocupado || !completo}
      onCancelar={onCancelar}
      onConfirmar={() => onConfirmar(folio.trim(), fecha, hora)}
    >
      <Aviso mensaje={error} />
      <div className="mt-4 grid gap-3">
        <div>
          <label htmlFor="sello-folio" className="block text-lg font-bold text-tinta">Folio de la constancia</label>
          <input
            id="sello-folio"
            required
            minLength={4}
            value={folio}
            onChange={(e) => setFolio(e.target.value)}
            className="mt-1 min-h-control w-full rounded-control border-2 border-bordeCampo bg-superficie px-3 text-lg text-tinta"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="sello-fecha" className="block text-lg font-bold text-tinta">Fecha del sello</label>
            <input
              id="sello-fecha"
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="mt-1 min-h-control w-full rounded-control border-2 border-bordeCampo bg-superficie px-3 text-lg text-tinta"
            />
          </div>
          <div>
            <label htmlFor="sello-hora" className="block text-lg font-bold text-tinta">Hora del sello</label>
            <input
              id="sello-hora"
              type="time"
              required
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="mt-1 min-h-control w-full rounded-control border-2 border-bordeCampo bg-superficie px-3 text-lg text-tinta"
            />
          </div>
        </div>
        {!completo && (
          <p className="text-lg leading-relaxed text-tinta">
            Captura folio, fecha y hora para guardar la constancia de recibido.
          </p>
        )}
      </div>
    </DialogoConfirmacion>
  );
}
