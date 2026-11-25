/**
 * Cálculo de recordatorios SLA. Función pura: recibe los renglones ya cargados
 * y devuelve avisos listos para encolar. No consulta reloj global ni servicios.
 */

import { renderizarCorreo } from '@/lib/email-templates';
import { calcularSla } from '@/lib/domain/sla';
import { correoDe } from '@/lib/gestion';
import { now } from '@/lib/reloj-demo';
import type { ClaveDependencia, ConfiguracionSla, Dependencia, Tramite, TramiteDependencia } from '@/types/database';

export interface EntradaRecordatorio {
  tramite: Tramite;
  renglon: TramiteDependencia;
  dependencia: Dependencia | undefined;
  configuracion: ConfiguracionSla;
}

export interface RecordatorioPlaneado {
  claveIdempotencia: string;
  tramiteId: string;
  destinatario: string;
  plantilla: 'recordatorio_sla';
  asunto: string;
  cuerpo: string;
  horasTranscurridas: number;
  horasLimite: number;
  severidad: 'alerta' | 'vencido';
}

function dia(ahora: Date): string {
  return ahora.toISOString().slice(0, 10);
}

/**
 * Un recordatorio por renglón y día. Los estados terminales, los renglones con
 * dictamen y el tiempo en pausa (espera al ciudadano) se omiten: ese tiempo no
 * debe contarse como retraso de la dependencia.
 */
export function calcularRecordatorios(
  entradas: readonly EntradaRecordatorio[],
  ahora: Date = now()
): RecordatorioPlaneado[] {
  const planeados: RecordatorioPlaneado[] = [];

  for (const entrada of entradas) {
    const { tramite, renglon, dependencia, configuracion } = entrada;
    if (!renglon.turnado_at) continue;
    if (renglon.dictamen_at) continue;
    if (renglon.estado === 'aprobado' || renglon.estado === 'rechazado') continue;
    if (renglon.pausado_desde) continue;

    const sla = calcularSla(
      {
        turnado_at: renglon.turnado_at,
        acuse_at: renglon.acuse_at,
        dictamen_at: renglon.dictamen_at,
        pausado_desde: renglon.pausado_desde,
        horas_pausadas: renglon.horas_pausadas
      },
      {
        horas_limite: configuracion.horas_limite,
        horas_alerta_previa: configuracion.horas_alerta_previa,
        tipo_horas: configuracion.tipo_horas
      },
      ahora
    );

    const horas = sla.dictamen.transcurrido_horas;
    const severidad = horas > configuracion.horas_limite ? 'vencido' : horas >= configuracion.horas_alerta_previa ? 'alerta' : null;
    if (!severidad) continue;

    const clave = `recordatorio-${renglon.id}-${dia(ahora)}-${severidad}`;
    if (planeados.some((item) => item.claveIdempotencia === clave)) continue;

    const correo = renderizarCorreo('recordatorio_sla', {
      folio: tramite.folio,
      dependencia: dependencia?.nombre ?? 'la dependencia correspondiente',
      horasTranscurridas: horas,
      horasLimite: configuracion.horas_limite
    });

    planeados.push({
      claveIdempotencia: clave,
      tramiteId: tramite.id,
      destinatario: correoDe((dependencia?.clave ?? 'ventanilla') as ClaveDependencia),
      plantilla: 'recordatorio_sla',
      asunto: correo.asunto,
      cuerpo: correo.texto,
      horasTranscurridas: horas,
      horasLimite: configuracion.horas_limite,
      severidad
    });
  }

  return planeados;
}
