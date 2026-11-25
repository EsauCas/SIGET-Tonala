'use client';

import {
  AlertTriangle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Plus,
  Search
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { SemaforoTramite } from '@/components/SemaforoTramite';
import { ListaTramites } from '@/components/TramiteLista';
import { useRepository } from '@/components/RepositoryProvider';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from '@/components/layout/estilos';
import { MensajeVacio } from '@/components/layout/MensajeVacio';
import { PageShell } from '@/components/layout/PageShell';
import { SeccionCard } from '@/components/layout/SeccionCard';
import { TarjetaAccion } from '@/components/layout/TarjetaAccion';
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
      <PageShell titulo="Preparando tu inicio" descripcion="Estamos reuniendo la información de tu perfil.">
        <p aria-live="polite" className="text-lg text-tinta">
          Cargando tus trámites. Esto tarda unos segundos...
        </p>
      </PageShell>
    );
  }

  if (mensajeError) {
    return (
      <PageShell titulo="No pudimos cargar el inicio" descripcion="Inténtalo otra vez. Tus datos siguen guardados en este navegador.">
        <div role="alert" className="rounded-control border-l-8 border-semaforo-rojo bg-superficie p-5">
          <p className="text-lg font-semibold text-tinta">{mensajeError}</p>
          <button type="button" onClick={() => void cargar()} className={`mt-4 ${BOTON_PRIMARIO}`}>
            Reintentar
          </button>
        </div>
      </PageShell>
    );
  }

  if (!perfil || !datos) {
    return (
      <PageShell
        titulo="Bienvenido a SIGET Tonalá"
        descripcion="Elige un perfil de prueba en la parte de arriba para comenzar."
      >
        <Link href="/login" className={BOTON_PRIMARIO}>
          Ir a iniciar sesión
        </Link>
      </PageShell>
    );
  }

  if (perfil.rol === 'ciudadano') {
    const principal = datos.tramites[0];
    return (
      <PageShell
        titulo={`Hola, ${perfil.nombre}`}
        descripcion="¿Qué quieres hacer hoy? Aquí puedes iniciar una solicitud y ver cómo va."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <TarjetaAccion
            href="/tramites"
            titulo="Iniciar un trámite"
            descripcion="Te ayudamos a elegir la licencia y a llenar los datos de tu negocio."
            cta="Iniciar mi trámite"
            icono={<ClipboardList aria-hidden="true" className="h-8 w-8 text-cafe" />}
            destacada
          />
          <TarjetaAccion
            href="/tramites"
            titulo="Ver cómo va mi trámite"
            descripcion="Consulta en qué etapa está y qué necesitas hacer después."
            cta="Ver cómo va"
            icono={<Search aria-hidden="true" className="h-8 w-8 text-cafe" />}
          />
        </div>

        <SeccionCard
          numero={1}
          titulo="Tu trámite más reciente"
          descripcion="Aquí ves el avance y lo que sigue, con palabras sencillas."
          accion={
            <Link href="/tramites" className={BOTON_SECUNDARIO}>
              Ver todos mis trámites
            </Link>
          }
        >
          {principal ? (
            <div>
              <SemaforoTramite
                tramite={principal}
                configuracionSla={datos.configuracion}
                catalogoDependencias={datos.catalogo}
                ahora={ahora}
              />
              <p className="mt-4 text-lg font-semibold text-tinta">Tu folio es {principal.folio}. Guárdalo para consultar.</p>
            </div>
          ) : (
            <MensajeVacio
              titulo="Aún no tienes trámites"
              descripcion="Toca el botón de arriba para iniciar el primero. Te tomó menos de lo que imaginas."
              accion={
                <Link href="/tramites" className={BOTON_PRIMARIO}>
                  Iniciar mi primer trámite
                </Link>
              }
            />
          )}
        </SeccionCard>

        {datos.tramites.length > 0 && (
          <SeccionCard numero={2} titulo="Todos tus trámites" descripcion="Ordenados del más reciente al más antiguo.">
            <ListaTramites tramites={datos.tramites} />
          </SeccionCard>
        )}
      </PageShell>
    );
  }

  const conteos: Record<CategoriaPanel, number> = { pendiente: 0, en_tiempo: 0, por_vencer: 0, vencido: 0 };
  for (const tramite of datos.tramites) conteos[categoriaDelTramite(tramite, datos.configuracion, ahora)] += 1;

  const tarjetas: readonly {
    categoria: CategoriaPanel;
    titulo: string;
    descripcion: string;
    borde: string;
    Icono: typeof AlertTriangle;
  }[] = [
    {
      categoria: 'vencido',
      titulo: 'Vencidos',
      descripcion: 'Pasaron las horas de revisión y aún no hay resultado.',
      borde: 'border-l-semaforo-rojo',
      Icono: AlertTriangle
    },
    {
      categoria: 'por_vencer',
      titulo: 'Por vencer',
      descripcion: 'La revisión está cerca del tiempo límite.',
      borde: 'border-l-semaforo-ambar',
      Icono: Clock
    },
    {
      categoria: 'en_tiempo',
      titulo: 'En tiempo',
      descripcion: 'La revisión avanza dentro del plazo.',
      borde: 'border-l-semaforo-verde',
      Icono: ClipboardCheck
    },
    {
      categoria: 'pendiente',
      titulo: 'Por enviar a revisión',
      descripcion: 'Están en ventanilla y todavía no se envían.',
      borde: 'border-l-semaforo-gris',
      Icono: Plus
    }
  ];

  return (
    <PageShell
      titulo="¿Qué hay pendiente hoy?"
      descripcion={`Estás como ${perfil.nombre}. Empieza por lo vencido y después sigue con lo que está por vencer.`}
    >
      <SeccionCard
        numero={1}
        titulo="Trámites que necesitan atención"
        descripcion="Toca «Ver estos trámites» para abrir sólo ese grupo."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tarjetas.map((tarjeta) => (
            <div
              key={tarjeta.categoria}
              className={`rounded-control border-2 border-arena border-l-8 ${tarjeta.borde} bg-superficie p-5`}
            >
              <tarjeta.Icono aria-hidden="true" className="h-8 w-8 text-cafe" />
              <p className="mt-3 text-4xl font-bold leading-none text-tinta" aria-label={`${conteos[tarjeta.categoria]} trámites ${tarjeta.titulo}`}>
                {conteos[tarjeta.categoria]}
              </p>
              <p className="mt-2 text-xl font-bold text-cafe">{tarjeta.titulo}</p>
              <p className="mt-1 text-lg text-tinta">{tarjeta.descripcion}</p>
              <Link
                href={`/gestion?categoria=${tarjeta.categoria}`}
                className={`mt-4 ${BOTON_SECUNDARIO}`}
              >
                Ver estos trámites
              </Link>
            </div>
          ))}
        </div>
      </SeccionCard>

      <SeccionCard
        numero={2}
        titulo="Trámites recientes"
        descripcion="Los últimos movimientos de la bandeja de trabajo."
        accion={
          <Link href="/gestion" className={BOTON_PRIMARIO}>
            Abrir bandeja completa
          </Link>
        }
      >
        {datos.tramites.length > 0 ? (
          <ListaTramites tramites={datos.tramites.slice(0, 8)} />
        ) : (
          <MensajeVacio
            titulo="No hay trámites asignados"
            descripcion="Cuando ventanilla envíe una solicitud, aparecerá aquí."
          />
        )}
      </SeccionCard>
    </PageShell>
  );
}
