'use client';

import type { ReactNode } from 'react';
import { COLONIAS_TONALA, GIROS_TONALA, TIPOS_TRAMITE } from '@/lib/catalogos';
import { CLASE_CAMPO, CLASE_ETIQUETA, CLASE_ERROR } from '@/components/layout/estilos';
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

interface EtiquetaProps {
  htmlFor: string;
  obligatorio?: boolean;
  ayuda?: string;
  children: ReactNode;
}

/** Etiqueta visible con "(obligatorio)" fuera del nombre accesible del campo. */
function Etiqueta({ htmlFor, obligatorio = false, ayuda, children }: EtiquetaProps) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-2">
        <label className={CLASE_ETIQUETA} htmlFor={htmlFor}>
          {children}
        </label>
        {obligatorio && <span className="text-base font-bold text-tinta">(obligatorio)</span>}
      </div>
      {ayuda && <p className="mt-1 text-base leading-relaxed text-tinta">{ayuda}</p>}
    </div>
  );
}

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
      <fieldset className="rounded-control border-2 border-arena bg-superficie p-5">
        <legend className="px-2 text-xl font-bold text-cafe">Datos de la persona</legend>
        <div className="mt-3 grid gap-5">
          <div>
            <Etiqueta htmlFor="nombre-contribuyente" obligatorio ayuda="Escribe el nombre completo, sin abreviaturas.">
              Nombre de la persona contribuyente
            </Etiqueta>
            <input
              id="nombre-contribuyente"
              className={CLASE_CAMPO}
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
            <Etiqueta htmlFor="domicilio-contribuyente" obligatorio ayuda="Calle, número y colonia donde vives.">
              Domicilio de la persona contribuyente
            </Etiqueta>
            <input
              id="domicilio-contribuyente"
              className={CLASE_CAMPO}
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
            <Etiqueta htmlFor="telefono" obligatorio ayuda="A 10 números, sin espacios ni guiones.">
              Teléfono a 10 números
            </Etiqueta>
            <input
              id="telefono"
              type="tel"
              inputMode="tel"
              className={CLASE_CAMPO}
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

      <fieldset className="rounded-control border-2 border-arena bg-superficie p-5">
        <legend className="px-2 text-xl font-bold text-cafe">Datos del negocio</legend>
        <div className="mt-3 grid gap-5">
          <div>
            <Etiqueta htmlFor="tipo-tramite" obligatorio ayuda="Si no sabes cuál elegir, mira la guía de arriba.">
              Tipo de licencia
            </Etiqueta>
            <select
              id="tipo-tramite"
              className={CLASE_CAMPO}
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
            <Etiqueta htmlFor="giro-principal" obligatorio ayuda="Por ejemplo: panadería, ferretería o cafetería.">
              Giro principal del negocio
            </Etiqueta>
            <input
              id="giro-principal"
              list="giros-sugeridos"
              className={CLASE_CAMPO}
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
            <Etiqueta htmlFor="giros-anexos" ayuda="Separa cada giro con una coma. Si no tienes otros, déjalo vacío.">
              Otros giros (opcional, separa con comas)
            </Etiqueta>
            <input
              id="giros-anexos"
              className={CLASE_CAMPO}
              value={forma.giros_anexos}
              onChange={(evento) => onChange('giros_anexos', evento.target.value)}
            />
          </div>

          <div>
            <Etiqueta htmlFor="domicilio-negocio" obligatorio ayuda="Incluye el número exterior o interior.">
              Calle y número del negocio
            </Etiqueta>
            <input
              id="domicilio-negocio"
              className={CLASE_CAMPO}
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

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Etiqueta htmlFor="colonia" obligatorio ayuda="Elige la colonia más cercana.">
                Colonia del negocio
              </Etiqueta>
              <select
                id="colonia"
                className={CLASE_CAMPO}
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
              <Etiqueta htmlFor="cp" obligatorio ayuda="Son 5 números.">
                Código postal (5 números)
              </Etiqueta>
              <input
                id="cp"
                inputMode="numeric"
                maxLength={5}
                className={CLASE_CAMPO}
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

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Etiqueta htmlFor="superficie" obligatorio ayuda="Puedes usar un número aproximado.">
                Superficie en metros cuadrados
              </Etiqueta>
              <input
                id="superficie"
                type="number"
                min="1"
                step="any"
                className={CLASE_CAMPO}
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
              <Etiqueta htmlFor="inversion" obligatorio ayuda="Escribe un número en pesos, sin comas.">
                Inversión estimada en pesos
              </Etiqueta>
              <input
                id="inversion"
                type="number"
                min="0"
                step="any"
                className={CLASE_CAMPO}
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
        className="rounded-control border-2 border-arena bg-superficie p-5"
        aria-describedby={errores.dependenciasRequeridas ? 'error-dependenciasRequeridas' : undefined}
      >
        <legend className="px-2 text-xl font-bold text-cafe">
          ¿Quién debe revisar tu solicitud? <span className="text-base font-bold text-tinta">(obligatorio)</span>
        </legend>
        <p className="mt-2 text-lg leading-relaxed text-tinta">
          Puedes elegir una o las dos dependencias. Si no sabes cuál necesitas, deja ambas seleccionadas.
        </p>
        <div className="mt-3 grid gap-3">
          {(
            [
              { clave: 'bomberos', etiqueta: 'Bomberos Tonalá' },
              { clave: 'proteccion_civil', etiqueta: 'Protección Civil Tonalá' }
            ] as const
          ).map((opcion) => (
            <label
              key={opcion.clave}
              className="flex min-h-tactil items-center gap-3 rounded-control border-2 border-arena px-4 py-3 text-lg font-semibold text-tinta"
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
