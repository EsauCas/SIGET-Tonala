/**
 * Compatibilidad: el alta de trámites ahora vive en AsistenteTramite (3 pasos,
 * borrador persistente y notificación encolada). Se conserva este nombre de
 * exportación para no romper importaciones existentes.
 */
export { AsistenteTramite as FormularioTramite } from '@/components/AsistenteTramite';
