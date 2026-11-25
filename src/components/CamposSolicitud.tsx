'use client';

import { COLONIAS_TONALA, GIROS_TONALA, TIPOS_TRAMITE } from '@/lib/catalogos';
import type {
  CampoSolicitud,
  DatosSolicitud,
  ErroresSolicitud
} from '@/lib/validacion-solicitud';
import type { ClaveDependencia } from '@/types/database';

export interface CamposSolicitudProps {
  forma: Readonly<DatosSolicitud>;
  errores: Readonly<ErroresSolicitud>;
  onChange(campo: CampoSolicitud, valor: string): void;
  onAlternarDependencia(clave: ClaveDependencia): void;
}

const CLASE_CONTROL =
  'mt-2 block w-full min-h-control rounded-control border-2 border-slate-400 bg-white px-4 py-3 text-lg leading-relaxed text-tinta';
const CLASE_ETIQUETA = 'block text-lg font-semibold text-tinta';
const CLASE_ERROR = 'mt-1 text-lg font-semibold text-peligro';

/** Campos editables de la solicitud, compartidos por los pasos 2 y 3. */
export function CamposSolicitud({
  forma,
  errores,
  onChange,
  onAlternarDependencia
}: CamposSolicitudProps) {
  function descripcion(campo: CampoSolicitud): string | undefined {
    return errores[campo] ? `error-${campo}` : undefined;
  }

  function invalido(campo: CampoSolicitud): boolean {
    return Boolean(errores[campo]);
  }

  return (
    <div className="grid gap-5">
      <fieldset className="rounded-control border-2 border-slate-300 bg-white p-5">
        <legend className="px-2 text-xl font-bold text-tinta">Datos de la persona</legend>
        <div className="mt-3 grid gap-4">
          <div>
            <label className={CLASE_ETIQUETA} htmlFor="nombre-contribuyente">
              Nombre de la persona contribuyente
            </label>
            <input
              id="nombre-contribuyente"
              className={CLASE_CONTROL}
              value={forma.nombre_contribuyente}
              onChange={(evento) => onChange('nombre_contribuyente', evento.target.value)}
              aria-invalid={invalido('nombre_contribuyente')}
              aria-describedby={descripcion('nombre_contribuyente')}
            />
            {errores.nombre_contribuyente && (
              <p id="error-nombre_contribuyente" role="alert" className={CLASE_ERROR}>
                {errores.nombre_contribuyente}
              </p>
            )}
          </div>

          <div>
            <label className={CLASE_ETIQUETA} htmlFor="domicilio-contribuyente">
              Domicilio de la persona contribuyente
            </label>
            <input
              id="domicilio-contribuyente"
              className={CLASE_CONTROL}
              value={forma.domicilio_contribuyente}
              onChange={(evento) => onChange('domicilio_contribuyente', evento.target.value)}
              aria-invalid={invalido('domicilio_contribuyente')}
              aria-describedby={descripcion('domicilio_contribuyente')}
            />
            {errores.domicilio_contribuyente && (
              <p id="error-domicilio_contribuyente" role="alert" className={CLASE_ERROR}>
                {errores.domicilio_contribuyente}
              </p>
            )}
          </div>

          <div>
            <label className={CLASE_ETIQUETA} htmlFor="telefono">
              Teléfono a 10 números
            </label>
            <input
              id="telefono"
              type="tel"
              inputMode="tel"
              className={CLASE_CONTROL}
              value={forma.telefono}
              onChange={(evento) => onChange('telefono', evento.target.value)}
              aria-invalid={invalido('telefono')}
              aria-describedby={descripcion('telefono')}
            />
            {errores.telefono && (
              <p id="error-telefono" role="alert" className={CLASE_ERROR}>
                {errores.telefono}
              </p>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-control border-2 border-slate-300 bg-white p-5">
        <legend className="px-2 text-xl font-bold text-tinta">Datos del negocio</legend>
        <div className="mt-3 grid gap-4">
          <div>
            <label className={CLASE_ETIQUETA} htmlFor="tipo-tramite">
              Tipo de licencia
            </label>
            <select
              id="tipo-tramite"
              className={CLASE_CONTROL}
              value={forma.tipo_tramite}
              onChange={(evento) => onChange('tipo_tramite', evento.target.value)}
              aria-invalid={invalido('tipo_tramite')}
              aria-describedby={descripcion('tipo_tramite')}
            >
              <option value="">Selecciona el tipo de licencia</option>
              {TIPOS_TRAMITE.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
            {errores.tipo_tramite && (
              <p id="error-tipo_tramite" role="alert" className={CLASE_ERROR}>
                {errores.tipo_tramite}
              </p>
            )}
          </div>

          <div>
            <label className={CLASE_ETIQUETA} htmlFor="giro-principal">
              Giro principal del negocio
            </label>
            <input
              id="giro-principal"
              list="giros-sugeridos"
              className={CLASE_CONTROL}
              value={forma.giro_principal}
              onChange={(evento) => onChange('giro_principal', evento.target.value)}
              aria-invalid={invalido('giro_principal')}
              aria-describedby={descripcion('giro_principal')}
            />
            <datalist id="giros-sugeridos">
              {GIROS_TONALA.map((giro) => (
                <option key={giro} value={giro} />
              ))}
            </datalist>
            {errores.giro_principal && (
              <p id="error-giro_principal" role="alert" className={CLASE_ERROR}>
                {errores.giro_principal}
              </p>
            )}
          </div>

          <div>
            <label className={CLASE_ETIQUETA} htmlFor="giros-anexos">
              Otros giros (opcional, separa con comas)
            </label>
            <input
              id="giros-anexos"
              className={CLASE_CONTROL}
              value={forma.giros_anexos}
              onChange={(evento) => onChange('giros_anexos', evento.target.value)}
            />
          </div>

          <div>
            <label className={CLASE_ETIQUETA} htmlFor="domicilio-negocio">
              Calle y número del negocio
            </label>
            <input
              id="domicilio-negocio"
              className={CLASE_CONTROL}
              value={forma.domicilio_negocio}
              onChange={(evento) => onChange('domicilio_negocio', evento.target.value)}
              aria-invalid={invalido('domicilio_negocio')}
              aria-describedby={descripcion('domicilio_negocio')}
            />
            {errores.domicilio_negocio && (
              <p id="error-domicilio_negocio" role="alert" className={CLASE_ERROR}>
                {errores.domicilio_negocio}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={CLASE_ETIQUETA} htmlFor="colonia">
                Colonia del negocio
              </label>
              <select
                id="colonia"
                className={CLASE_CONTROL}
                value={forma.colonia}
                onChange={(evento) => onChange('colonia', evento.target.value)}
                aria-invalid={invalido('colonia')}
                aria-describedby={descripcion('colonia')}
              >
                <option value="">Selecciona tu colonia</option>
                {COLONIAS_TONALA.map((colonia) => (
                  <option key={colonia} value={colonia}>
                    {colonia}
                  </option>
                ))}
              </select>
              {errores.colonia && (
                <p id="error-colonia" role="alert" className={CLASE_ERROR}>
                  {errores.colonia}
                </p>
              )}
            </div>
            <div>
              <label className={CLASE_ETIQUETA} htmlFor="cp">
                Código postal (5 números)
              </label>
              <input
                id="cp"
                inputMode="numeric"
                maxLength={5}
                className={CLASE_CONTROL}
                value={forma.cp}
                onChange={(evento) => onChange('cp', evento.target.value.replace(/\D/g, ''))}
                aria-invalid={invalido('cp')}
                aria-describedby={descripcion('cp')}
              />
              {errores.cp && (
                <p id="error-cp" role="alert" className={CLASE_ERROR}>
                  {errores.cp}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={CLASE_ETIQUETA} htmlFor="superficie">
                Superficie en metros cuadrados
              </label>
              <input
                id="superficie"
                type="number"
                min="1"
                step="any"
                className={CLASE_CONTROL}
                value={forma.superficie_m2}
                onChange={(evento) => onChange('superficie_m2', evento.target.value)}
                aria-invalid={invalido('superficie_m2')}
                aria-describedby={descripcion('superficie_m2')}
              />
              {errores.superficie_m2 && (
                <p id="error-superficie_m2" role="alert" className={CLASE_ERROR}>
                  {errores.superficie_m2}
                </p>
              )}
            </div>
            <div>
              <label className={CLASE_ETIQUETA} htmlFor="inversion">
                Inversión estimada en pesos
              </label>
              <input
                id="inversion"
                type="number"
                min="0"
                step="any"
                className={CLASE_CONTROL}
                value={forma.inversion_estimada}
                onChange={(evento) => onChange('inversion_estimada', evento.target.value)}
                aria-invalid={invalido('inversion_estimada')}
                aria-describedby={descripcion('inversion_estimada')}
              />
              {errores.inversion_estimada && (
                <p id="error-inversion_estimada" role="alert" className={CLASE_ERROR}>
                  {errores.inversion_estimada}
                </p>
              )}
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset
        className="rounded-control border-2 border-slate-300 bg-white p-5"
        aria-describedby={errores.dependenciasRequeridas ? 'error-dependenciasRequeridas' : undefined}
      >
        <legend className="px-2 text-xl font-bold text-tinta">
          ¿Quién debe revisar tu solicitud?
        </legend>
        <p className="mt-2 text-lg text-tinta">Puedes elegir una o las dos dependencias.</p>
        <div className="mt-3 grid gap-3">
          {(
            [
              { clave: 'bomberos', etiqueta: 'Bomberos Tonalá' },
              { clave: 'proteccion_civil', etiqueta: 'Protección Civil Tonalá' }
            ] as const
          ).map((opcion) => (
            <label
              key={opcion.clave}
              className="flex min-h-tactil items-center gap-3 text-lg font-semibold text-tinta"
            >
              <input
                type="checkbox"
                className="h-6 w-6"
                checked={forma.dependenciasRequeridas.includes(opcion.clave)}
                onChange={() => onAlternarDependencia(opcion.clave)}
              />
              {opcion.etiqueta}
            </label>
          ))}
        </div>
        {errores.dependenciasRequeridas && (
          <p id="error-dependenciasRequeridas" role="alert" className={CLASE_ERROR}>
            {errores.dependenciasRequeridas}
          </p>
        )}
      </fieldset>
    </div>
  );
}
