'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { SemaforoTramite } from '@/components/SemaforoTramite';
import { ListaTramites } from '@/components/TramiteLista';
import { useRepository } from '@/components/RepositoryProvider';
import { useRelojDemo } from '@/components/useRelojDemo';
import { categoriaDelTramite, type CategoriaPanel } from '@/lib/domain/clasificacion';
import type { FiltrosTramite } from '@/lib/repository/types';
import type { ConfiguracionSla, Dependencia, TramiteConDetalle } from '@/types/database';

interface DatosInicio {
  tramites: TramiteConDetalle[];
  configuracion: ConfiguracionSla[];
  catalogo: Dependencia[];
}

/** Inicio distinto por rol. Los datos se cargan en cliente para evitar hidratación. */
export function InicioPorRol() {
  const { actor, perfil, cargando: cargandoAuth, error: errorAuth } = useAuth();
  const { repositorio, listo, error: errorRepositorio } = useRepository();
  const ahora = useRelojDemo();
  const [datos, setDatos] = useState<DatosInicio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!listo || !repositorio || !actor) return;
    setCargando(true);
    try {
      const filtros: FiltrosTramite = {};
      if (actor.rol === 'ciudadano') filtros.ciudadanoId = actor.id;
      if ((actor.rol === 'bomberos' || actor.rol === 'proteccion_civil') && actor.dependencia_id) {
        filtros.dependenciaId = actor.dependencia_id;
      }
      const [tramites, configuracion, catalogo] = await Promise.all([
        repositorio.listarTramites(filtros),
        repositorio.listarConfiguracionSla(),
        repositorio.listarDependencias()
      ]);
      setDatos({ tramites, configuracion, catalogo });
      setError(null);
    } catch (error) {
      setDatos(null);
      setError(error instanceof Error ? error.message : 'No se pudieron cargar tus trámites.');
    } finally {
      setCargando(false);
    }
  }, [actor, listo, repositorio]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const mensajeError = error ?? errorAuth ?? errorRepositorio;

  if (cargandoAuth || !listo || cargando) {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-10">
        <p aria-live="polite" className="text-lg text-tinta">Cargando tu información...</p>
      </main>
    );
  }

  if (mensajeError) {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-10">
        <h1 className="text-3xl font-bold text-tinta">No pudimos cargar el inicio</h1>
        <p role="alert" className="mt-4 text-lg text-semaforo-rojo">{mensajeError}</p>
        <button
          type="button"
          onClick={() => void cargar()}
          className="mt-4 min-h-control rounded-control bg-enfasis px-5 py-3 text-lg font-semibold text-white"
        >
          Reintentar
        </button>
      </main>
    );
  }

  if (!perfil || !datos) {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-10">
        <h1 className="text-3xl font-bold text-tinta">Bienvenido a SIGET-Tonalá</h1>
        <p className="mt-4 text-lg text-tinta">Inicia sesión para ver tus trámites.</p>
        <Link href="/login" className="mt-4 inline-flex min-h-control items-center rounded-control bg-enfasis px-5 py-3 text-lg font-semibold text-white">
          Ir a iniciar sesión
        </Link>
      </main>
    );
  }

  if (perfil.rol === 'ciudadano') {
    const principal = datos.tramites[0];
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-10">
        <h1 className="text-3xl font-bold text-tinta">Hola, {perfil.nombre}</h1>
        <p className="mt-2 text-lg text-tinta">Aquí puedes iniciar un trámite y revisar en qué va.</p>

        <Link
          href="/tramites/nuevo"
          className="mt-8 flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-control border-4 border-enfasis bg-blue-50 px-6 py-8 text-center text-2xl font-bold text-enfasis"
        >
          <Plus aria-hidden="true" className="h-10 w-10" />
          Iniciar Nuevo Trámite
          <span className="text-lg font-normal text-tinta">Sólo necesitas los datos de tu negocio.</span>
        </Link>

        <section className="mt-10" aria-labelledby="mi-semaforo">
          <h2 id="mi-semaforo" className="text-2xl font-bold text-tinta">Tu trámite más reciente</h2>
          {principal ? (
            <div className="mt-4">
              <SemaforoTramite
                tramite={principal}
                configuracionSla={datos.configuracion}
                catalogoDependencias={datos.catalogo}
                ahora={ahora}
              />
              <p className="mt-3 text-lg text-tinta">Folio {principal.folio}</p>
            </div>
          ) : (
            <p className="mt-4 rounded-control border border-slate-300 bg-white p-5 text-lg text-tinta">
              Aún no tienes trámites registrados. Usa el botón de arriba para iniciar uno.
            </p>
          )}
        </section>

        <section className="mt-10" aria-labelledby="mis-tramites">
          <h2 id="mis-tramites" className="text-2xl font-bold text-tinta">Todos tus trámites</h2>
          {datos.tramites.length > 0 ? (
            <ListaTramites tramites={datos.tramites} />
          ) : (
            <p className="mt-4 text-lg text-tinta">Cuando registres un trámite aparecerá aquí.</p>
          )}
        </section>

        <p className="mt-8 text-base text-tinta">Los trámites y personas de esta vista son ficticios.</p>
      </main>
    );
  }

  const conteos: Record<CategoriaPanel, number> = { pendiente: 0, en_tiempo: 0, por_vencer: 0, vencido: 0 };
  for (const tramite of datos.tramites) conteos[categoriaDelTramite(tramite, datos.configuracion, ahora)] += 1;

  const tarjetas: readonly { categoria: CategoriaPanel; titulo: string; descripcion: string; estilo: string }[] = [
    { categoria: 'pendiente', titulo: 'Por turnar', descripcion: 'Sin enviar a Bomberos o Protección Civil.', estilo: 'border-slate-500' },
    { categoria: 'en_tiempo', titulo: 'En tiempo', descripcion: 'Menos de 48 horas desde el turno.', estilo: 'border-semaforo-verde' },
    { categoria: 'por_vencer', titulo: 'Por vencer', descripcion: 'Entre 48 y 72 horas sin dictamen.', estilo: 'border-semaforo-ambar' },
    { categoria: 'vencido', titulo: 'Vencidos', descripcion: 'Más de 72 horas sin dictamen.', estilo: 'border-semaforo-rojo' }
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <h1 className="text-3xl font-bold text-tinta">Panel de {perfil.rol.replace('_', ' ')}</h1>
      <p className="mt-2 text-lg text-tinta">Revisa la carga de trabajo antes de abrir un expediente.</p>

      <section aria-label="Resumen de trámites" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((tarjeta) => (
          <Link
            key={tarjeta.categoria}
            href="/gestion"
            className={`min-h-[160px] rounded-control border-4 ${tarjeta.estilo} bg-white p-5 hover:bg-slate-50`}
          >
            <span className="block text-3xl font-bold text-tinta" aria-label={`${conteos[tarjeta.categoria]} trámites ${tarjeta.titulo}`}>
              {conteos[tarjeta.categoria]}
            </span>
            <span className="mt-2 block text-xl font-bold text-tinta">{tarjeta.titulo}</span>
            <span className="mt-1 block text-lg text-tinta">{tarjeta.descripcion}</span>
          </Link>
        ))}
      </section>

      <section className="mt-10" aria-labelledby="actividad-reciente">
        <h2 id="actividad-reciente" className="text-2xl font-bold text-tinta">Trámites recientes</h2>
        {datos.tramites.length > 0 ? (
          <ListaTramites tramites={datos.tramites.slice(0, 8)} />
        ) : (
          <p className="mt-4 text-lg text-tinta">No hay trámites asignados a tu usuario en este momento.</p>
        )}
      </section>

      <p className="mt-8 text-base text-tinta">Los datos de esta vista son ficticios y están en tu navegador.</p>
    </main>
  );
}
