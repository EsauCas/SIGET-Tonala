'use client';

/**
 * Preprocesamiento de imágenes para tesseract.js. Todo ocurre en el navegador:
 * ni el worker ni las traineddata se descargan de un CDN (ver setup-ocr.mjs).
 */

import { LIMITE_BASE64_DEMO, TAMANO_MAXIMO_EVIDENCIA } from '@/lib/archivos';
import type { ImagenOcr } from '@/types/ocr';

export const LADO_MAXIMO_OCR = 2000;
const CALIDADES_JPEG: readonly number[] = [0.9, 0.82, 0.72, 0.6, 0.5];

export interface ImagenProcesadaOcr {
  imagen: ImagenOcr;
  canvas: HTMLCanvasElement;
}

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

/** Función pura: sirve para calcular el tamaño antes de tocar el DOM. */
export function calcularDimensiones(
  ancho: number,
  alto: number,
  maximo: number = LADO_MAXIMO_OCR
): { ancho: number; alto: number } {
  if (!Number.isFinite(ancho) || !Number.isFinite(alto) || ancho <= 0 || alto <= 0) {
    return { ancho: 1, alto: 1 };
  }
  const factor = Math.min(1, maximo / Math.max(ancho, alto));
  return {
    ancho: Math.max(1, Math.round(ancho * factor)),
    alto: Math.max(1, Math.round(alto * factor))
  };
}

export function validarImagenOcr(archivo: { type: string; size: number }): string | null {
  if (!archivo.type.startsWith('image/')) {
    return 'Elige una foto o una imagen JPG, PNG o WebP.';
  }
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/bmp'].includes(archivo.type)) {
    return 'Elige una foto JPG, PNG o WebP. Otros formatos no se leen bien.';
  }
  if (archivo.size <= 0) return 'El archivo está vacío. Toma otra foto.';
  if (archivo.size > TAMANO_MAXIMO_EVIDENCIA) {
    return 'La imagen pesa más de 5 MB. Toma otra foto más pequeña.';
  }
  return null;
}

function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(archivo);
  return new Promise((resolve, reject) => {
    const imagen = new Image();
    imagen.onload = () => {
      URL.revokeObjectURL(url);
      resolve(imagen);
    };
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No pudimos abrir la imagen. Toma otra foto e inténtalo de nuevo.'));
    };
    imagen.src = url;
  });
}

function crearCanvas(ancho: number, alto: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  return canvas;
}

function preprocesar(
  imagen: HTMLImageElement,
  ancho: number,
  alto: number
): HTMLCanvasElement {
  const canvas = crearCanvas(ancho, alto);
  const contexto = canvas.getContext('2d', { willReadFrequently: true });
  if (!contexto) throw new Error('Este navegador no puede preparar la imagen para lectura.');

  contexto.drawImage(imagen, 0, 0, ancho, alto);
  const pixeles = contexto.getImageData(0, 0, ancho, alto);
  const datos = pixeles.data;

  for (let indice = 0; indice < datos.length; indice += 4) {
    const rojo = datos[indice] ?? 0;
    const verde = datos[indice + 1] ?? 0;
    const azul = datos[indice + 2] ?? 0;
    const gris = 0.299 * rojo + 0.587 * verde + 0.114 * azul;
    const conContraste = limitar((gris - 128) * 1.35 + 128, 0, 255);
    // Binarización suave: no elimina trazos finos del todo (útil en manuscritos).
    const factor = limitar((conContraste - 145) / 70, 0, 1);
    const valor = conContraste * 0.35 + 255 * factor * 0.65;
    datos[indice] = valor;
    datos[indice + 1] = valor;
    datos[indice + 2] = valor;
  }
  contexto.putImageData(pixeles, 0, 0);
  return canvas;
}

function aBlob(canvas: HTMLCanvasElement, calidad: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', calidad));
}

function reducir(canvas: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const destino = crearCanvas(
    Math.max(1, Math.round(canvas.width * factor)),
    Math.max(1, Math.round(canvas.height * factor))
  );
  const contexto = destino.getContext('2d');
  if (!contexto) throw new Error('No pudimos comprimir la imagen.');
  contexto.drawImage(canvas, 0, 0, destino.width, destino.height);
  return destino;
}

function nombreJpeg(nombre: string): string {
  return `${nombre.replace(/\.[^.]+$/, '') || 'documento'}.jpg`;
}

async function exportarComprimido(
  canvasInicial: HTMLCanvasElement,
  nombreOriginal: string
): Promise<{ blob: Blob; nombre: string; mime: string; sizeBytes: number }> {
  let canvas = canvasInicial;
  for (let intento = 0; intento < 4; intento += 1) {
    for (const calidad of CALIDADES_JPEG) {
      const blob = await aBlob(canvas, calidad);
      if (blob && blob.size <= TAMANO_MAXIMO_EVIDENCIA) {
        return {
          blob,
          nombre: nombreJpeg(nombreOriginal),
          mime: 'image/jpeg',
          sizeBytes: blob.size
        };
      }
    }
    canvas = reducir(canvas, 0.8);
  }
  throw new Error('La imagen sigue pesando más de 5 MB. Toma otra foto más cercana al documento.');
}

export async function imagenABase64(blob: Blob): Promise<string | undefined> {
  if (blob.size > LIMITE_BASE64_DEMO) return undefined;
  return new Promise((resolve) => {
    const lector = new FileReader();
    lector.onload = () => {
      const resultado = lector.result;
      resolve(typeof resultado === 'string' ? resultado.split(',')[1] : undefined);
    };
    lector.onerror = () => resolve(undefined);
    lector.readAsDataURL(blob);
  });
}

/** Prepara una imagen ≤2000 px, en gris y comprimida, lista para OCR y guardado. */
export async function prepararImagenParaOcr(archivo: File): Promise<ImagenProcesadaOcr> {
  const problema = validarImagenOcr(archivo);
  if (problema) throw new Error(problema);

  const cargada = await cargarImagen(archivo);
  const dimensiones = calcularDimensiones(cargada.naturalWidth, cargada.naturalHeight);
  const canvas = preprocesar(cargada, dimensiones.ancho, dimensiones.alto);
  const exportada = await exportarComprimido(canvas, archivo.name);
  const contenidoBase64 = await imagenABase64(exportada.blob);

  return {
    canvas,
    imagen: {
      blob: exportada.blob,
      nombre: exportada.nombre,
      mime: exportada.mime,
      sizeBytes: exportada.sizeBytes,
      ancho: dimensiones.ancho,
      alto: dimensiones.alto,
      ...(contenidoBase64 ? { contenidoBase64 } : {})
    }
  };
}
