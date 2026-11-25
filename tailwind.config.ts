import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        tinta: '#111827',
        lienzo: '#F8FAFC',
        enfasis: '#1D4ED8',
        exito: '#166534',
        alerta: '#92400E',
        peligro: '#991B1B',
        semaforo: {
          gris: '#475569',
          azul: '#1D4ED8',
          ambar: '#92400E',
          rojo: '#991B1B',
          verde: '#166534'
        }
      },
      fontSize: {
        lg: ['18px', { lineHeight: '1.75' }],
        xl: ['24px', { lineHeight: '1.35' }],
        '2xl': ['28px', { lineHeight: '1.3' }],
        '3xl': ['32px', { lineHeight: '1.25' }]
      },
      minHeight: {
        control: '52px',
        tactil: '44px'
      },
      borderRadius: {
        control: '12px'
      }
    }
  },
  plugins: []
};

export default config;
