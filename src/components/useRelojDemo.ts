'use client';

import { useSyncExternalStore } from 'react';
import { ahoraDemo, desplazamientoRelojDemoMs, suscribirRelojDemo } from '@/lib/reloj-demo';

/**
 * Suscribe una vista al reloj de demostración. El valor observado es el
 * desplazamiento (estable entre avances); la fecha se calcula al renderizar.
 */
export function useRelojDemo(): Date {
  useSyncExternalStore(
    suscribirRelojDemo,
    desplazamientoRelojDemoMs,
    desplazamientoRelojDemoMs
  );
  return ahoraDemo();
}
