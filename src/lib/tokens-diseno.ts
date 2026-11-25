/**
 * Tokens de identidad visual de Tonalá (barro, café y alfarería).
 * Esta única fuente la consumen Tailwind y la prueba de contraste.
 */
export const TOKENS_DISENO = {
  papel: '#FBF5EC',
  superficie: '#FFFFFF',
  tinta: '#2B1810',
  cafeOscuro: '#4A2C1A',
  barro: '#8F3A18',
  barroOscuro: '#6E2B10',
  ocre: '#E8B04B',
  arena: '#D9C3A5',
  bordeCampo: '#7A5C45',
  foco: '#0B3D91',
  semaforo: {
    gris: '#475569',
    azul: '#1D4ED8',
    ambar: '#92400E',
    rojo: '#991B1B',
    verde: '#166534'
  },
  fondosSemaforo: {
    gris: '#EFEAE2',
    azul: '#E7EFFC',
    ambar: '#FCF1DA',
    rojo: '#FBE8E2',
    verde: '#E3F0E4'
  }
} as const;

/** Pares textuales que deben cumplir AAA (7:1). */
export const PARES_TEXTO = [
  { nombre: 'texto principal sobre papel', texto: TOKENS_DISENO.tinta, fondo: TOKENS_DISENO.papel },
  { nombre: 'texto principal sobre tarjeta', texto: TOKENS_DISENO.tinta, fondo: TOKENS_DISENO.superficie },
  { nombre: 'texto blanco sobre café oscuro', texto: TOKENS_DISENO.superficie, fondo: TOKENS_DISENO.cafeOscuro },
  { nombre: 'texto blanco sobre barro', texto: TOKENS_DISENO.superficie, fondo: TOKENS_DISENO.barro },
  { nombre: 'texto blanco sobre barro oscuro', texto: TOKENS_DISENO.superficie, fondo: TOKENS_DISENO.barroOscuro },
  { nombre: 'texto principal sobre ocre', texto: TOKENS_DISENO.tinta, fondo: TOKENS_DISENO.ocre },
  { nombre: 'texto principal sobre franja gris', texto: TOKENS_DISENO.tinta, fondo: TOKENS_DISENO.fondosSemaforo.gris },
  { nombre: 'texto principal sobre franja azul', texto: TOKENS_DISENO.tinta, fondo: TOKENS_DISENO.fondosSemaforo.azul },
  { nombre: 'texto principal sobre franja ámbar', texto: TOKENS_DISENO.tinta, fondo: TOKENS_DISENO.fondosSemaforo.ambar },
  { nombre: 'texto principal sobre franja roja', texto: TOKENS_DISENO.tinta, fondo: TOKENS_DISENO.fondosSemaforo.rojo },
  { nombre: 'texto principal sobre franja verde', texto: TOKENS_DISENO.tinta, fondo: TOKENS_DISENO.fondosSemaforo.verde },
  { nombre: 'blanco sobre gris funcional', texto: TOKENS_DISENO.superficie, fondo: TOKENS_DISENO.semaforo.gris },
  { nombre: 'blanco sobre ámbar funcional', texto: TOKENS_DISENO.superficie, fondo: TOKENS_DISENO.semaforo.ambar },
  { nombre: 'blanco sobre rojo funcional', texto: TOKENS_DISENO.superficie, fondo: TOKENS_DISENO.semaforo.rojo },
  { nombre: 'blanco sobre verde funcional', texto: TOKENS_DISENO.superficie, fondo: TOKENS_DISENO.semaforo.verde }
] as const;

/** Componentes no textuales: bordes de campo y foco (mínimo 3:1). */
export const PARES_GRAFICOS = [
  { nombre: 'borde de campo sobre papel', primario: TOKENS_DISENO.bordeCampo, fondo: TOKENS_DISENO.papel },
  { nombre: 'borde de campo sobre tarjeta', primario: TOKENS_DISENO.bordeCampo, fondo: TOKENS_DISENO.superficie },
  { nombre: 'contorno de foco sobre papel', primario: TOKENS_DISENO.foco, fondo: TOKENS_DISENO.papel },
  { nombre: 'contorno de foco sobre tarjeta', primario: TOKENS_DISENO.foco, fondo: TOKENS_DISENO.superficie }
] as const;

/**
 * La arena se usa sólo como divisoria decorativa (aria-hidden, sin texto
 * encima), por lo que no está sujeta al mínimo de 3:1 de componentes activos.
 */
export const ARENA_DECORATIVA = TOKENS_DISENO.arena;

/** WCAG 2.1: luminancia relativa sRGB. */
export function luminancia(color: string): number {
  const hexadecimal = color.replace('#', '');
  const [rojo = 0, verde = 0, azul = 0] = [0, 2, 4].map((inicio) => {
    const valor = parseInt(hexadecimal.slice(inicio, inicio + 2), 16) / 255;
    return valor <= 0.03928 ? valor / 12.92 : Math.pow((valor + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rojo + 0.7152 * verde + 0.0722 * azul;
}

/** Relación de contraste entre dos colores (1 a 21). */
export function contraste(a: string, b: string): number {
  const clara = Math.max(luminancia(a), luminancia(b));
  const oscura = Math.min(luminancia(a), luminancia(b));
  return (clara + 0.05) / (oscura + 0.05);
}
