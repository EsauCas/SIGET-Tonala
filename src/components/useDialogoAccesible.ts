'use client';

import { useEffect, useRef } from 'react';

const ENFOCABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])'
].join(', ');

/**
 * Diálogo accesible: foco al abrir, Tab cicla dentro, Esc cierra y el foco
 * vuelve al control que lo abrió. Se usa por diálogos de confirmación y drawer.
 */
export function useDialogoAccesible(abierto: boolean, onCerrar: () => void) {
  const referencia = useRef<HTMLDivElement>(null);
  const cerrar = useRef(onCerrar);

  useEffect(() => {
    cerrar.current = onCerrar;
  }, [onCerrar]);

  useEffect(() => {
    if (!abierto) return;

    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const nodo = referencia.current;
    const lista = (): HTMLElement[] =>
      nodo ? Array.from(nodo.querySelectorAll<HTMLElement>(ENFOCABLES)) : [];

    const inicial = nodo?.querySelector<HTMLElement>('[data-inicial]') ?? lista()[0];
    inicial?.focus();

    function manejarTeclado(evento: KeyboardEvent): void {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        evento.stopPropagation();
        cerrar.current();
        return;
      }
      if (evento.key !== 'Tab') return;

      const elementos = lista();
      if (elementos.length === 0) {
        evento.preventDefault();
        return;
      }
      const primero = elementos[0];
      const ultimo = elementos[elementos.length - 1];
      if (!primero || !ultimo) return;

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', manejarTeclado, true);
    return () => {
      document.removeEventListener('keydown', manejarTeclado, true);
      anterior?.focus();
    };
  }, [abierto]);

  return referencia;
}
