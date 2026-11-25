'use client';

import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { canTransition, deriveEstadoGeneral } from '@/lib/domain/estado-tramite';
import { CONFIGURACION_PREDETERMINADA, calcularSla, type ConfiguracionSlaCalculo } from '@/lib/domain/sla';
import { now } from '@/lib/reloj-demo';
import type {
  ColorSemaforo,
  ConfiguracionSla,
  Dependencia,
  EstadoDependencia,
  EtapaGeneral,
  TramiteConDetalle
} from '@/types/database';

export interface SemaforoTramiteProps {
  tramite: TramiteConDetalle;
  configuracionSla: readonly ConfiguracionSla[];
  catalogoDependencias?: readonly Dependencia[];
  ahora?: Date;
  onSubirEvidencia?: () => void;
}

const PASO: Readonly<Record<EtapaGeneral, number>> = {
  recepcion: 1,
  turnado: 2,
  verificacion: 3,
  observaciones: 4,
  aprobado: 5
};

const ESTILO: Readonly<
  Record<ColorSemaforo, { borde: string; fondo: string; barra: string }>
> = {
  gris: { borde: 'border-l-8 border-semaforo-gris', fondo: 'bg-semaforo-fondo-gris', barra: 'bg-semaforo-gris' },
  azul: { borde: 'border-l-8 border-semaforo-azul', fondo: 'bg-semaforo-fondo-azul', barra: 'bg-semaforo-azul' },
  ambar: { borde: 'border-l-8 border-semaforo-ambar', fondo: 'bg-semaforo-fondo-ambar', barra: 'bg-semaforo-ambar' },
  rojo: { borde: 'border-l-8 border-semaforo-rojo', fondo: 'bg-semaforo-fondo-rojo', barra: 'bg-semaforo-rojo' },
  verde: { borde: 'border-l-8 border-semaforo-verde', fondo: 'bg-semaforo-fondo-verde', barra: 'bg-semaforo-verde' }
};

const ETIQUETA_DEPENDENCIA: Readonly<Record<EstadoDependencia, string>> = {
  pendiente: 'Aún no se envía a revisión',
  turnado: 'Enviado a revisión',
  en_inspeccion: 'Revisando el local',
  observaciones: 'Falta documentación',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado'
};

/** Frase que responde "¿qué sigue?" sin jerga administrativa. */
function siguientePaso(etapa: EtapaGeneral, etiqueta: string, limite: number): string {
  if (etiqueta === 'Rechazado') return 'Llama a la ventanilla para saber cómo continuar.';
  const textos: Readonly<Record<EtapaGeneral, string>> = {
    recepcion: 'La ventanilla revisará tu solicitud y la enviará a quien deba verla.',
    turnado: `La dependencia revisará tu local en un plazo de ${limite} horas.`,
    verificacion: `Están revisando tu local. El resultado debe llegar en un plazo de ${limite} horas.`,
    observaciones: 'Sube el documento que falta para que la revisión continúe.',
    aprobado: 'Listo. Ya puedes acudir a ventanilla con tu folio.'
  };
  return textos[etapa];
}

