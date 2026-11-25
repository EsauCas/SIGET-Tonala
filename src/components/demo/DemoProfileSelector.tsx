'use client';

import { useEffect, useState } from 'react';
import { useRepository } from '@/components/RepositoryProvider';
import type { Profile } from '@/types/database';

/** Selector rápido de los cinco perfiles ficticios de la demostración. */
export function DemoProfileSelector() {
  const { demo, listo } = useRepository();
  const [perfiles, setPerfiles] = useState<Profile[]>([]);
  const [activo, setActivo] = useState<Profile | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (!listo || !demo) return;
    let vigente = true;
    Promise.all([demo.listarPerfiles(), demo.obtenerPerfilActivo()])
      .then(([lista, perfilActivo]) => {
        if (!vigente) return;
        setPerfiles(lista);
        setActivo(perfilActivo);
        setEstado('listo');
      })
      .catch(() => {
        if (!vigente) return;
        setEstado('error');
        setMensaje('No se pudieron cargar los perfiles de demostración.');
      });
    return () => {
      vigente = false;
    };
  }, [demo, listo]);

  if (!listo || !demo) return null;

  async function seleccionar(id: string): Promise<void> {
    try {
      await demo?.seleccionarPerfil(id);
      const perfil = perfiles.find((item) => item.id === id) ?? null;
      setActivo(perfil);
      setMensaje(`Ahora estás usando el perfil de ${perfil?.nombre ?? 'demostración'}.`);
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No se pudo cambiar de perfil.');
    }
  }

  return (
    <section className="mt-8 max-w-2xl rounded-control border border-slate-300 bg-white p-5">
      <h2 className="text-xl font-bold text-tinta">Perfil de demostración</h2>
      <p className="mt-2 text-lg text-tinta">
        Elige con quién quieres probar. Estos usuarios son ficticios.
      </p>

      {estado === 'cargando' && <p className="mt-3 text-lg text-tinta">Cargando perfiles...</p>}
      {estado === 'error' && <p className="mt-3 text-lg text-peligro">{mensaje}</p>}

      {estado === 'listo' && (
        <div className="mt-4 flex flex-wrap gap-3">
          {perfiles.map((perfil) => {
            const seleccionado = activo?.id === perfil.id;
            return (
              <button
                key={perfil.id}
                type="button"
                aria-pressed={seleccionado}
                onClick={() => void seleccionar(perfil.id)}
                className={`min-h-control rounded-control border-2 px-4 py-3 text-left text-lg font-semibold ${
                  seleccionado
                    ? 'border-enfasis bg-blue-50 text-tinta'
                    : 'border-slate-400 bg-white text-tinta'
                }`}
              >
                {perfil.nombre}
                <span className="block text-lg font-normal text-tinta">{perfil.rol.replace('_', ' ')}</span>
              </button>
            );
          })}
        </div>
      )}

      <p aria-live="polite" className="mt-3 min-h-[28px] text-lg text-tinta">
        {mensaje}
      </p>
    </section>
  );
}
