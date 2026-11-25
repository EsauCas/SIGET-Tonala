'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useCorreos } from '@/components/EmailLogToast';
import { Aviso } from '@/components/EstadosVista';
import { IndicadorPasos } from '@/components/layout/IndicadorPasos';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from '@/components/layout/estilos';
import { CamposSolicitud } from '@/components/CamposSolicitud';
import { OcrScanner } from '@/components/OcrScanner';
import { useRepository } from '@/components/RepositoryProvider';
import { borrarBorrador, guardarBorrador, leerBorrador } from '@/lib/borrador';
import { CORREOS_EJEMPLO } from '@/lib/catalogos';
import { renderizarCorreo } from '@/lib/email-templates';
import {
  aCrearTramiteInput,
  crearFormaVacia,
  hoyISO,
  primerError,
  validarSolicitud,
  type CampoSolicitud,
  type DatosSolicitud,
  type ErroresSolicitud
} from '@/lib/validacion-solicitud';
import type { CampoSolicitudOcr, ResultadoOcr } from '@/types/ocr';
import type { ClaveDependencia, Tramite } from '@/types/database';

type Paso = 1 | 2 | 3;

const PASOS: readonly string[] = ['Escanear o capturar', 'Datos del negocio', 'Confirmación'];

function almacenSession(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Asistente de tres pantallas: una acción principal por pantalla. */
export function AsistenteTramite() {
  const { repositorio, listo } = useRepository();
  const { actor, perfil } = useAuth();
  const procesarCorreos = useCorreos();
  const [paso, setPaso] = useState<Paso>(1);
  const [forma, setForma] = useState<DatosSolicitud>(crearFormaVacia);
  const [errores, setErrores] = useState<ErroresSolicitud>({});
  const [aviso, setAviso] = useState('');
  const [avisoCorreo, setAvisoCorreo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [creado, setCreado] = useState<Tramite | null>(null);
  const [revisionOcr, setRevisionOcr] = useState<ResultadoOcr | null>(null);
  const [hidratado, setHidratado] = useState(false);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const guardado = leerBorrador(almacenSession());
    setForma({
      ...(guardado ?? crearFormaVacia()),
      fecha_solicitud: guardado?.fecha_solicitud || hoyISO()
    });
    setHidratado(true);
  }, []);

  useEffect(() => {
    if (!hidratado || creado) return;
    guardarBorrador(almacenSession(), forma);
  }, [creado, forma, hidratado]);

  useEffect(() => {
    tituloRef.current?.focus();
  }, [paso]);

  function actualizar(campo: CampoSolicitud, valor: string): void {
    setForma((anterior) => ({ ...anterior, [campo]: valor }));
    setErrores((anterior) => ({ ...anterior, [campo]: undefined }));
  }

  function alternarDependencia(clave: ClaveDependencia): void {
    setForma((anterior) => ({
      ...anterior,
      dependenciasRequeridas: anterior.dependenciasRequeridas.includes(clave)
        ? anterior.dependenciasRequeridas.filter((item) => item !== clave)
        : [...anterior.dependenciasRequeridas, clave]
    }));
    setErrores((anterior) => ({ ...anterior, dependenciasRequeridas: undefined }));
  }

  function aplicarOcr(resultado: ResultadoOcr): void {
    const campos = resultado.campos;
    setRevisionOcr(resultado);
    setForma((anterior) => {
      const siguiente: DatosSolicitud = { ...anterior };
      const llaves: readonly CampoSolicitudOcr[] = [
        'numero_control',
        'folio',
        'fecha_solicitud',
        'nombre_contribuyente',
        'domicilio_contribuyente',
        'domicilio_negocio',
        'colonia',
        'cp',
        'telefono',
        'tipo_tramite',
        'giro_principal',
        'giros_anexos',
        'superficie_m2',
        'inversion_estimada'
      ];
      for (const llave of llaves) {
        const campo = campos[llave];
        if (campo) siguiente[llave] = campo.valor;
      }
      return siguiente;
    });
    setAviso(
      resultado.faltantes.length > 0
        ? `La lectura terminó, pero faltan ${resultado.faltantes.length} datos. Capta los que estén vacíos antes de continuar.`
        : resultado.formato === 'desconocido'
          ? 'No reconocemos el formato. Revisa los datos antes de continuar.'
          : 'Datos leídos. Revísalos y corrige lo que haga falta antes de guardar.'
    );
    setPaso(2);
  }

  function avanzar(): void {
    const encontrados = validarSolicitud(forma);
    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados);
      setAviso(primerError(encontrados) ?? 'Revisa los datos marcados.');
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setErrores({});
    setAviso('');
    setPaso(3);
  }

  async function guardar(): Promise<void> {
    const encontrados = validarSolicitud(forma);
    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados);
      setAviso(primerError(encontrados) ?? 'Revisa los datos marcados.');
      setPaso(2);
      return;
    }
    if (!actor || !repositorio || !listo) {
      setAviso('El sistema todavía está cargando o no identificó tu sesión. Inténtalo de nuevo.');
      return;
    }

    setGuardando(true);
    setAviso('');
    setAvisoCorreo('');
    try {
      const tramite = await repositorio.crearTramite(aCrearTramiteInput(actor, forma));
      const claveCorreo = `confirmacion-${tramite.id}`;
      const correo = renderizarCorreo('confirmacion_tramite', {
        folio: tramite.folio,
        nombreCiudadano: tramite.nombre_contribuyente
      });
      try {
        await repositorio.encolarNotificacion({
          tramiteId: tramite.id,
          destinatario: perfil?.email ?? CORREOS_EJEMPLO.ventanilla,
          plantilla: 'confirmacion_tramite',
          asunto: correo.asunto,
          cuerpo: correo.texto,
          claveIdempotencia: claveCorreo
        });
        void procesarCorreos(claveCorreo).catch(() => undefined);
      } catch {
        setAvisoCorreo(
          'Tu solicitud quedó guardada, pero no pudimos registrar el aviso por correo. Guarda tu folio.'
        );
      }
      borrarBorrador(almacenSession());
      setRevisionOcr(null);
      setCreado(tramite);
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No se pudo registrar tu solicitud. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  if (creado) {
    return (
      <section aria-labelledby="alta-exitosa" className="rounded-control border-l-8 border-semaforo-verde bg-semaforo-fondo-verde p-6">
        <h2 id="alta-exitosa" className="text-2xl font-bold text-tinta">
          Tu solicitud quedó registrada
        </h2>
        <p className="mt-2 text-lg leading-relaxed text-tinta">
          Folio: <strong>{creado.folio}</strong>. Guárdalo para dar seguimiento.
        </p>
        <p className="mt-1 text-lg leading-relaxed text-tinta">
          Número de control: <strong>{creado.numero_control}</strong>
        </p>
        <p className="mt-1 text-lg leading-relaxed text-tinta">
          Fecha de solicitud: <strong>{creado.fecha_solicitud}</strong>
        </p>
        <Aviso mensaje={avisoCorreo} exito={false} />
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/tramites/${creado.id}`}
            className={BOTON_PRIMARIO}
          >
            Ver mi solicitud
          </Link>
          <Link
            href="/"
            className={BOTON_SECUNDARIO}
          >
            Volver al inicio
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section id="asistente" aria-labelledby="asistente-titulo" className="grid gap-5">
      <div>
        <div aria-live="polite">
          <IndicadorPasos pasos={PASOS} pasoActual={paso} />
        </div>
        <h2
          id="asistente-titulo"
          ref={tituloRef}
          tabIndex={-1}
          className="mt-5 text-2xl font-bold text-cafe focus:outline-none focus:ring-4 focus:ring-foco"
        >
          {paso === 1
            ? 'Paso 1: Escanear o capturar'
            : paso === 2
              ? 'Paso 2: Datos del negocio'
              : 'Paso 3: Confirmación'}
        </h2>
      </div>

      <Aviso mensaje={aviso} />

      {paso === 1 && (
        <OcrScanner
          formato="solicitud"
          onConfirm={aplicarOcr}
          onCancel={() => setAviso('Puedes capturar los datos a mano cuando quieras.')}
          onManual={() => {
            setAviso('');
            setPaso(2);
          }}
        />
      )}

      {paso === 2 && (
        <>
          <DatosGenerados forma={forma} />
          {revisionOcr && (revisionOcr.faltantes.length > 0 || revisionOcr.advertencias.length > 0) && (
            <section
              aria-labelledby="revision-ocr-titulo"
              className="rounded-control border-l-8 border-semaforo-ambar bg-semaforo-fondo-ambar p-4"
            >
              <h3 id="revision-ocr-titulo" className="text-xl font-bold text-tinta">
                Datos que necesitan tu revisión
              </h3>
              {revisionOcr.faltantes.length > 0 && (
                <>
                  <p className="mt-2 text-lg leading-relaxed text-tinta">
                    La lectura no encontró estos datos. Escríbelos en los campos de abajo.
                  </p>
                  <ul className="mt-2 grid list-inside list-disc gap-1 text-lg text-tinta">
                    {revisionOcr.faltantes.map((faltante) => (
                      <li key={faltante}>{faltante}</li>
                    ))}
                  </ul>
                </>
              )}
              {revisionOcr.advertencias.length > 0 && (
                <ul className="mt-3 grid gap-1 text-lg leading-relaxed text-tinta">
                  {revisionOcr.advertencias.map((aviso) => (
                    <li key={aviso}>• {aviso}</li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <CamposSolicitud
            forma={forma}
            errores={errores}
            onChange={actualizar}
            onAlternarDependencia={alternarDependencia}
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setPaso(1)}
              className={BOTON_SECUNDARIO}
            >
              Atrás
            </button>
            <button
              type="button"
              onClick={avanzar}
              className={BOTON_PRIMARIO}
            >
              Revisar mis datos
            </button>
          </div>
        </>
      )}

      {paso === 3 && (
        <>
          <Resumen forma={forma} />
          <DatosGenerados forma={forma} />
          <p className="text-lg leading-relaxed text-tinta">
            Revisa y corrige cualquier dato antes de guardar. Cuando termines,
            presiona “Guardar mi solicitud”.
          </p>
          <CamposSolicitud
            forma={forma}
            errores={errores}
            onChange={actualizar}
            onAlternarDependencia={alternarDependencia}
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={guardando}
              onClick={() => setPaso(2)}
              className={`${BOTON_SECUNDARIO} disabled:opacity-60`}
            >
              Atrás
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={() => void guardar()}
              className={`${BOTON_PRIMARIO} disabled:opacity-60`}
            >
              {guardando ? 'Guardando tu solicitud...' : 'Guardar mi solicitud'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function Resumen({ forma }: { forma: Readonly<DatosSolicitud> }) {
  const dependencias = forma.dependenciasRequeridas
    .map((clave) => (clave === 'bomberos' ? 'Bomberos Tonalá' : 'Protección Civil Tonalá'))
    .join(' y ');

  return (
    <dl className="grid gap-2 rounded-control border-l-8 border-barro bg-papel p-4 text-lg text-tinta">
      <div>
        <dt className="font-semibold">Persona contribuyente:</dt>
        <dd>{forma.nombre_contribuyente || 'Sin capturar'}</dd>
      </div>
      <div>
        <dt className="font-semibold">Giro principal:</dt>
        <dd>{forma.giro_principal || 'Sin capturar'}</dd>
      </div>
      <div>
        <dt className="font-semibold">Negocio:</dt>
        <dd>
          {forma.domicilio_negocio || 'Sin capturar'}, {forma.colonia || 'sin colonia'} · CP{' '}
          {forma.cp || 'sin capturar'}
        </dd>
      </div>
      <div>
        <dt className="font-semibold">Teléfono:</dt>
        <dd>{forma.telefono || 'Sin capturar'}</dd>
      </div>
      <div>
        <dt className="font-semibold">Quién revisará:</dt>
        <dd>{dependencias || 'Sin seleccionar'}</dd>
      </div>
    </dl>
  );
}

function DatosGenerados({ forma }: { forma: Readonly<DatosSolicitud> }) {
  return (
    <dl className="grid gap-2 rounded-control border-2 border-arena bg-papel p-4 text-lg text-tinta">
      <div>
        <dt className="font-semibold">Folio:</dt>
        <dd>Se asigna solo al guardar.</dd>
      </div>
      <div>
        <dt className="font-semibold">Número de control:</dt>
        <dd>Se asigna solo al guardar.</dd>
      </div>
      <div>
        <dt className="font-semibold">Fecha de solicitud:</dt>
        <dd>{forma.fecha_solicitud}</dd>
      </div>
    </dl>
  );
}
