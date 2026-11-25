'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Aviso } from '@/components/EstadosVista';
import { OcrScanner } from '@/components/OcrScanner';
import { useRepository } from '@/components/RepositoryProvider';
import { prepararArchivoOcr } from '@/lib/ocr-integracion';
import type { ResultadoOcr } from '@/types/ocr';

/**
 * Parser B. La lectura sólo propone datos: el repositorio no se llama hasta
 * que la ventanilla confirma la revisión editable del OcrScanner.
 */
export function AcuseIndividualPanel({ onListo }: { onListo?: () => void }) {
  const { repositorio, listo } = useRepository();
  const { actor } = useAuth();
  const [mensaje, setMensaje] = useState('');
  const [exito, setExito] = useState(true);
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
    try {
      const imagen = await prepararArchivoOcr(
        repositorio,
        actor,
        resultado.imagen,
        oficio.solicitudes
      );
      const respuesta = await repositorio.registrarAcuseOficio({
        actor,
        numero_oficio: oficio.numero_oficio,
        selloFolio: oficio.sello?.folio ?? '',
        ...(oficio.sello?.fecha ? { selloFecha: oficio.sello.fecha } : {}),
        ...(oficio.sello?.hora ? { selloHora: oficio.sello.hora } : {}),
        ...(imagen ? { imagen } : {})
      });
      setExito(true);
      setMensaje(respuesta.aviso);
      onListo?.();
    } catch (error) {
      setExito(false);
      setMensaje(error instanceof Error ? error.message : 'No se pudo registrar el acuse leído.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <section
      aria-labelledby="acuse-individual-titulo"
      className="rounded-control border-2 border-slate-300 bg-white p-5"
    >
      <h2 id="acuse-individual-titulo" className="text-xl font-bold text-tinta">
        Registrar acuse con lectura automática
      </h2>
      <p className="mt-2 text-lg leading-relaxed text-tinta">
        Toma una foto del oficio sellado. Revisa cada dato y confírmalo: hasta entonces no se detiene
        ningún reloj ni cambia el expediente.
      </p>

      <div className="mt-4">
        <Aviso mensaje={procesando ? 'Guardando el acuse confirmado...' : mensaje} exito={exito} />
      </div>

      <div className="mt-4">
        <OcrScanner
          formato="oficio_verificacion"
          confirmarDeshabilitado={sinPermiso}
          etiquetaConfirmar="Confirmar acuse y detener reloj"
          onConfirm={(resultado) => void confirmar(resultado)}
          onCancel={() => {
            setMensaje('');
            setProcesando(false);
          }}
        />
      </div>
    </section>
  );
}