function IconoEstado({ color }: { color: ColorSemaforo }) {
  const propiedades = { width: 76, height: 76, viewBox: '0 0 72 72', 'aria-hidden': true } as const;

  if (color === 'rojo') {
    return (
      <svg {...propiedades}>
        <path d="M36 8 68 64H4Z" fill="#991B1B" />
        <path d="M36 26v18M36 52v3" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      </svg>
    );
  }

  const relleno: Record<'gris' | 'azul' | 'ambar' | 'verde', string> = {
    gris: '#475569',
    azul: '#1D4ED8',
    ambar: '#92400E',
    verde: '#166534'
  };
  const colorFondo = relleno[color === 'gris' || color === 'azul' || color === 'ambar' || color === 'verde' ? color : 'gris'];

  return (
    <svg {...propiedades}>
      <circle cx="36" cy="36" r="29" fill={colorFondo} />
      {color === 'verde' && (
        <path d="m22 37 10 10 19-22" stroke="#FFFFFF" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {color === 'azul' && (
        <path d="M23 36h25M38 26l10 10-10 10" stroke="#FFFFFF" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {color === 'ambar' && (
        <g stroke="#FFFFFF" strokeWidth="5" fill="none" strokeLinecap="round">
          <circle cx="32" cy="32" r="10" />
          <path d="m39 39 12 12" />
        </g>
      )}
      {color === 'gris' && <circle cx="36" cy="36" r="9" fill="#F8FAFC" />}
    </svg>
  );
}

/** Semáforo accesible: color + ícono + etiqueta + paso + reloj + motivo. */
export function SemaforoTramite({
  tramite,
  configuracionSla,
  catalogoDependencias,
  ahora = now(),
  onSubirEvidencia
}: SemaforoTramiteProps) {
  const router = useRouter();
  const resultado = deriveEstadoGeneral(tramite.dependencias);
  const estilo = ESTILO[resultado.color];
  const paso = PASO[resultado.etapa];

  const relojes = tramite.dependencias.map((dependencia) => {
    const configurable = configuracionSla.find(
      (item) => item.dependencia_id === dependencia.dependencia_id
    );
    const configuracion: ConfiguracionSlaCalculo = configurable ?? CONFIGURACION_PREDETERMINADA;
    return {
      dependencia,
      configuracion,
      calculo: calcularSla(dependencia, configuracion, ahora)
    };
  });

  const relojPrincipal = relojes.reduce<(typeof relojes)[number] | null>(
    (seleccionado, actual) =>
      !seleccionado || actual.calculo.dictamen.transcurrido_horas > seleccionado.calculo.dictamen.transcurrido_horas
        ? actual
        : seleccionado,
    null
  );
  const horas = relojPrincipal?.calculo.dictamen.transcurrido_horas ?? 0;
  const limite = relojPrincipal?.configuracion.horas_limite ?? 72;
  const hayRetraso = relojes.some((item) => item.calculo.dictamen.categoria === 'vencido');
  const puedeAportarEvidencia = tramite.dependencias.some((dependencia) =>
    canTransition('ciudadano', dependencia.estado, 'en_inspeccion')
  );
  const pasoPorcentaje = (paso / 5) * 100;

  function abrirEvidencia() {
    if (onSubirEvidencia) {
      onSubirEvidencia();
      return;
    }
    router.push(`/tramites/${tramite.id}#evidencia`);
  }

  return (
    <section
      aria-labelledby={`semaforo-${tramite.id}`}
      className={`rounded-control ${estilo.borde} ${estilo.fondo} p-5`}
    >
      <div aria-hidden="true" className={`mb-4 h-3 w-full rounded-full ${estilo.barra}`} />
      <div className="flex flex-wrap items-center gap-5">
        <IconoEstado color={resultado.color} />
        <div className="min-w-0 flex-1">
          <h2 id={`semaforo-${tramite.id}`} className="text-2xl font-bold text-tinta">
            {resultado.etiqueta}
          </h2>
          <p className="mt-1 text-lg text-tinta" aria-label={`Paso ${paso} de 5`}>
            Paso {paso} de 5 · {resultado.mensajeCiudadano}
          </p>
          <p className="mt-3 rounded-control border-l-4 border-ocre bg-superficie px-3 py-2 text-lg font-semibold text-tinta">
            Lo que sigue: {siguientePaso(resultado.etapa, resultado.etiqueta, limite)}
          </p>
          <div
            className="mt-3 h-4 w-full overflow-hidden rounded-full bg-white"
            role="progressbar"
            aria-valuenow={paso}
            aria-valuemin={1}
            aria-valuemax={5}
            aria-label="Avance del trámite"
          >
            <div className={`h-full ${estilo.barra}`} style={{ width: `${pasoPorcentaje}%` }} />
          </div>
        </div>
      </div>

      <p className="mt-4 text-lg text-tinta" aria-label="Horas transcurridas del reloj de dictamen">
        Tiempo de respuesta: <strong>{horas.toFixed(1)} horas</strong> de {limite} horas disponibles.
        {relojPrincipal?.calculo.dictamen.pausado ? ' El conteo está pausado mientras esperamos tu documento.' : ''}
      </p>

      {hayRetraso && (
        <p role="alert" className="mt-3 rounded-control border-l-8 border-semaforo-rojo bg-white p-3 text-lg font-bold text-tinta">
          Retraso detectado: la revisión supera las {limite} horas sin resultado. Llama a la ventanilla para saber qué ocurre.
        </p>
      )}

      {resultado.color === 'rojo' && (
        <div className="mt-4 rounded-control border-l-8 border-semaforo-rojo bg-white p-4">
          <h3 className="text-xl font-bold text-tinta">¿Qué necesitamos de ti?</h3>
          <p className="mt-1 text-lg text-tinta">{resultado.motivo}</p>
          {puedeAportarEvidencia ? (
            <button
              type="button"
              onClick={abrirEvidencia}
              className="mt-4 inline-flex min-h-control items-center gap-3 rounded-control bg-barro px-5 py-3 text-lg font-bold text-white"
            >
              <Upload aria-hidden="true" className="h-5 w-5" />
              Subir evidencia
            </button>
          ) : (
            <p className="mt-3 text-lg font-semibold text-tinta">
              Si el trámite fue rechazado, llama a la ventanilla para saber qué sigue.
            </p>
          )}
        </div>
      )}

      {tramite.dependencias.length > 0 && (
        <div className="mt-5">
          <h3 className="text-lg font-bold text-tinta">Estado de cada dependencia</h3>
          <ul aria-label="Estado de cada dependencia" className="mt-2 grid gap-2 sm:grid-cols-2">
            {tramite.dependencias.map((dependencia) => {
              const nombre =
                catalogoDependencias?.find((item) => item.id === dependencia.dependencia_id)?.nombre ??
                dependencia.dependencia_id;
              return (
                <li key={dependencia.id} className="rounded-control border-2 border-arena bg-white px-4 py-3 text-lg text-tinta">
                  {nombre}: <strong>{ETIQUETA_DEPENDENCIA[dependencia.estado]}</strong>
                  {dependencia.motivo && ` · ${dependencia.motivo}`}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
