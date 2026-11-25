// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLAVE_RELOJ_DEMO,
  ahoraDemo,
  avanzarRelojDemo,
  inicializarRelojDemo,
  now,
  reiniciarRelojDemo,
  suscribirRelojDemo
} from '@/lib/reloj-demo';

const HORA = 60 * 60 * 1000;

describe('Reloj de demostración', () => {
  beforeEach(() => {
    window.localStorage.clear();
    reiniciarRelojDemo();
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-25T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    reiniciarRelojDemo();
  });

  it('avanza 24, 48 y 72 horas y guarda el desplazamiento', () => {
    const base = ahoraDemo().getTime();

    avanzarRelojDemo(24);
    expect(ahoraDemo().getTime() - base).toBe(24 * HORA);

    avanzarRelojDemo(48);
    expect(ahoraDemo().getTime() - base).toBe(72 * HORA);

    avanzarRelojDemo(72);
    expect(ahoraDemo().getTime() - base).toBe(144 * HORA);
    expect(window.localStorage.getItem(CLAVE_RELOJ_DEMO)).toBe(String(144 * HORA));
  });

  it('restablece el reloj a la hora real y borra la clave', () => {
    avanzarRelojDemo(24);
    reiniciarRelojDemo();

    expect(window.localStorage.getItem(CLAVE_RELOJ_DEMO)).toBeNull();
    expect(ahoraDemo().getTime()).toBe(Date.now());
    expect(now().getTime()).toBe(ahoraDemo().getTime());
  });

  it('notifica a las vistas suscritas y lee el desplazamiento guardado', () => {
    window.localStorage.setItem(CLAVE_RELOJ_DEMO, String(24 * HORA));
    inicializarRelojDemo(true);

    const oyente = vi.fn();
    const cancelar = suscribirRelojDemo(oyente);
    avanzarRelojDemo(24);

    expect(oyente).toHaveBeenCalledTimes(1);
    expect(ahoraDemo().getTime()).toBe(Date.now() + 48 * HORA);

    cancelar();
    avanzarRelojDemo(24);
    expect(oyente).toHaveBeenCalledTimes(1);
  });
});
