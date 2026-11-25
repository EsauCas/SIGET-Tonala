'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Aviso } from '@/components/EstadosVista';
import {
  BOTON_PRIMARIO,
  CLASE_CAMPO,
  CLASE_ETIQUETA,
  CLASE_ERROR
} from '@/components/layout/estilos';
import { useRepository } from '@/components/RepositoryProvider';
import { validarArchivoEvidencia } from '@/lib/archivos';
import { canTransition } from '@/lib/domain/estado-tramite';
import type { TramiteDependencia } from '@/types/database';

export interface SubirEvidenciaProps {
  tramiteId: string;
  dependencia: TramiteDependencia;
  nombreDependencia: string;
  onCompletado: () => void;
}

/** Evidencia ciudadana: valida el archivo y reanuda la revisión vía repositorio. */
export function SubirEvidencia({
  tramiteId,
  dependencia,
  nombreDependencia,
  onCompletado
}: SubirEvidenciaProps) {
  const { repositorio, listo } = useRepository();
  const { actor } = useAuth();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [completado, setCompletado] = useState(false);

  const puedeSubir = canTransition('ciudadano', dependencia.estado, 'en_inspeccion');

  function seleccionar(evento: ChangeEvent<HTMLInputElement>): void {
    const seleccionado = evento.target.files?.[0] ?? null;
    setArchivo(seleccionado);
    setCompletado(false);
    setAviso('');
    const problema = seleccionado ? validarArchivoEvidencia(seleccionado) : null;
    setError(problema ?? '');
  }

  async function entregar(): Promise<void> {
    setError('');
    setAviso('');
    if (!puedeSubir) {
      setError('Este trámite ya no está esperando tu documento. Si fue rechazado, llama a la ventanilla.');
      return;
    }
    if (!archivo) {
      setError('Primero elige un archivo PDF, JPG o PNG de menos de 5 MB.');
      return;
    }
    const problema = validarArchivoEvidencia(archivo);
    if (problema) {
      setError(problema);
      return;
    }
    if (!actor || !repositorio || !listo) {
      setError('El sistema todavía está cargando o no identificó tu sesión. Inténtalo de nuevo.');
      return;
    }

    setOcupado(true);
    try {
      const subida = await repositorio.subirArchivo({
        tramiteId,
        archivo,
        tipo: 'evidencia'
      });
      await repositorio.agregarEvidencia({
        actor,
        tramiteDependenciaId: dependencia.id,
        tipo: 'evidencia',
        nombreArchivo: subida.nombreArchivo,
        mime: subida.mime,
        sizeBytes: subida.sizeBytes,
        storagePath: subida.storagePath,
        contenidoBase64: subida.contenidoBase64
      });
      setArchivo(null);
      setCompletado(true);
      setAviso('Documento entregado. La dependencia volverá a revisar tu local.');
      onCompletado();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo entregar el documento. Inténtalo de nuevo.');
    } finally {
      setOcupado(false);
    }
  }

  if (!puedeSubir) {
    return (
      <p className="flex items-start gap-3 rounded-control border-l-8 border-semaforo-gris bg-semaforo-fondo-gris p-4 text-lg leading-relaxed text-tinta">
        <Info aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" />
        {nombreDependencia} no está esperando documentos en este momento.
      </p>
    );
  }

  const idArchivo = `evidencia-${dependencia.id}`;
  const idError = `error-evidencia-${dependencia.id}`;

  return (
    <div className="grid gap-3 rounded-control border-2 border-l-8 border-arena border-l-semaforo-rojo bg-semaforo-fondo-rojo p-4">
      <label className={CLASE_ETIQUETA} htmlFor={idArchivo}>
        Entrega el documento que pide {nombreDependencia} (obligatorio)
      </label>
      <input
        id={idArchivo}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className={CLASE_CAMPO}
        onChange={seleccionar}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? idError : undefined}
      />
      <p className="text-lg font-semibold text-tinta">PDF, JPG o PNG. Máximo 5 MB.</p>

      {error && (
        <p id={idError} role="alert" className={`${CLASE_ERROR} flex items-start gap-2`}>
          <AlertTriangle aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" />
          {error}
        </p>
      )}
      <Aviso mensaje={aviso} exito={completado} />

      <button
        type="button"
        disabled={ocupado}
        onClick={() => void entregar()}
        className={`${BOTON_PRIMARIO} disabled:cursor-not-allowed disabled:border-2 disabled:border-arena disabled:bg-arena disabled:text-tinta`}
      >
        {ocupado ? 'Entregando documento...' : 'Entregar documento y continuar revisión'}
      </button>
    </div>
  );
}
