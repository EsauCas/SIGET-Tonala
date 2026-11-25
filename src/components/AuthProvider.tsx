'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { useRepository } from '@/components/RepositoryProvider';
import type { Actor } from '@/lib/repository/types';
import type { Profile } from '@/types/database';

interface ContextoAuth {
  cargando: boolean;
  perfil: Profile | null;
  actor: Actor | null;
  error: string | null;
  recargar: () => Promise<void>;
}

const Contexto = createContext<ContextoAuth | null>(null);

/**
 * La sesión de demostración se lee del repositorio del navegador. El selector
 * de perfiles es la única forma de cambiar de usuario; no hay contraseñas ni
 * llamadas de autenticación a servidor.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { demo, listo, error: errorRepositorio } = useRepository();
  const [perfil, setPerfil] = useState<Profile | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!listo) return;
    setCargando(true);
    try {
      if (!demo) {
        throw new Error('El repositorio de demostración no está disponible.');
      }
      setPerfil(await demo.obtenerPerfilActivo());
      setError(null);
    } catch (fallo) {
      setPerfil(null);
      setError(fallo instanceof Error ? fallo.message : 'No se pudo leer el perfil activo.');
    } finally {
      setCargando(false);
    }
  }, [demo, listo]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  useEffect(() => {
    if (!demo) return;
    return demo.suscribirPerfil((perfilActivo) => setPerfil(perfilActivo));
  }, [demo]);

  const actor = useMemo<Actor | null>(
    () => (perfil ? { id: perfil.id, rol: perfil.rol, dependencia_id: perfil.dependencia_id } : null),
    [perfil]
  );

  const valor = useMemo<ContextoAuth>(
    () => ({
      cargando,
      perfil,
      actor,
      error: error ?? errorRepositorio,
      recargar
    }),
    [cargando, perfil, actor, error, errorRepositorio, recargar]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): ContextoAuth {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return contexto;
}
