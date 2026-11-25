'use client';

import { BellRing, CheckCircle2, ClipboardCheck, Send, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AcuseIndividualPanel } from '@/components/AcuseIndividualPanel';
import { AcuseLotePanel } from '@/components/AcuseLotePanel';
import { DialogoConfirmacion } from '@/components/DialogoConfirmacion';
import { DrawerExpediente } from '@/components/DrawerExpediente';
import { Aviso, Cargando, ErrorVista, Vacio } from '@/components/EstadosVista';
import { EtiquetaEstado } from '@/components/TramiteLista';
import { useAuth } from '@/components/AuthProvider';
import { useCorreos } from '@/components/EmailLogToast';
import { useRepository } from '@/components/RepositoryProvider';
import { useRelojDemo } from '@/components/useRelojDemo';
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
  pendiente: 'Pendiente',
  turnado: 'Turnado',
  en_inspeccion: 'En revisión',
  observaciones: 'Con observaciones',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado'
};

const COLOR_URGENCIA: Readonly<Record<ResumenUrgencia['categoria'], string>> = {
  en_tiempo: 'border-semaforo-verde bg-green-50 text-semaforo-verde',
  por_vencer: 'border-semaforo-ambar bg-amber-50 text-semaforo-ambar',
  vencido: 'border-semaforo-rojo bg-red-50 text-semaforo-rojo'
};

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
    });
    return ordenarPorUrgencia(filtrados, datos.configuracion, ahora);
  }, [actor, ahora, busqueda, datos, dependenciaFiltro]);

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

  if (cargandoAuth) return <Cargando mensaje="Verificando tu sesión..." />;

  if (actor?.rol === 'ciudadano') {
    return (
      <main className="mx-auto grid w-full max-w-4xl gap-5 px-5 py-12">
        <div role="status" className="rounded-control border-4 border-enfasis bg-white p-6">
          <h1 className="text-3xl font-bold text-tinta">Esta sección es para el personal municipal</h1>
          <p className="mt-3 text-lg leading-relaxed text-tinta">
            Tu solicitud se atiende en la sección de trámites. Ahí puedes revisar el avance y
            entregar documentos cuando se te pida.
          </p>
          <Link
            href="/tramites"
            className="mt-5 inline-flex min-h-control items-center rounded-control bg-enfasis px-6 py-3 text-lg font-bold text-white"
          >
            Ir a mis trámites
          </Link>
        </div>
      </main>
    );
  }

  if (!actor || !repositorio) {
    return (
      <main className="mx-auto w-full max-w-4xl px-5 py-12">
        <ErrorVista mensaje="No pudimos identificar tu sesión. Vuelve al inicio y selecciona un perfil válido." />
      </main>
    );
  }

  if (errorCarga) {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-10">
        <ErrorVista mensaje={errorCarga} onReintentar={() => void cargar()} />
      </main>
    );
  }

  if (!datos) return <Cargando mensaje="Preparando la bandeja de trabajo..." />;

  const esSecretaria = actor.rol === 'secretaria';

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-10">
      <header>
        <p className="text-lg font-semibold text-tinta">Bandeja de trabajo</p>
        <h1 className="mt-1 text-3xl font-bold text-tinta">Gestión de trámites</h1>
        <p className="mt-2 text-lg leading-relaxed text-tinta">
          Los trámites con más tiempo de revisión aparecen primero. Abre el expediente para ver el detalle.
        </p>
      </header>

      <Aviso mensaje={aviso} exito={exito} />

      <section aria-labelledby="filtros-titulo" className="rounded-control border-2 border-slate-300 bg-white p-4">
        <h2 id="filtros-titulo" className="text-xl font-bold text-tinta">Buscar y filtrar</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="filtro-dependencia" className="block text-lg font-bold text-tinta">Dependencia</label>
            <select
              id="filtro-dependencia"
              value={dependenciaFiltro}
              onChange={(e) => setDependenciaFiltro(e.target.value)}
              className="mt-1 min-h-control w-full rounded-control border-2 border-slate-400 bg-white px-3 text-lg text-tinta"
            >
              <option value="">Todas</option>
              {datos.catalogo.map((item) => (
                <option key={item.id} value={item.id}>{item.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="buscar-bandeja" className="block text-lg font-bold text-tinta">Folio o nombre</label>
            <input
              id="buscar-bandeja"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Ej. FT-2026-0001 o María"
              className="mt-1 min-h-control w-full rounded-control border-2 border-slate-400 bg-white px-3 text-lg text-tinta"
            />
          </div>
        </div>
      </section>

      {visibles.length === 0 ? (
        <Vacio
          titulo="No hay trámites que mostrar"
          mensaje="Prueba con otro folio, nombre o dependencia. Si sigue sin aparecer, aún no hay trámites en esta bandeja."
        />
      ) : (
        <>
          <section aria-label="Bandeja de trámites" className="hidden overflow-x-auto rounded-control border-2 border-slate-300 bg-white md:block">
            <table className="w-full min-w-[900px] border-collapse text-base text-tinta">
              <caption className="sr-only">Trámites ordenados por urgencia de SLA</caption>
              <thead className="bg-lienzo">
                <tr>
                  <th scope="col" className="p-3 text-left font-bold">Folio y persona</th>
                  <th scope="col" className="p-3 text-left font-bold">Situación</th>
                  <th scope="col" className="p-3 text-left font-bold">Estado por dependencia</th>
                  <th scope="col" className="p-3 text-left font-bold">Reloj de dictamen</th>
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
        </>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <AcuseIndividualPanel onListo={() => void cargar()} />
        <AcuseLotePanel onListo={() => void cargar()} />
      </div>

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
                `Oficio turnado: ${accion.tramite.folio}`,
                'Se turnó el oficio a las dependencias seleccionadas.'
              );
            }, 'El oficio se turnó correctamente y se iniciaron los relojes.')
          }
        />
      )}

      {accion?.tipo === 'recepcion' && (
        <DialogoConfirmacion
          abierto
          titulo="Registrar recepción"
          mensaje={`Confirma que ${nombreDependencia(accion.fila.dependencia_id, datos.catalogo)} recibió los documentos del folio ${accion.tramite.folio}.`}
          etiquetaConfirmar="Sí, registrar recepción"
          ocupado={ocupado}
          onCancelar={() => { setAccion(null); setErrorAccion(''); }}
          onConfirmar={() =>
            void ejecutar(async () => {
              if (!repositorio) return;
              await repositorio.registrarRecepcion({ actor, tramiteDependenciaId: accion.fila.id });
              await encolar(accion.tramite, accion.fila, 'recepcion', `Recepción confirmada: ${accion.tramite.folio}`, 'La dependencia confirmó que recibió los documentos.');
            }, 'Recepción registrada. La revisión ya está en curso.')
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
              await encolar(accion.tramite, accion.fila, 'dictamen', `Dictamen registrado: ${accion.tramite.folio}`, `Se registró el dictamen: ${dictamen}.`);
            }, 'Dictamen registrado. La persona contribuyente fue notificada.')
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
              await encolar(accion.tramite, accion.fila, 'acuse', `Acuse registrado: ${accion.tramite.folio}`, 'Se registró el acuse con sello.');
            }, 'Acuse registrado. Se detuvo el reloj de entrega.')
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
    </main>
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
    <tr className="border-t border-slate-300">
      <td className="p-3 align-top">
        <button type="button" onClick={onDetalle} className="min-h-tactil font-bold text-enfasis underline">
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
    <li className="rounded-control border-2 border-slate-300 bg-white p-4">
      <button type="button" onClick={onDetalle} className="min-h-tactil text-left text-xl font-bold text-enfasis underline">
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

