'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createRepository } from '@/lib/repository';
import type {
  DemoCapabilities,
  EstadoAlmacenamientoDemo,
  TramiteRepository
} from '@/lib/repository/types';
import type { Profile } from '@/types/database';

interface EstadoProvider {
  repositorio: TramiteRepository | null;
  listo: boolean;
  error: string | null;
  demo: DemoCapabilities | null;
}

interface ContextoRepositorio extends EstadoProvider {
  modo: 'demo';
  almacenamiento: EstadoAlmacenamientoDemo | null;
}

const Contexto = createContext<ContextoRepositorio | null>(null);

const estadoInicial: EstadoProvider = {
  repositorio: null,
  listo: false,
  error: null,
  demo: null
};

/** Expone las capacidades del único adaptador: el repositorio demo. */
function capacidadesDemo(repositorio: TramiteRepository): DemoCapabilities | null {
  const candidato = repositorio as TramiteRepository & Partial<DemoCapabilities>;
  const {
    listarPerfiles,
    seleccionarPerfil,
    obtenerPerfilActivo,
    suscribirPerfil,
    reiniciar,
    listarCorreosSimulados,
    estadoAlmacenamiento
  } = candidato;
  if (
    typeof listarPerfiles !== 'function' ||
    typeof seleccionarPerfil !== 'function' ||
    typeof obtenerPerfilActivo !== 'function' ||
    typeof suscribirPerfil !== 'function' ||
    typeof reiniciar !== 'function' ||
    typeof listarCorreosSimulados !== 'function'
  ) {
    return null;
  }
  return {
    listarPerfiles: () => listarPerfiles.call(repositorio),
    seleccionarPerfil: (id: string) => seleccionarPerfil.call(repositorio, id),
    obtenerPerfilActivo: () => obtenerPerfilActivo.call(repositorio),
    suscribirPerfil: (listener: (perfil: Profile | null) => void) =>
      suscribirPerfil.call(repositorio, listener),
    reiniciar: () => reiniciar.call(repositorio),
    listarCorreosSimulados: () => listarCorreosSimulados.call(repositorio),
    ...(typeof estadoAlmacenamiento === 'function'
      ? { estadoAlmacenamiento: () => estadoAlmacenamiento.call(repositorio) }
      : {})
  };
}

export function RepositoryProvider({
  children,
  repositorioInyectado
}: {
  children: ReactNode;
  repositorioInyectado?: TramiteRepository;
}) {
  const [estado, setEstado] = useState<EstadoProvider>(estadoInicial);

  useEffect(() => {
    if (repositorioInyectado) {
      setEstado({
        repositorio: repositorioInyectado,
        listo: true,
        error: null,
        demo: capacidadesDemo(repositorioInyectado)
      });
      return;
    }

    let activo = true;
    createRepository()
      .then((repositorio) => {
        if (!activo) return;
        setEstado({
          repositorio,
          listo: true,
          error: null,
          demo: capacidadesDemo(repositorio)
        });
      })
      .catch((error: unknown) => {
        if (!activo) return;
        setEstado({
          ...estadoInicial,
          listo: true,
          error: error instanceof Error ? error.message : 'No se pudo iniciar el repositorio.'
        });
      });

    return () => {
      activo = false;
    };
  }, [repositorioInyectado]);

  const valor: ContextoRepositorio = {
    ...estado,
    modo: 'demo',
    almacenamiento: estado.demo?.estadoAlmacenamiento?.() ?? null
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useRepository(): ContextoRepositorio {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error('useRepository debe usarse dentro de RepositoryProvider.');
  }
  return contexto;
}
