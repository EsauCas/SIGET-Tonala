import { CORREOS_EJEMPLO } from '@/lib/catalogos';
import { deriveEstadoGeneral } from '@/lib/domain/estado-tramite';
import {
  CONFIGURACION_PREDETERMINADA,
  calcularSla,
  type CategoriaSla,
  type ConfiguracionSlaCalculo
} from '@/lib/domain/sla';
import { now } from '@/lib/reloj-demo';
import type { Actor } from '@/lib/repository/types';
import type {
  ClaveDependencia,
  ConfiguracionSla,
  Dependencia,
  Dictamen,
  TramiteConDetalle,
  TramiteDependencia
} from '@/types/database';

/** Reglas puras de la bandeja: filtros, urgencia, claves y validaciones. */

const ANIO_OFICIO = 2026;

export interface ResumenUrgencia {
  iniciado: boolean;
  horas: number;
  limite: number;
  categoria: CategoriaSla;
  pausado: boolean;
}

export function fechaISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function numeroOficio(consecutivo: number): string {
  return `DPL/VF/${String(consecutivo).padStart(4, '0')}/${ANIO_OFICIO}`;
}

export function configuracionPara(
  dependenciaId: string,
  configuracion: readonly ConfiguracionSla[]
): ConfiguracionSlaCalculo {
  return configuracion.find((item) => item.dependencia_id === dependenciaId) ?? CONFIGURACION_PREDETERMINADA;
}

/** Peor reloj de dictamen del trámite: el que decide la urgencia de la fila. */
export function resumenUrgencia(
  tramite: TramiteConDetalle,
  configuracion: readonly ConfiguracionSla[],
  ahora: Date = now()
): ResumenUrgencia {
  let resultado: ResumenUrgencia = {
    iniciado: false,
    horas: 0,
    limite: CONFIGURACION_PREDETERMINADA.horas_limite,
    categoria: 'en_tiempo',
    pausado: false
  };

  for (const dependencia of tramite.dependencias) {
    const calculo = calcularSla(dependencia, configuracionPara(dependencia.dependencia_id, configuracion), ahora);
    const candidato: ResumenUrgencia = {
      iniciado: calculo.dictamen.iniciado,
      horas: calculo.dictamen.transcurrido_horas,
      limite: calculo.dictamen.limite_horas,
      categoria: calculo.dictamen.categoria,
      pausado: calculo.dictamen.pausado
    };
    if (!resultado.iniciado || candidato.horas > resultado.horas) resultado = candidato;
  }
  return resultado;
}

const PRIORIDAD: Readonly<Record<CategoriaSla, number>> = {
  vencido: 0,
  por_vencer: 1,
  en_tiempo: 2
};

/** Vencidos primero; después por vencer, en tiempo y sin reloj. */
export function ordenarPorUrgencia(
  tramites: readonly TramiteConDetalle[],
  configuracion: readonly ConfiguracionSla[],
  ahora: Date = now()
): TramiteConDetalle[] {
  return [...tramites].sort((a, b) => {
    const ua = resumenUrgencia(a, configuracion, ahora);
    const ub = resumenUrgencia(b, configuracion, ahora);
    const prioridadA = ua.iniciado ? PRIORIDAD[ua.categoria] : 3;
    const prioridadB = ub.iniciado ? PRIORIDAD[ub.categoria] : 3;
    if (prioridadA !== prioridadB) return prioridadA - prioridadB;
    if (Math.abs(ub.horas - ua.horas) > 0.01) return ub.horas - ua.horas;
    return b.created_at.localeCompare(a.created_at);
  });
}

/** Bomberos y Protección Civil sólo ven renglones ya turnados a su dependencia. */
export function puedeVerFila(tramite: TramiteConDetalle, actor: Actor | null): boolean {
  if (!actor) return false;
  if (actor.rol === 'ciudadano') return false;
  if (actor.rol === 'secretaria' || actor.rol === 'admin') return true;
  if (!actor.dependencia_id) return false;
  return tramite.dependencias.some(
    (item) => item.dependencia_id === actor.dependencia_id && item.turnado_at !== null
  );
}

export function filtrarBandeja(
  tramites: readonly TramiteConDetalle[],
  opciones: {
    actor: Actor | null;
    dependenciaId: string;
    dependenciaClave?: ClaveDependencia;
    busqueda: string;
  }
): TramiteConDetalle[] {
  const texto = opciones.busqueda.trim().toLocaleLowerCase();
  return tramites.filter((tramite) => {
    if (!puedeVerFila(tramite, opciones.actor)) return false;

    if (opciones.dependenciaId) {
      if (opciones.dependenciaClave === 'ventanilla') {
        const sinTurnar = tramite.dependencias.every((item) => item.turnado_at === null);
        if (!sinTurnar) return false;
      } else if (
        !tramite.dependencias.some((item) => item.dependencia_id === opciones.dependenciaId)
      ) {
        return false;
      }
    }

    if (!texto) return true;
    return [tramite.folio, tramite.nombre_contribuyente]
      .join(' ')
      .toLocaleLowerCase()
      .includes(texto);
  });
}

export function motivoEsValido(dictamen: Dictamen, motivo: string): boolean {
  if (dictamen === 'aprobado') return true;
  return motivo.trim().length >= 10;
}

export function claveRecordatorio(tramiteDependenciaId: string, ahora: Date = now()): string {
  return `recordatorio-${tramiteDependenciaId}-${fechaISO(ahora)}`;
}

export function claveAccion(tipo: string, id: string, fecha: string): string {
  return `${tipo}-${id}-${fecha}`;
}

export function dependenciasTurnadas(tramite: TramiteConDetalle): TramiteDependencia[] {
  return tramite.dependencias.filter((item) => item.turnado_at !== null);
}

export function claveDependencia(
  dependenciaId: string,
  catalogo: readonly Dependencia[]
): ClaveDependencia {
  const encontrada = catalogo.find((item) => item.id === dependenciaId);
  return encontrada?.clave === 'bomberos' || encontrada?.clave === 'proteccion_civil'
    ? encontrada.clave
    : 'ventanilla';
}

export function nombreDependencia(
  dependenciaId: string,
  catalogo: readonly Dependencia[]
): string {
  return catalogo.find((item) => item.id === dependenciaId)?.nombre ?? 'Dependencia';
}

export function correoDe(clave: ClaveDependencia): string {
  return CORREOS_EJEMPLO[clave];
}

export function etiquetaGeneral(tramite: TramiteConDetalle): string {
  return deriveEstadoGeneral(tramite.dependencias).etiqueta;
}

export function esUrgente(categoria: CategoriaSla): boolean {
  return categoria === 'por_vencer' || categoria === 'vencido';
}
