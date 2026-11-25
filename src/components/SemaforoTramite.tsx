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
  Record<ColorSemaforo, { borde: string; fondo: string; texto: string; barra: string }>
> = {
  gris: { borde: 'border-slate-500', fondo: 'bg-slate-100', texto: 'text-semaforo-gris', barra: 'bg-semaforo-gris' },
  azul: { borde: 'border-semaforo-azul', fondo: 'bg-blue-50', texto: 'text-semaforo-azul', barra: 'bg-semaforo-azul' },
  ambar: { borde: 'border-semaforo-ambar', fondo: 'bg-amber-50', texto: 'text-semaforo-ambar', barra: 'bg-semaforo-ambar' },
  rojo: { borde: 'border-semaforo-rojo', fondo: 'bg-red-50', texto: 'text-semaforo-rojo', barra: 'bg-semaforo-rojo' },
  verde: { borde: 'border-semaforo-verde', fondo: 'bg-green-50', texto: 'text-semaforo-verde', barra: 'bg-semaforo-verde' }
};

const ETIQUETA_DEPENDENCIA: Readonly<Record<EstadoDependencia, string>> = {
  pendiente: 'Pendiente de turno',
  turnado: 'Oficio turnado',
  en_inspeccion: 'En revisión',
  observaciones: 'Observaciones',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado'
};

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
      className={`rounded-control border-4 ${estilo.borde} ${estilo.fondo} p-5`}
    >
      <div className="flex flex-wrap items-center gap-5">
        <IconoEstado color={resultado.color} />
        <div className="min-w-0 flex-1">
          <h2 id={`semaforo-${tramite.id}`} className={`text-2xl font-bold ${estilo.texto}`}>
            {resultado.etiqueta}
          </h2>
          <p className="mt-1 text-lg text-tinta" aria-label={`Paso ${paso} de 5`}>
            Paso {paso} de 5 · {resultado.mensajeCiudadano}
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
        Reloj de dictamen: <strong>{horas.toFixed(1)} horas</strong> transcurridas de {limite} h permitidas.
        {relojPrincipal?.calculo.dictamen.pausado ? ' El reloj está pausado a la espera de tu evidencia.' : ''}
      </p>

      {hayRetraso && (
        <p role="alert" className="mt-3 rounded-control border-2 border-semaforo-rojo bg-white p-3 text-lg font-bold text-semaforo-rojo">
          Retraso detectado: la revisión supera las {limite} h sin dictamen. Llama a la ventanilla para saber qué ocurre.
        </p>
      )}

      {resultado.color === 'rojo' && (
        <div className="mt-4 rounded-control border-2 border-semaforo-rojo bg-white p-4">
          <h3 className="text-xl font-bold text-tinta">¿Qué necesitamos de ti?</h3>
          <p className="mt-1 text-lg text-tinta">{resultado.motivo}</p>
          {puedeAportarEvidencia ? (
            <button
              type="button"
              onClick={abrirEvidencia}
              className="mt-4 inline-flex min-h-control items-center gap-3 rounded-control bg-semaforo-rojo px-5 py-3 text-lg font-bold text-white"
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
                <li key={dependencia.id} className="rounded-control border border-slate-300 bg-white px-4 py-3 text-lg text-tinta">
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
