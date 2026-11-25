import type {
  ColorSemaforo,
  EstadoDependencia,
  EtapaGeneral,
  Rol,
  TramiteDependencia
} from '@/types/database';

/** Datos mínimos para derivar el semáforo; no se edita el estado general a mano. */
export type DependenciaParaEstado = Pick<TramiteDependencia, 'estado' | 'motivo'>;

export interface ResultadoEstadoGeneral {
  etapa: EtapaGeneral;
  color: ColorSemaforo;
  etiqueta: string;
  motivo: string | null;
  mensajeCiudadano: string;
}

type Transicion = readonly [EstadoDependencia, EstadoDependencia];

/**
 * Matriz de transiciones permitidas por rol. Las transiciones no listadas están
 * prohibidas: los estados terminales (aprobado/rechazado) no se reabren.
 */
export const TRANSICIONES_POR_ROL: Readonly<Record<Rol, readonly Transicion[]>> = {
  ciudadano: [['observaciones', 'en_inspeccion']],
  secretaria: [['pendiente', 'turnado']],
  bomberos: [
    ['turnado', 'en_inspeccion'],
    ['en_inspeccion', 'aprobado'],
    ['en_inspeccion', 'rechazado'],
    ['en_inspeccion', 'observaciones']
  ],
  proteccion_civil: [
    ['turnado', 'en_inspeccion'],
    ['en_inspeccion', 'aprobado'],
    ['en_inspeccion', 'rechazado'],
    ['en_inspeccion', 'observaciones']
  ],
  admin: []
};

export function canTransition(
  rol: Rol,
  from: EstadoDependencia,
  to: EstadoDependencia
): boolean {
  return TRANSICIONES_POR_ROL[rol].some(([origen, destino]) => origen === from && destino === to);
}

/**
 * Regla aditiva de Fase 5: la confirmación HUMANA del sello leído por OCR
 * permite a ventanilla cerrar el reloj de entrega y poner el expediente en
 * inspección. No modifica `canTransition`: la recepción manual sigue siendo
 * exclusiva de Bomberos/Protección Civil y el estado general sigue derivado.
 */
export function puedeConfirmarAcuseOcr(
  rol: Rol,
  from: EstadoDependencia,
  to: EstadoDependencia
): boolean {
  return rol === 'secretaria' && from === 'turnado' && to === 'en_inspeccion';
}

/**
 * Deriva el estado general (semáforo) a partir de las dependencias requeridas.
 * Reglas, en orden de prioridad:
 * 1. Hay rechazado u observaciones -> ROJO. Rechazado muestra su motivo.
 * 2. Todas las requeridas aprobaron -> VERDE.
 * 3. Hay en_inspeccion -> ÁMBAR.
 * 4. Hay turnado -> AZUL.
 * 5. En otro caso -> GRIS (recepción).
 */
export function deriveEstadoGeneral(
  dependencias: readonly DependenciaParaEstado[]
): ResultadoEstadoGeneral {
  const rechazada = dependencias.find((dependencia) => dependencia.estado === 'rechazado');
  if (rechazada) {
    return {
      etapa: 'observaciones',
      color: 'rojo',
      etiqueta: 'Rechazado',
      motivo: rechazada.motivo ?? 'La dependencia no proporcionó un motivo.',
      mensajeCiudadano: 'Tu trámite fue rechazado. Consulta el motivo en el detalle.'
    };
  }

  const observada = dependencias.find((dependencia) => dependencia.estado === 'observaciones');
  if (observada) {
    return {
      etapa: 'observaciones',
      color: 'rojo',
      etiqueta: 'Observaciones',
      motivo: observada.motivo ?? 'La dependencia no proporcionó un motivo.',
      mensajeCiudadano: 'Necesitamos que subas un documento para continuar la revisión.'
    };
  }

  if (dependencias.length === 0) {
    return {
      etapa: 'recepcion',
      color: 'gris',
      etiqueta: 'Recibido',
      motivo: null,
      mensajeCiudadano: 'Tu solicitud fue recibida. Todavía no se turna a ninguna dependencia.'
    };
  }

  if (dependencias.every((dependencia) => dependencia.estado === 'aprobado')) {
    return {
      etapa: 'aprobado',
      color: 'verde',
      etiqueta: 'Aprobado',
      motivo: null,
      mensajeCiudadano: 'Todas las dependencias terminaron su revisión. Tu trámite está aprobado.'
    };
  }

  if (dependencias.some((dependencia) => dependencia.estado === 'en_inspeccion')) {
    return {
      etapa: 'verificacion',
      color: 'ambar',
      etiqueta: 'En revisión',
      motivo: null,
      mensajeCiudadano: 'Bomberos o Protección Civil está revisando tu local.'
    };
  }

  if (dependencias.some((dependencia) => dependencia.estado === 'turnado')) {
    return {
      etapa: 'turnado',
      color: 'azul',
      etiqueta: 'Turnado',
      motivo: null,
      mensajeCiudadano: 'Tu solicitud ya fue enviada a la dependencia que debe revisarla.'
    };
  }

  return {
    etapa: 'recepcion',
    color: 'gris',
    etiqueta: 'Recibido',
    motivo: null,
    mensajeCiudadano: 'Tu solicitud fue recibida y está en la ventanilla.'
  };
}

/**
 * Un funcionario de Bomberos o Protección Civil solo opera sobre su dependencia.
 * Secretaría y admin pueden consultar/turnar, pero no dictaminar (ver canTransition).
 */
export function puedeOperarDependencia(
  rol: Rol,
  dependenciaIdPerfil: string | null,
  dependenciaIdTramite: string
): boolean {
  if (rol === 'secretaria' || rol === 'admin') return true;
  if (rol !== 'bomberos' && rol !== 'proteccion_civil') return false;
  return dependenciaIdPerfil !== null && dependenciaIdPerfil === dependenciaIdTramite;
}

/** Resolución consolidada: aprobada solo si TODAS las requeridas aprobaron. */
export function resolucionConsolidada(
  dependencias: readonly DependenciaParaEstado[]
): 'aprobada' | 'no_aprobada' {
  return dependencias.length > 0 && dependencias.every((item) => item.estado === 'aprobado')
    ? 'aprobada'
    : 'no_aprobada';
}
