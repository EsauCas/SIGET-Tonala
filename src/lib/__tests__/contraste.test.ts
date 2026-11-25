import { describe, expect, it } from 'vitest';
import {
  PARES_GRAFICOS,
  PARES_TEXTO,
  TOKENS_DISENO,
  contraste
} from '@/lib/tokens-diseno';

describe('tokens de identidad visual · contraste WCAG', () => {
  it('todo par texto/fondo definido cumple al menos 7:1 (AAA)', () => {
    for (const par of PARES_TEXTO) {
      const relacion = contraste(par.texto, par.fondo);
      expect(relacion, `${par.nombre}: ${relacion.toFixed(2)}:1`).toBeGreaterThanOrEqual(7);
    }
  });

  it('bordes de campo y contorno de foco cumplen al menos 3:1', () => {
    for (const par of PARES_GRAFICOS) {
      const relacion = contraste(par.primario, par.fondo);
      expect(relacion, `${par.nombre}: ${relacion.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  });

  it('los colores exigidos por la identidad permanecen intactos', () => {
    expect(TOKENS_DISENO).toMatchObject({
      papel: '#FBF5EC',
      superficie: '#FFFFFF',
      tinta: '#2B1810',
      cafeOscuro: '#4A2C1A',
      barro: '#8F3A18',
      ocre: '#E8B04B',
      arena: '#D9C3A5',
      bordeCampo: '#7A5C45',
      foco: '#0B3D91'
    });
    expect(TOKENS_DISENO.barroOscuro).not.toBe(TOKENS_DISENO.barro);
    expect(contraste(TOKENS_DISENO.barroOscuro, TOKENS_DISENO.papel)).toBeGreaterThan(
      contraste(TOKENS_DISENO.barro, TOKENS_DISENO.papel)
    );
  });
});
