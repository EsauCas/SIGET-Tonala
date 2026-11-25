import type { Config } from 'tailwindcss';
import { TOKENS_DISENO } from './src/lib/tokens-diseno';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        papel: TOKENS_DISENO.papel,
        superficie: TOKENS_DISENO.superficie,
        tinta: TOKENS_DISENO.tinta,
        cafe: TOKENS_DISENO.cafeOscuro,
        barro: TOKENS_DISENO.barro,
        barroOscuro: TOKENS_DISENO.barroOscuro,
        ocre: TOKENS_DISENO.ocre,
        arena: TOKENS_DISENO.arena,
        bordeCampo: TOKENS_DISENO.bordeCampo,
        foco: TOKENS_DISENO.foco,
        semaforo: {
          gris: TOKENS_DISENO.semaforo.gris,
          azul: TOKENS_DISENO.semaforo.azul,
          ambar: TOKENS_DISENO.semaforo.ambar,
          rojo: TOKENS_DISENO.semaforo.rojo,
          verde: TOKENS_DISENO.semaforo.verde,
          fondo: { ...TOKENS_DISENO.fondosSemaforo }
        },
        // Alias conservados para componentes existentes; apuntan a la nueva identidad.
        lienzo: TOKENS_DISENO.papel,
        enfasis: TOKENS_DISENO.barro,
        exito: TOKENS_DISENO.semaforo.verde,
        alerta: TOKENS_DISENO.semaforo.ambar,
        peligro: TOKENS_DISENO.semaforo.rojo
      },
      fontFamily: {
        sistema: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ]
      },
      fontSize: {
        lg: ['1.125rem', { lineHeight: '1.75' }],
        xl: ['1.5rem', { lineHeight: '1.4' }],
        '2xl': ['1.75rem', { lineHeight: '1.35' }],
        '3xl': ['2rem', { lineHeight: '1.3' }]
      },
      minHeight: {
        control: '52px',
        tactil: '44px'
      },
      borderWidth: {
        8: '8px'
      },
      borderRadius: {
        control: '12px'
      }
    }
  },
  plugins: []
};

export default config;
