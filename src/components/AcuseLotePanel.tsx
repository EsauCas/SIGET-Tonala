'use client';

import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Aviso } from '@/components/EstadosVista';
import { OcrScanner } from '@/components/OcrScanner';
import { useRepository } from '@/components/RepositoryProvider';
import { prepararArchivoOcr } from '@/lib/ocr-integracion';
import type { ResultadoOcr } from '@/types/ocr';

/** Parser C: acuse multidependencia con actualización en cascada e idempotente. */
export function AcuseLotePanel({ onListo }: { onListo?: () => void }) {
  const { repositorio, listo } = useRepository();
  const { actor } = useAuth();
  const [mensaje, setMensaje] = useState('');
  const [exito, setExito] = useState(true);
  const [foliosNoEncontrados, setFoliosNoEncontrados] = useState<string[]>([]);
  const [procesando, setProcesando] = useState(false);

  const sinPermiso = !actor || !listo || actor.rol !== 'secretaria';

  async function confirmar(resultado: ResultadoOcr): Promise<void> {
    if (!actor || !repositorio || !listo || actor.rol !== 'secretaria') return;
    const oficio = resultado.oficio;
    if (!oficio) {
      setExito(false);
      setMensaje('No pudimos leer los datos del oficio. Cápturalos a mano.');
      return;
    }

    setProcesando(true);
    setMensaje('');
    setFoliosNoEncontrados([]);
    try {
      const imagen = await prepararArchivoOcr(
        repositorio,
        actor,
        resultado.imagen,
        oficio.solicitudes
      );
      const respuesta = await repositorio.registrarAcuseLote({
        actor,
        numero_oficio: oficio.numero_oficio,
        acuseFolio: oficio.acuse?.folio ?? '',
        ...(oficio.acuse?.fecha ? { acuseFecha: oficio.acuse.fecha } : {}),
        ...(oficio.acuse?.hora ? { acuseHora: oficio.acuse.hora } : {}),
        solicitudes: oficio.solicitudes.map((solicitud) => ({
          numero_control: solicitud.numero_control,
          folio: solicitud.folio,
          giros: solicitud.giros
        })),
        ...(imagen ? { imagen } : {})
      });
      setExito(true);
      setMensaje(respuesta.aviso);
      setFoliosNoEncontrados(respuesta.foliosNoEncontrados);
      onListo?.();
    } catch (error) {
      setExito(false);
      setMensaje(error instanceof Error ? error.message : 'No se pudo registrar el acuse en lote.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <section
      aria-labelledby="acuse-lote-titulo"
      className="rounded-control border-2 border-slate-300 bg-white p-5"
    >
      <h2 id="acuse-lote-titulo" className="text-xl font-bold text-tinta">
        Carga de acuse en lote
      </h2>
      <p className="mt-2 text-lg leading-relaxed text-tinta">
        Sube la foto del oficio que trae varios folios. Cada solicitud se revisa antes de actualizar
        los expedientes. Los folios que no se encuentren se listan al final; nada se duplica si se
        repite el mismo acuse.
      </p>

      <div className="mt-4">
        <Aviso mensaje={procesando ? 'Guardando el lote confirmado...' : mensaje} exito={exito} />
      </div>

      {foliosNoEncontrados.length > 0 && (
        <div className="mt-3 rounded-control border-2 border-semaforo-ambar bg-amber-50 p-4">
          <h3 className="flex items-start gap-2 text-lg font-bold text-tinta">
            <AlertTriangle aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" />
            Folios que no se encontraron
          </h3>
          <ul className="mt-2 grid list-inside list-disc gap-1 text-lg text-tinta">
            {foliosNoEncontrados.map((folio) => (
              <li key={folio}>{folio}</li>
            ))}
          </ul>
          <p className="mt-2 text-lg leading-relaxed text-tinta">
            Los demás expedientes sí se actualizaron. Revisa estos folios y captúralos a mano si hace falta.
          </p>
        </div>
      )}

      <div className="mt-4">
        <OcrScanner
          formato="oficio_multidependencia"
          confirmarDeshabilitado={sinPermiso}
          etiquetaConfirmar="Confirmar lote y actualizar expedientes"
          onConfirm={(resultado) => void confirmar(resultado)}
          onCancel={() => {
            setMensaje('');
            setFoliosNoEncontrados([]);
            setProcesando(false);
          }}
        />
      </div>
    </section>
  );
}
