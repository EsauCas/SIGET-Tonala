import { CONFIGURACION_PREDETERMINADA, calcularSla, type CategoriaSla } from '@/lib/domain/sla';
import type { ConfiguracionSla, TramiteConDetalle } from '@/types/database';

export type CategoriaPanel = 'pendiente' | CategoriaSla;

export const ETIQUETAS_CATEGORIA: Readonly<Record<CategoriaPanel, string>> = {
  pendiente: 'Por turnar',
  en_tiempo: 'En tiempo',
  por_vencer: 'Por vencer',
  vencido: 'Vencidos'
};

/** Clasifica un trámite para los paneles. Usa la configuración SLA real. */
export function categoriaDelTramite(
  tramite: TramiteConDetalle,
  configuracion: readonly ConfiguracionSla[],
  ahora: Date
): CategoriaPanel {
  if (
    tramite.dependencias.length === 0 ||
    tramite.dependencias.every((item) => item.estado === 'pendiente')
  ) {
    return 'pendiente';
  }

  const categorias = tramite.dependencias
    .filter((item) => item.turnado_at !== null)
    .map((item) => {
      const configurada = configuracion.find((config) => config.dependencia_id === item.dependencia_id);
      return calcularSla(item, configurada ?? CONFIGURACION_PREDETERMINADA, ahora).dictamen.categoria;
    });

  if (categorias.includes('vencido')) return 'vencido';
  if (categorias.includes('por_vencer')) return 'por_vencer';
  if (categorias.includes('en_tiempo')) return 'en_tiempo';
  return 'pendiente';
}
