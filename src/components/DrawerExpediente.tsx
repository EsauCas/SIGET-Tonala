'use client';

import { Info, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Aviso, Cargando, fechaLegible } from '@/components/EstadosVista';
import { EtiquetaEstado } from '@/components/TramiteLista';
import { useRepository } from '@/components/RepositoryProvider';
import { useDialogoAccesible } from '@/components/useDialogoAccesible';
import { nombreDependencia } from '@/lib/gestion';
import type {
  Dependencia,
  Documento,
  HistorialEvento,
  TramiteConDetalle
} from '@/types/database';

const ACCIONES: Readonly<Record<string, string>> = {
  tramite_creado: 'Se registró la solicitud',
  turnado_registrado: 'Se envió el oficio a revisión',
  acuse_registrado: 'Se registró la constancia de recibido',
  recepcion_registrada: 'La dependencia confirmó que recibió los documentos',
  dictamen_registrado: 'Se registró el resultado de la revisión',
  evidencia_entregada: 'La persona entregó un documento',
  recordatorio_sla: 'Se envió un recordatorio del tiempo de respuesta'
};

interface DatosExpediente {
  tramite: TramiteConDetalle;
  documentos: Documento[];
  historial: HistorialEvento[];
}

interface DrawerExpedienteProps {
  tramiteId: string | null;
  catalogo: readonly Dependencia[];
  onCerrar(): void;
}

/** Panel lateral del expediente. Datos leídos del repositorio, nunca editados aquí. */
export function DrawerExpediente({ tramiteId, catalogo, onCerrar }: DrawerExpedienteProps) {
  const { repositorio } = useRepository();
  const referencia = useDialogoAccesible(tramiteId !== null, onCerrar);
  const [datos, setDatos] = useState<DatosExpediente | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    if (!tramiteId || !repositorio) return;
    setError('');
    setDatos(null);
    try {
      const tramite = await repositorio.obtenerTramite(tramiteId);
      if (!tramite) {
        setError('No encontramos este expediente.');
        return;
      }
      const [documentos, historial] = await Promise.all([
        repositorio.listarDocumentos(tramiteId),
        repositorio.listarHistorial(tramiteId)
      ]);
      setDatos({ tramite, documentos, historial: historial.slice(0, 8) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cargar el expediente.');
    }
  }, [repositorio, tramiteId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (!tramiteId) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-tinta/60">
      <div
        ref={referencia}
        role="dialog"
        aria-modal="true"
        aria-labelledby="expediente-titulo"
        className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l-8 border-barro bg-superficie p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="expediente-titulo" className="text-2xl font-bold text-cafe">Expediente</h2>
            {datos && <p className="mt-1 text-lg font-semibold text-tinta">Folio {datos.tramite.folio}</p>}
          </div>
          <button
            type="button"
            data-inicial
            onClick={onCerrar}
            aria-label="Cerrar expediente"
            className="inline-flex min-h-tactil items-center gap-2 rounded-control border-2 border-bordeCampo bg-papel px-4 py-2 text-lg font-bold text-tinta"
          >
            <X aria-hidden="true" className="h-6 w-6 shrink-0" /> Cerrar
          </button>
        </div>

        <Aviso mensaje={error} />

        {!datos && !error && <div className="mt-4"><Cargando mensaje="Cargando expediente..." /></div>}

        {datos && (
          <div className="mt-5 grid gap-6">
            <section aria-labelledby="exp-datos">
              <h3 id="exp-datos" className="text-xl font-bold text-cafe">Datos de la solicitud</h3>
              <dl className="mt-3 grid gap-3 text-lg leading-relaxed text-tinta">
                <div><dt className="font-bold">Persona contribuyente:</dt> <dd>{datos.tramite.nombre_contribuyente}</dd></div>
                <div><dt className="font-bold">Tipo de trámite:</dt> <dd>{datos.tramite.tipo_tramite}</dd></div>
                <div><dt className="font-bold">Giro:</dt> <dd>{datos.tramite.giro_principal}</dd></div>
                <div><dt className="font-bold">Domicilio:</dt> <dd>{datos.tramite.domicilio_negocio}, {datos.tramite.colonia}</dd></div>
                <div><dt className="font-bold">Superficie:</dt> <dd>{datos.tramite.superficie_m2} m²</dd></div>
                <div><dt className="font-bold">Situación:</dt> <dd><EtiquetaEstado tramite={datos.tramite} /></dd></div>
              </dl>
            </section>

            <section aria-labelledby="exp-dependencias">
              <h3 id="exp-dependencias" className="text-xl font-bold text-cafe">Revisión por dependencia</h3>
              <ul className="mt-3 grid gap-3">
                {datos.tramite.dependencias.map((item) => (
                  <li key={item.id} className="rounded-control border-2 border-arena bg-papel p-4 text-lg leading-relaxed text-tinta">
                    <strong>{nombreDependencia(item.dependencia_id, catalogo)}:</strong>{' '}
                    {item.estado.replaceAll('_', ' ')}
                    {item.fecha_visita && <> · Visita: {item.fecha_visita}</>}
                    {item.motivo && <> · Motivo: {item.motivo}</>}
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="exp-documentos">
              <h3 id="exp-documentos" className="text-xl font-bold text-cafe">Documentos adjuntos</h3>
              {datos.documentos.length === 0 ? (
                <p className="mt-3 flex items-start gap-3 rounded-control border-l-8 border-semaforo-gris bg-semaforo-fondo-gris p-4 text-lg leading-relaxed text-tinta">
                  <Info aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" />
                  No hay documentos registrados.
                </p>
              ) : (
                <ul className="mt-3 grid gap-3">
                  {datos.documentos.map((doc) => (
                    <li key={doc.id} className="rounded-control border-2 border-arena bg-papel p-4 text-lg leading-relaxed text-tinta">
                      {doc.tipo.replaceAll('_', ' ')} · {doc.mime} · {fechaLegible(doc.created_at)}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="exp-historial">
              <h3 id="exp-historial" className="text-xl font-bold text-cafe">Historial reciente</h3>
              <ol className="mt-3 grid gap-3 border-l-8 border-barro pl-4">
                {datos.historial.map((evento) => (
                  <li key={evento.id} className="text-lg leading-relaxed text-tinta">
                    <strong>{ACCIONES[evento.accion] ?? evento.accion}</strong>
                    <br />
                    <span>{fechaLegible(evento.created_at)} · {evento.actor_rol}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
