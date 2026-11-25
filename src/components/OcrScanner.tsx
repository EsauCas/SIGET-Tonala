'use client';

import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileImage,
  Pencil,
  RotateCcw,
  ScanLine,
  X
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import Tesseract from 'tesseract.js';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, CLASE_CAMPO } from '@/components/layout/estilos';
import {
  actualizarResultadoOcr,
  etiquetaCampo,
  procesarTextoOcr
} from '@/lib/ocr-parsers';
import { prepararImagenParaOcr } from '@/lib/ocr-image';
import type { CampoOcr, OcrScannerProps, ResultadoOcr } from '@/types/ocr';

type Fase = 'inicio' | 'preparando' | 'leyendo' | 'revisando' | 'error';

type TrabajadorOcr = Awaited<ReturnType<typeof Tesseract.createWorker>>;

const ETIQUETA_FORMATO: Readonly<Record<OcrScannerProps['formato'], string>> = {
  solicitud: 'solicitud',
  oficio_verificacion: 'oficio de verificación',
  oficio_multidependencia: 'oficio multidependencia',
  desconocido: 'documento sin formato reconocido',
  auto: 'documento'
};

/** Escáner real con Tesseract local. El resultado llega al padre sólo tras Confirmar. */
export function OcrScanner(props: OcrScannerProps) {
  const idBase = useId();
  const [fase, setFase] = useState<Fase>('inicio');
  const [mensaje, setMensaje] = useState('');
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<ResultadoOcr | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const trabajador = useRef<TrabajadorOcr | null>(null);
  const cancelado = useRef(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      cancelado.current = true;
      const actual = trabajador.current;
      trabajador.current = null;
      if (actual) void actual.terminate().catch(() => undefined);
    };
  }, []);

  async function liberarTrabajador(): Promise<void> {
    const actual = trabajador.current;
    trabajador.current = null;
    if (actual) {
      try {
        await actual.terminate();
      } catch {
        // El worker ya se cerró; no afecta al resultado leído.
      }
    }
  }

  async function leerArchivo(archivo: File | undefined): Promise<void> {
    if (!archivo) return;
    cancelado.current = false;
    setError('');
    setResultado(null);
    setValores({});
    setProgreso(0);

    try {
      setFase('preparando');
      setMensaje('Preparando la foto para leerla…');
      const preparado = await prepararImagenParaOcr(archivo);
      if (cancelado.current || !montado.current) return;

      setFase('leyendo');
      setMensaje('Leyendo tu documento… 0%');
      const trabajadorNuevo = await Tesseract.createWorker('spa', Tesseract.OEM.LSTM_ONLY, {
        workerPath: '/tesseract/worker.min.js',
        corePath: '/tesseract/core',
        langPath: '/tesseract/lang',
        gzip: false,
        logger: (avance) => {
          if (cancelado.current || !montado.current) return;
          if (avance.status === 'recognizing text' && typeof avance.progress === 'number') {
            const porcentaje = Math.round(avance.progress * 100);
            setProgreso(porcentaje);
            setMensaje(`Leyendo tu documento… ${porcentaje}%`);
          } else if (avance.status === 'loading language traineddata') {
            setMensaje('Preparando el idioma español…');
          } else if (avance.status === 'initializing api') {
            setMensaje('Preparando la lectura…');
          }
        }
      });
      trabajador.current = trabajadorNuevo;
      if (cancelado.current || !montado.current) return;

      const { data } = await trabajadorNuevo.recognize(preparado.canvas);
      if (cancelado.current || !montado.current) return;

      const leido = procesarTextoOcr(data.text ?? '', props.formato, {
        ...(typeof data.confidence === 'number' ? { confianzaGlobal: data.confidence } : {}),
        imagen: preparado.imagen
      });
      setResultado(leido);
      setValores(
        Object.fromEntries(
          Object.entries(leido.campos).map(([clave, campo]) => [clave, campo?.valor ?? ''])
        )
      );
      setMensaje(
        leido.formato === 'desconocido'
          ? 'No reconocemos este formato. Puedes capturar los datos a mano.'
          : 'Lectura terminada. Revisa cada dato antes de continuar.'
      );
      setFase('revisando');
    } catch (fallo) {
      if (!cancelado.current && montado.current) {
        setError(
          fallo instanceof Error ? fallo.message : 'No pudimos leer la imagen. Inténtalo otra vez.'
        );
        setFase('error');
      }
    } finally {
      await liberarTrabajador();
    }
  }

  function alSeleccionar(evento: ChangeEvent<HTMLInputElement>): void {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    void leerArchivo(archivo);
  }

  function cancelar(): void {
    cancelado.current = true;
    void liberarTrabajador().then(() => {
      if (!montado.current) return;
      setFase('inicio');
      setProgreso(0);
      setMensaje('Lectura cancelada. Puedes intentarlo de nuevo.');
    });
    props.onCancel();
  }

  function confirmar(): void {
    if (!resultado || props.confirmarDeshabilitado || resultado.formato === 'desconocido') return;
    props.onConfirm(actualizarResultadoOcr(resultado, valores));
    setResultado(null);
    setValores({});
    setFase('inicio');
    setMensaje('');
  }

  function corregirAMano(): void {
    const primerCampo = Object.keys(valores)[0];
    if (primerCampo) document.getElementById(`${idBase}-${primerCampo}`)?.focus();
    setMensaje('Puedes corregir cualquier dato. Nada se guarda hasta que confirmes.');
  }

  if (props.confirmarDeshabilitado) {
    return (
      <section
        aria-labelledby={`${idBase}-titulo`}
        className="rounded-control border-2 border-arena bg-superficie p-5"
      >
        <h2 id={`${idBase}-titulo`} className="text-xl font-bold text-tinta">
          Escaneo de {ETIQUETA_FORMATO[props.formato]}
        </h2>
        <p aria-live="polite" className="mt-2 text-lg leading-relaxed text-tinta">
          Tu perfil no puede confirmar acuses. La lectura automática está reservada a la ventanilla.
        </p>
      </section>
    );
  }

  const campos = Object.entries(resultado?.campos ?? {}) as [string, CampoOcr | undefined][];
  const esDesconocido = resultado?.formato === 'desconocido';
  const ocupado = fase === 'preparando' || fase === 'leyendo';

  return (
    <section
      aria-labelledby={`${idBase}-titulo`}
      className="rounded-control border-2 border-arena bg-superficie p-5"
    >
      <p className="text-lg font-semibold text-cafe">Lectura del documento</p>
      <div className="mt-3 flex items-start gap-4">
        <ScanLine aria-hidden="true" className="mt-1 h-10 w-10 shrink-0 text-barro" />
        <div className="min-w-0 flex-1">
          <h2 id={`${idBase}-titulo`} className="text-xl font-bold text-tinta">
            {fase === 'revisando' ? 'Revisa los datos leídos' : `Escaneo de ${ETIQUETA_FORMATO[props.formato]}`}
          </h2>
          <p aria-live="polite" className="mt-2 text-lg leading-relaxed text-tinta">
            {mensaje || (fase === 'inicio'
              ? 'Acerca la cámara y evita sombras. Si no permites la cámara, elige una imagen guardada o captura los datos a mano. Nada se guarda sin tu confirmación.'
              : '')}
          </p>

          {ocupado && (
            <div className="mt-4" role="status" aria-live="polite">
              <div
                className="h-3 w-full overflow-hidden rounded-full bg-arena"
                aria-hidden="true"
              >
                <div className="h-full bg-barro" style={{ width: `${progreso}%` }} />
              </div>
              <button
                type="button"
                onClick={cancelar}
                className={`mt-3 ${BOTON_SECUNDARIO}`}
              >
                <X aria-hidden="true" className="h-5 w-5" /> Cancelar lectura
              </button>
            </div>
          )}

          {fase === 'inicio' && (
            <div className="mt-4 flex flex-wrap gap-3">
              <label
                htmlFor={`${idBase}-camara`}
                className={`${BOTON_PRIMARIO} cursor-pointer`}
              >
                <Camera aria-hidden="true" className="h-5 w-5" /> Tomar foto
              </label>
              <input
                id={`${idBase}-camara`}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/bmp"
                capture="environment"
                onChange={alSeleccionar}
                className="sr-only"
              />
              <label
                htmlFor={`${idBase}-archivo`}
                className={`${BOTON_SECUNDARIO} cursor-pointer`}
              >
                <FileImage aria-hidden="true" className="h-5 w-5" /> Elegir imagen
              </label>
              <input
                id={`${idBase}-archivo`}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/bmp"
                onChange={alSeleccionar}
                className="sr-only"
              />
              {props.onManual && (
                <button
                  type="button"
                  onClick={props.onManual}
                  className={BOTON_SECUNDARIO}
                >
                  <Pencil aria-hidden="true" className="h-5 w-5" /> Capturar datos a mano
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-control border-l-8 border-semaforo-rojo bg-semaforo-fondo-rojo p-4">
              <p aria-live="assertive" className="flex items-start gap-2 text-lg font-bold text-tinta">
                <AlertTriangle aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" /> {error}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setFase('inicio');
                    setMensaje('');
                  }}
                  className={BOTON_PRIMARIO}
                >
                  <RotateCcw aria-hidden="true" className="h-5 w-5" /> Intentar de nuevo
                </button>
                {props.onManual && (
                  <button
                    type="button"
                    onClick={props.onManual}
                    className={BOTON_SECUNDARIO}
                  >
                    Capturar a mano
                  </button>
                )}
              </div>
            </div>
          )}

          {fase === 'revisando' && resultado && (
            <div className="mt-5 grid gap-5">
              {resultado.advertencias.length > 0 && (
                <ul className="grid gap-2 rounded-control border-l-8 border-semaforo-ambar bg-semaforo-fondo-ambar p-4 text-lg leading-relaxed text-tinta">
                  {resultado.advertencias.map((aviso) => (
                    <li key={aviso} className="flex items-start gap-2">
                      <AlertTriangle aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" /> {aviso}
                    </li>
                  ))}
                </ul>
              )}

              {esDesconocido ? (
                <div className="rounded-control border-2 border-arena bg-papel p-4">
                  <p className="text-lg leading-relaxed text-tinta">
                    Guardamos el texto leído para que no pierdas tu trabajo. No podemos llenar los
                    campos automáticamente con este formato.
                  </p>
                  {props.onManual && (
                    <button
                      type="button"
                      onClick={props.onManual}
                      className={`mt-3 ${BOTON_PRIMARIO}`}
                    >
                      Capturar datos a mano
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    {campos.map(([clave, campo]) => {
                      const id = `${idBase}-${clave}`;
                      const requiere = campo?.requiereValidacion === true || !valores[clave];
                      return (
                        <div key={clave} className="grid gap-1">
                          <label htmlFor={id} className="text-lg font-bold text-tinta">
                            {etiquetaCampo(clave)}
                          </label>
                          <input
                            id={id}
                            type="text"
                            value={valores[clave] ?? ''}
                            aria-describedby={`${id}-detalle`}
                            onChange={(evento) =>
                              setValores((anterior) => ({ ...anterior, [clave]: evento.target.value }))
                            }
                            className={CLASE_CAMPO}
                          />
                          <p id={`${id}-detalle`} className="flex flex-wrap gap-x-4 gap-y-1 text-base font-semibold text-tinta">
                            <span>Confianza: {campo?.confianza ?? 0}%</span>
                            {requiere && (
                              <span className="inline-flex items-center gap-1 font-bold">
                                <AlertTriangle aria-hidden="true" className="h-5 w-5" /> Requiere validación: revisa este dato
                              </span>
                            )}
                            {campo?.validadoPorHumano && (
                              <span className="inline-flex items-center gap-1">
                                <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> Revisado por ti
                              </span>
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={confirmar}
                      className={BOTON_PRIMARIO}
                    >
                      <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
                      {props.etiquetaConfirmar ?? 'Confirmar datos leídos'}
                    </button>
                    <button
                      type="button"
                      onClick={corregirAMano}
                      className={BOTON_SECUNDARIO}
                    >
                      <Pencil aria-hidden="true" className="h-5 w-5" /> Corregir a mano
                    </button>
                    <button
                      type="button"
                      onClick={cancelar}
                      className="min-h-control rounded-control border-2 border-bordeCampo bg-superficie px-6 py-3 text-lg font-semibold text-tinta"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