function AccionesFila({ tramite, datos, actor, esSecretaria, pendientes, onAccion, onDetalle }: AccionesProps) {
  const boton = 'min-h-tactil rounded-control border-2 border-enfasis bg-white px-3 py-2 text-base font-bold text-enfasis';

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onDetalle} className={boton}>Ver expediente</button>

      {esSecretaria && pendientes.length > 0 && (
        <button type="button" onClick={() => onAccion({ tipo: 'turnar', tramite })} className={boton}>
          <Send aria-hidden="true" className="inline h-4 w-4" /> Turnar oficio
        </button>
      )}

      {esSecretaria && tramite.dependencias.some((fila) => fila.estado === 'turnado') && (
        <button
          type="button"
          onClick={() => {
            const fila = tramite.dependencias.find((item) => item.estado === 'turnado');
            if (fila) onAccion({ tipo: 'acuse', tramite, fila });
          }}
          className={boton}
        >
          <ClipboardCheck aria-hidden="true" className="inline h-4 w-4" /> Registrar acuse
        </button>
      )}

      {tramite.dependencias
        .filter((fila) => fila.estado === 'turnado' && fila.dependencia_id === actor.dependencia_id)
        .map((fila) => (
          <button
            key={`recepcion-${fila.id}`}
            type="button"
            onClick={() => onAccion({ tipo: 'recepcion', tramite, fila })}
            className={boton}
          >
            <CheckCircle2 aria-hidden="true" className="inline h-4 w-4" /> Registrar recepción
          </button>
        ))}

      {tramite.dependencias
        .filter((fila) => fila.estado === 'en_inspeccion' && fila.dependencia_id === actor.dependencia_id)
        .map((fila) => (
          <button
            key={`dictamen-${fila.id}`}
            type="button"
            onClick={() => onAccion({ tipo: 'dictamen', tramite, fila })}
            className={boton}
          >
            <ShieldAlert aria-hidden="true" className="inline h-4 w-4" /> Emitir dictamen
          </button>
        ))}

      {(actor.rol === 'secretaria' || actor.rol === 'admin') &&
        tramite.dependencias
          .filter((fila) => fila.dependencia_id && esUrgente(resumenUrgencia(tramite, datos.configuracion).categoria))
          .map((fila) => (
            <button
              key={`recordatorio-${fila.id}`}
              type="button"
              onClick={() => onAccion({ tipo: 'recordatorio', tramite, fila })}
              className={boton}
            >
              <BellRing aria-hidden="true" className="inline h-4 w-4" /> Enviar recordatorio
            </button>
          ))}
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
      titulo="Turnar oficio"
      mensaje={`Elige a qué dependencias enviarás el folio ${tramite.folio}. Todas recibirán el mismo número de oficio.`}
      etiquetaConfirmar="Turnar oficio"
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
      titulo="Emitir dictamen"
      mensaje={`Registra tu decisión sobre el folio ${accion.tramite.folio} en ${nombreDependencia(accion.fila.dependencia_id, catalogo)}.`}
      etiquetaConfirmar="Guardar dictamen"
      ocupado={ocupado || !motivoValido || !visitaValida}
      onCancelar={onCancelar}
      onConfirmar={confirmar}
    >
      <Aviso mensaje={error} />
      <div className="mt-4 grid gap-4">
        <fieldset>
          <legend className="text-lg font-bold text-tinta">Decisión</legend>
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
              {opcion === 'aprobado' ? 'Aprobado' : opcion === 'observaciones' ? 'Con observaciones' : 'Rechazado'}
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
              className="mt-1 w-full rounded-control border-2 border-slate-400 bg-white p-3 text-lg text-tinta"
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
              className="mt-1 min-h-control w-full rounded-control border-2 border-slate-400 bg-white px-3 text-lg text-tinta"
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
      titulo="Registrar acuse sellado"
      mensaje={`Captura los datos del sello del oficio del folio ${accion.tramite.folio}.`}
      etiquetaConfirmar="Guardar acuse"
      ocupado={ocupado || !completo}
      onCancelar={onCancelar}
      onConfirmar={() => onConfirmar(folio.trim(), fecha, hora)}
    >
      <Aviso mensaje={error} />
      <div className="mt-4 grid gap-3">
        <div>
          <label htmlFor="sello-folio" className="block text-lg font-bold text-tinta">Folio del sello</label>
          <input
            id="sello-folio"
            required
            minLength={4}
            value={folio}
            onChange={(e) => setFolio(e.target.value)}
            className="mt-1 min-h-control w-full rounded-control border-2 border-slate-400 bg-white px-3 text-lg text-tinta"
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
              className="mt-1 min-h-control w-full rounded-control border-2 border-slate-400 bg-white px-3 text-lg text-tinta"
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
              className="mt-1 min-h-control w-full rounded-control border-2 border-slate-400 bg-white px-3 text-lg text-tinta"
            />
          </div>
        </div>
        {!completo && (
          <p className="text-lg text-tinta">Captura folio, fecha y hora para poder guardar el acuse.</p>
        )}
      </div>
    </DialogoConfirmacion>
  );
}
