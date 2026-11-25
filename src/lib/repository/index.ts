import { DEMO_MODE } from '@/lib/config';
import type { TramiteRepository } from '@/lib/repository/types';

/**
 * Único lugar donde se crea el adaptador. La aplicación es demo-only: la
 * decisión vive en config.ts y las páginas sólo consumen RepositoryProvider.
 */
export async function createRepository(): Promise<TramiteRepository> {
  if (!DEMO_MODE) {
    throw new Error('Esta instalación sólo funciona en modo demostración.');
  }
  const { DemoRepository } = await import('@/lib/repository/demo-repository');
  return new DemoRepository();
}
