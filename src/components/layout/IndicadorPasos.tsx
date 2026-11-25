interface IndicadorPasosProps {
  pasos: readonly string[];
  pasoActual: number;
}

/** Indicador textual y visual: círculos numerados conectados, sin depender del color. */
export function IndicadorPasos({ pasos, pasoActual }: IndicadorPasosProps) {
  const actual = Math.min(Math.max(pasoActual, 1), pasos.length);

  return (
    <div className="rounded-control border-2 border-arena bg-superficie p-4">
      <p className="text-lg font-bold text-cafe">
        Paso {actual} de {pasos.length}: {pasos[actual - 1]}
      </p>
      <ol className="mt-4 flex flex-wrap items-center gap-2" aria-label="Progreso del asistente">
        {pasos.map((paso, indice) => {
          const numero = indice + 1;
          const hecho = numero < actual;
          const presente = numero === actual;
          return (
            <li key={paso} className="flex items-center gap-2">
              <span
                aria-current={presente ? 'step' : undefined}
                className={`flex h-12 w-12 items-center justify-center rounded-full border-2 text-lg font-bold ${
                  presente
                    ? 'border-cafe bg-ocre text-tinta'
                    : hecho
                      ? 'border-barro bg-barro text-white'
                      : 'border-bordeCampo bg-superficie text-tinta'
                }`}
              >
                {numero}
              </span>
              <span className="sr-only">
                {paso}
                {presente ? ' (paso actual)' : hecho ? ' (terminado)' : ' (pendiente)'}
              </span>
              {numero < pasos.length && <span aria-hidden="true" className="h-1 w-6 bg-arena" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
