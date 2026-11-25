'use client';

import { CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Aviso, Cargando } from '@/components/EstadosVista';
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
    <section className="mt-8 max-w-2xl rounded-control border-2 border-arena bg-superficie p-5">
      <h2 className="text-2xl font-bold text-cafe">Perfil de demostración</h2>
      <p className="mt-3 text-lg leading-relaxed text-tinta">
        Elige con quién quieres probar. Estos usuarios son ficticios.
      </p>

      {estado === 'cargando' && <div className="mt-4"><Cargando mensaje="Cargando perfiles..." /></div>}
      {estado === 'error' && <div className="mt-4"><Aviso mensaje={mensaje} /></div>}

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
                className={`flex min-h-control flex-col items-start gap-1 rounded-control border-2 px-4 py-3 text-left text-lg font-bold leading-snug ${
                  seleccionado
                    ? 'border-barro bg-papel text-tinta'
                    : 'border-bordeCampo bg-superficie text-tinta'
                }`}
              >
                <span>{perfil.nombre}</span>
                <span className="text-lg font-semibold text-cafe">{perfil.rol.replace('_', ' ')}</span>
                {seleccionado && (
                  <span className="inline-flex items-center gap-2 text-lg font-bold text-barro">
                    <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />
                    En uso
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <p aria-live="polite" className="mt-3 min-h-[28px] text-lg font-semibold text-tinta">
        {mensaje}
      </p>
    </section>
  );
}
