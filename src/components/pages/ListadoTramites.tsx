'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Cargando, ErrorVista, Vacio } from '@/components/EstadosVista';
import { ListaTramites } from '@/components/TramiteLista';
import { useRepository } from '@/components/RepositoryProvider';
import type { FiltrosTramite } from '@/lib/repository/types';
import type { EtapaGeneral, TramiteConDetalle } from '@/types/database';

const ETAPAS: readonly { valor: EtapaGeneral | ''; etiqueta: string }[] = [
  { valor: '', etiqueta: 'Todas las etapas' },
  { valor: 'recepcion', etiqueta: 'Recibido' },
  { valor: 'turnado', etiqueta: 'Turnado' },
  { valor: 'verificacion', etiqueta: 'En revisión' },
  { valor: 'observaciones', etiqueta: 'Observaciones o rechazo' },
  { valor: 'aprobado', etiqueta: 'Aprobado' }
];

const CLASE_CONTROL =
  'min-h-control w-full rounded-control border-2 border-slate-400 bg-white px-4 py-3 text-lg text-tinta sm:w-auto';

/** Listado filtrable. RLS limita los renglones que cada rol puede ver. */
export function ListadoTramites() {
  const { repositorio, listo } = useRepository();
  const { actor } = useAuth();
  const [tramites, setTramites] = useState<TramiteConDetalle[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [etapa, setEtapa] = useState<EtapaGeneral | ''>('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    if (!repositorio || !listo || !actor) return;
    setCargando(true);
    try {
      const filtros: FiltrosTramite = { busqueda };
      if (etapa) filtros.etapa = etapa;
      if (actor.rol === 'ciudadano') filtros.ciudadanoId = actor.id;
      if ((actor.rol === 'bomberos' || actor.rol === 'proteccion_civil') && actor.dependencia_id) {
        filtros.dependenciaId = actor.dependencia_id;
      }
      setTramites(await repositorio.listarTramites(filtros));
      setError('');
    } catch (error) {
      setTramites([]);
      setError(error instanceof Error ? error.message : 'No se pudieron cargar los trámites.');
    } finally {
      setCargando(false);
    }
  }, [actor, busqueda, etapa, listo, repositorio]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <section aria-labelledby="listado-tramites-titulo" className="mx-auto w-full max-w-6xl px-5 py-10">
      <h2 id="listado-tramites-titulo" className="text-2xl font-bold text-tinta">Mis trámites</h2>
      <p className="mt-2 text-lg text-tinta">Busca por folio, colonia, giro o nombre de la persona.</p>

      <div className="mt-6 grid gap-3 rounded-control border-2 border-slate-300 bg-white p-4 sm:grid-cols-2">
        <div>
          <label className="block text-lg font-semibold text-tinta" htmlFor="buscar-tramite">Buscar</label>
          <input
            id="buscar-tramite"
            className={`${CLASE_CONTROL} mt-2`}
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Escribe un folio o palabra"
          />
        </div>
        <div>
          <label className="block text-lg font-semibold text-tinta" htmlFor="filtrar-etapa">Etapa</label>
          <select
            id="filtrar-etapa"
            className={`${CLASE_CONTROL} mt-2`}
            value={etapa}
            onChange={(evento) => setEtapa(evento.target.value as EtapaGeneral | '')}
          >
            {ETAPAS.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6">
        {cargando ? (
          <Cargando mensaje="Buscando trámites..." />
        ) : error ? (
          <ErrorVista mensaje={error} onReintentar={() => void cargar()} />
        ) : tramites.length === 0 ? (
          <Vacio
            titulo="No encontramos trámites"
            mensaje="Prueba con otra palabra o cambia el filtro de etapa."
          />
        ) : (
          <>
            <p aria-live="polite" className="text-lg text-tinta">{tramites.length} trámite(s) encontrado(s).</p>
            <ListaTramites tramites={tramites} />
          </>
        )}
      </div>
    </section>
  );
}
