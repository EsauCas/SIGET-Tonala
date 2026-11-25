/**
 * Copia los archivos locales de Tesseract a public/tesseract para que el OCR
 * funcione SIN internet en modo DEMO. No descarga nada de un CDN en runtime.
 * Ejecutar después de npm install: npm run setup:ocr
 */
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const raiz = process.cwd();
const destino = path.join(raiz, 'public', 'tesseract');
const workerOrigen = path.join(raiz, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js');
const coreOrigen = path.join(raiz, 'node_modules', 'tesseract.js-core');
const spaComprimido = path.join(
  raiz,
  'node_modules',
  '@tesseract.js-data',
  'spa',
  '4.0.0_best_int',
  'spa.traineddata.gz'
);

async function copiar(origen, destinoArchivo) {
  await copyFile(origen, destinoArchivo);
  console.log(`  ${path.relative(raiz, destinoArchivo)}`);
}

async function main() {
  await mkdir(path.join(destino, 'core'), { recursive: true });
  await mkdir(path.join(destino, 'lang'), { recursive: true });

  console.log('Copiando OCR local a public/tesseract:');
  await copiar(workerOrigen, path.join(destino, 'worker.min.js'));

  const archivosCore = await readdir(coreOrigen);
  for (const archivo of archivosCore) {
    if (archivo.startsWith('tesseract-core') && /\.(js|wasm)$/.test(archivo)) {
      await copiar(path.join(coreOrigen, archivo), path.join(destino, 'core', archivo));
    }
  }

  const comprimido = await readFile(spaComprimido);
  const spa = gunzipSync(comprimido);
  await writeFile(path.join(destino, 'lang', 'spa.traineddata'), spa);
  await copiar(spaComprimido, path.join(destino, 'lang', 'spa.traineddata.gz'));
  console.log(`  public/tesseract/lang/spa.traineddata (${(spa.length / 1024 / 1024).toFixed(1)} MB)`);
  console.log('Listo. Usa workerPath=/tesseract/worker.min.js, corePath=/tesseract/core, langPath=/tesseract/lang y gzip=false.');
}

main().catch((error) => {
  const mensaje = error instanceof Error ? error.message : String(error);
  console.error(`setup:ocr falló: ${mensaje}`);
  console.error('Verifica que npm install se haya ejecutado correctamente.');
  process.exitCode = 1;
});
