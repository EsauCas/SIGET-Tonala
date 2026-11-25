'use client';

import { UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRepository } from '@/components/RepositoryProvider';
import type { Profile, Rol } from '@/types/database';

const ETIQUETA_ROL: Readonly<Record<Rol, string>> = {
  ciudadano: 'Ciudadanía',
  secretaria: 'Secretaría',
  bomberos: 'Bomberos',
  proteccion_civil: 'Protección Civil',
  admin: 'Administrador'
};

/** En la demostración, el cambio de perfil vive dentro del encabezado. */
export function PerfilDemo() {
  const { perfil, cargando, error } = useAuth();
  const { demo, listo } = useRepository();
  const [perfiles, setPerfiles] = useState<Profile[]>([]);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    if (!listo || !demo) return;
    let vigente = true;
    demo.listarPerfiles()
      .then((lista) => {
        if (!vigente) return;
        setPerfiles(lista);
        setEstado('listo');
      })
      .catch(() => {
        if (!vigente) return;
        setEstado('error');
        setAviso('No pudimos cargar los perfiles de prueba.');
      });
    return () => {
      vigente = false;
    };
  }, [demo, listo]);

  async function seleccionar(id: string): Promise<void> {
    try {
      await demo?.seleccionarPerfil(id);
      const elegido = perfiles.find((item) => item.id === id);
      setAviso(
        elegido
          ? `Ahora estás como ${elegido.nombre}, ${ETIQUETA_ROL[elegido.rol]}.`
          : 'Perfil de prueba cambiado.'
      );
    } catch (fallo) {
      setAviso(fallo instanceof Error ? fallo.message : 'No se pudo cambiar de perfil de prueba.');
    }
  }

  const etiqueta = perfil
    ? `${perfil.nombre} · ${ETIQUETA_ROL[perfil.rol]}`
    : cargando
      ? 'Cargando perfil...'
      : 'Sin perfil activo';

  return (
    <details className="max-w-full rounded-control border border-arena bg-cafe p-3">
      <summary className="flex min-h-control cursor-pointer list-none items-center gap-2 rounded-control px-1 text-lg font-semibold text-white marker:hidden">
        <UserRound aria-hidden="true" className="h-6 w-6 shrink-0" />
        <span className="min-w-0">
          Estás como: <strong className="font-bold">{etiqueta}</strong>
          <span className="block text-base font-normal underline decoration-2 underline-offset-4">
            Cambiar de perfil de prueba
          </span>
        </span>
      </summary>

      {(estado === 'cargando' || !listo) && (
        <p className="mt-3 text-base text-white">Cargando perfiles de prueba...</p>
      )}
      {(estado === 'error' || error) && (
        <p role="alert" className="mt-3 text-base font-semibold text-white">
          {aviso || 'No pudimos cargar los perfiles de prueba.'}
        </p>
      )}
      {estado === 'listo' && (
        <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {perfiles.map((item) => {
            const activo = perfil?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={activo}
                onClick={() => void seleccionar(item.id)}
                className={`min-h-[52px] rounded-control border-2 px-3 py-2 text-left text-base font-semibold ${
                  activo ? 'border-ocre bg-ocre text-tinta' : 'border-arena bg-cafe text-white'
                }`}
              >
                {item.nombre}
                <span className="block font-normal">{ETIQUETA_ROL[item.rol]}</span>
              </button>
            );
          })}
        </div>
      )}
      <p aria-live="polite" className="mt-2 min-h-[24px] text-base text-white">
        {aviso}
      </p>
    </details>
  );
}
