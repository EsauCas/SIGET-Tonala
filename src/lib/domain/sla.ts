import { now } from '@/lib/reloj-demo';
import type { TipoHoras } from '@/types/database';

export interface ConfiguracionSlaCalculo {
  horas_limite: number;
  horas_alerta_previa: number;
  tipo_horas: TipoHoras;
}

export interface RelojSlaCalculo {
  turnado_at: string | null;
  acuse_at?: string | null;
  dictamen_at?: string | null;
  pausado_desde?: string | null;
  horas_pausadas?: number;
}

export type CategoriaSla = 'en_tiempo' | 'por_vencer' | 'vencido';

/** Valores configurables por defecto; la app usa siempre configuracion_sla cuando existe. */
export const CONFIGURACION_PREDETERMINADA: ConfiguracionSlaCalculo = {
  horas_limite: 72,
  horas_alerta_previa: 48,
  tipo_horas: 'naturales'
};

export interface ResultadoSla {
  entrega: {
    iniciado: boolean;
    transcurrido_horas: number;
    detenido_en: string | null;
  };
  dictamen: {
    iniciado: boolean;
    transcurrido_horas: number;
    limite_horas: number;
    categoria: CategoriaSla;
    pausado: boolean;
  };
}

const HORA_MS = 60 * 60 * 1000;
const HABIL_APERTURA = 9;
const HABIL_CIERRE = 17;

/** Horas naturales transcurridas entre dos fechas ISO (nunca negativas). */
export function horasNaturalesEntre(inicio: Date, fin: Date): number {
  if (fin.getTime() <= inicio.getTime()) return 0;
  return (fin.getTime() - inicio.getTime()) / HORA_MS;
}

/**
 * Horas hábiles (lunes a viernes, 9:00-17:00 hora local) entre dos fechas.
 * Función pura: no consulta calendarios oficiales ni festivos.
 */
export function horasHabilesEntre(inicio: Date, fin: Date): number {
  if (fin.getTime() <= inicio.getTime()) return 0;

  let milisegundos = 0;
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());

  while (cursor.getTime() < fin.getTime()) {
    const dia = cursor.getDay();
    if (dia >= 1 && dia <= 5) {
      const anio = cursor.getFullYear();
      const mes = cursor.getMonth();
      const fecha = cursor.getDate();
      const apertura = new Date(anio, mes, fecha, HABIL_APERTURA, 0, 0, 0);
      const cierre = new Date(anio, mes, fecha, HABIL_CIERRE, 0, 0, 0);
      const desde = Math.max(inicio.getTime(), apertura.getTime());
      const hasta = Math.min(fin.getTime(), cierre.getTime());
      if (hasta > desde) milisegundos += hasta - desde;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return milisegundos / HORA_MS;
}

export function horasEntre(inicio: Date, fin: Date, tipo: TipoHoras): number {
  return tipo === 'habiles' ? horasHabilesEntre(inicio, fin) : horasNaturalesEntre(inicio, fin);
}

/**
 * Categorías calculadas desde la configuración, no con números fijos:
 * antes de la alerta = en tiempo; desde la alerta hasta el límite = por vencer;
 * después del límite = vencido. Los límites exactos (48 y 72) son "por vencer".
 */
export function categorizarSla(
  horasTranscurridas: number,
  configuracion: ConfiguracionSlaCalculo
): CategoriaSla {
  if (horasTranscurridas < configuracion.horas_alerta_previa) return 'en_tiempo';
  if (horasTranscurridas <= configuracion.horas_limite) return 'por_vencer';
  return 'vencido';
}

function fecha(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const resultado = new Date(valor);
  return Number.isNaN(resultado.getTime()) ? null : resultado;
}

/**
 * Calcula los dos relojes: entrega (turnado -> acuse, sin pausa) y dictamen
 * (turnado -> dictamen, con pausa mientras el estado es observaciones).
 */
export function calcularSla(
  reloj: RelojSlaCalculo,
  configuracion: ConfiguracionSlaCalculo,
  ahora: Date = now()
): ResultadoSla {
  const inicio = fecha(reloj.turnado_at);
  if (!inicio) {
    return {
      entrega: { iniciado: false, transcurrido_horas: 0, detenido_en: null },
      dictamen: {
        iniciado: false,
        transcurrido_horas: 0,
        limite_horas: configuracion.horas_limite,
        categoria: 'en_tiempo',
        pausado: false
      }
    };
  }

  const finEntrega = fecha(reloj.acuse_at) ?? ahora;
  const finDictamen = fecha(reloj.dictamen_at) ?? ahora;
  const tipo = configuracion.tipo_horas;

  const pausaAcumulada = reloj.horas_pausadas ?? 0;
  const inicioPausa = fecha(reloj.pausado_desde);
  const pausaActual = inicioPausa ? horasEntre(inicioPausa, finDictamen, tipo) : 0;
  const transcurridoDictamen = Math.max(
    0,
    horasEntre(inicio, finDictamen, tipo) - pausaAcumulada - pausaActual
  );

  return {
    entrega: {
      iniciado: true,
      transcurrido_horas: horasEntre(inicio, finEntrega, tipo),
      detenido_en: reloj.acuse_at ?? null
    },
    dictamen: {
      iniciado: true,
      transcurrido_horas: transcurridoDictamen,
      limite_horas: configuracion.horas_limite,
      categoria: categorizarSla(transcurridoDictamen, configuracion),
      pausado: inicioPausa !== null
    }
  };
}

/** Registra el inicio de la espera al ciudadano (estado observaciones). */
export function iniciarPausa(ahora: Date = now()): string {
  return ahora.toISOString();
}

/** Reanuda el reloj y acumula el tiempo de espera al ciudadano. */
export function finalizarPausa(
  pausadoDesde: string,
  horasPausadasAcumuladas: number,
  ahora: Date,
  tipo: TipoHoras
): { pausado_desde: null; horas_pausadas: number } {
  const inicio = new Date(pausadoDesde);
  if (Number.isNaN(inicio.getTime())) {
    throw new Error('La fecha de inicio de la pausa no es válida.');
  }
  const acumuladas = Math.max(0, horasPausadasAcumuladas);
  return {
    pausado_desde: null,
    horas_pausadas: acumuladas + horasEntre(inicio, ahora, tipo)
  };
}
