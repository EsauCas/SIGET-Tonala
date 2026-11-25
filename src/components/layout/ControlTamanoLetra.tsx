'use client';

import { Type } from 'lucide-react';
import { useEffect, useState } from 'react';

type Tamano = 'normal' | 'grande' | 'muy-grande';

const CLAVE = 'siget-tonala:tamano-letra';

const OPCIONES: readonly { valor: Tamano; etiqueta: string }[] = [
  { valor: 'normal', etiqueta: 'Normal' },
  { valor: 'grande', etiqueta: 'Grande' },
  { valor: 'muy-grande', etiqueta: 'Muy grande' }
];

/** Control explícito de lectura: escala la raíz y recuerda la elección. */
export function ControlTamanoLetra() {
  const [tamano, setTamano] = useState<Tamano>('normal');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE);
      if (guardado === 'grande' || guardado === 'muy-grande') {
        setTamano(guardado);
        document.documentElement.dataset.tamano = guardado;
      }
    } catch {
      setAviso('No pudimos recordar el tamaño de letra en este navegador.');
    }
  }, []);

  function cambiar(valor: Tamano, etiqueta: string): void {
    setTamano(valor);
    document.documentElement.dataset.tamano = valor === 'normal' ? '' : valor;
    if (valor === 'normal') delete document.documentElement.dataset.tamano;
    try {
      window.localStorage.setItem(CLAVE, valor);
    } catch {
      setAviso('El tamaño cambió, pero no pudimos guardarlo en este navegador.');
    }
    setAviso(`Tamaño de letra: ${etiqueta}.`);
  }

  return (
    <div className="rounded-control border border-arena/60 bg-cafe p-3">
      <p className="flex items-center gap-2 text-base font-semibold text-white">
        <Type aria-hidden="true" className="h-5 w-5" />
        Tamaño de letra
      </p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Tamaño de letra">
        {OPCIONES.map((opcion) => {
          const activo = tamano === opcion.valor;
          return (
            <button
              key={opcion.valor}
              type="button"
              aria-pressed={activo}
              onClick={() => cambiar(opcion.valor, opcion.etiqueta)}
              className={`min-h-control rounded-control border-2 px-3 py-2 text-base font-semibold ${
                activo ? 'border-ocre bg-ocre text-tinta' : 'border-arena bg-cafe text-white'
              }`}
            >
              {opcion.etiqueta}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="mt-1 min-h-[24px] text-base text-white">
        {aviso}
      </p>
    </div>
  );
}
