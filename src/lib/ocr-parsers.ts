/**
 * Parsers puros de los tres formatos de SIGET-Tonalá. No usan navegador ni
 * repositorio: reciben texto (de Tesseract o de una prueba) y devuelven datos
 * propuestos. Nada de aquí guarda expedientes; la confirmación la hace la UI.
 *
 * Los textos de prueba incluidos en las pruebas son SINTÉTICOS: el material
 * real llegó vacío en la entrega de la Fase 5.
 */

import type {
  CampoOcr,
  ClaveCampoOcr,
  FormatoOcr,
  OficioLeidoOcr,
  ResultadoOcr,
  SolicitudLeidaOcr
} from '@/types/ocr';

const CONFIANZA_POR_DEFECTO = 90;
const UMBRAL_VALIDACION = 80;

export interface OpcionesParser {
  /** Confianza global informada por tesseract.js (0-100). */
  confianzaGlobal?: number;
  imagen?: ResultadoOcr['imagen'];
}

interface Localizacion {
  crudo: string;
  valor: string;
  inicio: number;
  fin: number;
}

const ETIQUETAS_CAMPO: Readonly<Partial<Record<ClaveCampoOcr, string>>> = {
  numero_control: 'Número de control',
  folio: 'Folio',
  fecha_solicitud: 'Fecha de la solicitud',
  nombre_contribuyente: 'Nombre de la persona contribuyente',
  domicilio_contribuyente: 'Domicilio de la persona contribuyente',
  domicilio_negocio: 'Domicilio del negocio',
  colonia: 'Colonia',
  cp: 'Código postal',
  telefono: 'Teléfono',
  tipo_tramite: 'Tipo de trámite',
  giro_principal: 'Giro principal',
  giros_anexos: 'Giros anexos',
  superficie_m2: 'Superficie en m²',
  inversion_estimada: 'Inversión estimada',
  numero_oficio: 'Número de oficio',
  fecha_emision: 'Fecha de emisión',
  dependencia_destino: 'Dependencia destinataria',
  sello_fecha: 'Fecha del sello',
  sello_hora: 'Hora del sello',
  sello_folio: 'Folio manuscrito del sello',
  acuse_folio: 'Folio del acuse',
  acuse_fecha: 'Fecha del acuse',
  acuse_hora: 'Hora del acuse'
};

const ETIQUETA_FORMATO: Readonly<Record<FormatoOcr, string>> = {
  solicitud: 'solicitud',
  oficio_verificacion: 'oficio de verificación',
  oficio_multidependencia: 'oficio multidependencia',
  desconocido: 'documento sin formato reconocido'
};

export function etiquetaCampo(clave: string): string {
  const dinamica = /^solicitud_(\d+)_(numero_control|folio|giros)$/.exec(clave);
  if (dinamica?.[1] && dinamica[2]) {
    const nombre = dinamica[2] === 'numero_control' ? 'número de control' : dinamica[2];
    return `Solicitud ${dinamica[1]} · ${nombre}`;
  }
  return ETIQUETAS_CAMPO[clave as ClaveCampoOcr] ?? clave;
}

export function sinAcentos(valor: string): string {
  return valor.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function limitar(valor: number, minimo = 0, maximo = 100): number {
  if (!Number.isFinite(valor)) return minimo;
  return Math.min(maximo, Math.max(minimo, valor));
}

function confianzaBase(opciones: Readonly<OpcionesParser>): number {
  return limitar(Math.round(opciones.confianzaGlobal ?? CONFIANZA_POR_DEFECTO));
}

function crearCampo(
  valor: string,
  confianza: number,
  manuscrito = false,
  validadoPorHumano = false
): CampoOcr {
  const texto = valor.trim();
  const confianzaFinal = limitar(confianza);
  return {
    valor: texto,
    confianza: confianzaFinal,
    requiereValidacion:
      !validadoPorHumano && (!texto || manuscrito || confianzaFinal < UMBRAL_VALIDACION),
    ...(validadoPorHumano ? { validadoPorHumano: true } : {})
  };
}

/** Convierte O/0, I/1 y S/5 sólo en cadenas que sabemos que son numéricas. */
export function digitosOcr(valor: string): string {
  return sinAcentos(valor)
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .replace(/S/g, '5')
    .replace(/[^0-9]/g, '');
}

function localizarNumeroControl(texto: string): Localizacion | null {
  const normal = sinAcentos(texto).toUpperCase();
  const coincidencias = normal.matchAll(
    /(C\s*0?\s*N\s*T\s*R\s*0?\s*L|CTRL)[\s\-/:]*([0-9OIS]{4})[\s\-/:]*([0-9OIS]{4})/g
  );
  for (const coincidencia of coincidencias) {
    const anio = coincidencia[2];
    const consecutivo = coincidencia[3];
    // O/I/S dentro de palabras ("EMISION") no son dígitos: exigimos al menos
    // un número real para no inventar folios a partir del texto corriente.
    if (!anio || !consecutivo || !/\d/.test(anio + consecutivo)) continue;
    const inicio = coincidencia.index ?? 0;
    return {
      crudo: coincidencia[0],
      valor: coincidencia[0],
      inicio,
      fin: inicio + coincidencia[0].length
    };
  }
  return null;
}

export function canonizarNumeroControl(valor: string): string | null {
  const normal = sinAcentos(valor).toUpperCase().replace(/\s+/g, ' ');
  const partes =
    /(?:C\s*0?\s*N\s*T\s*R\s*0?\s*L|CTRL)[\s\-/:]*([0-9OIS]{4})[\s\-/:]*([0-9OIS]{4})/.exec(
      normal
    );
  if (!partes?.[1] || !partes[2]) return null;
  const anio = digitosOcr(partes[1]);
  const consecutivo = digitosOcr(partes[2]);
  if (anio.length !== 4 || consecutivo.length !== 4) return null;
  return `CTRL-${anio}-${consecutivo}`;
}

function localizarFolio(texto: string): Localizacion | null {
  const normal = sinAcentos(texto).toUpperCase();
  // `[ -]` en lugar de `\s`: un folio NUNCA debe cruzar a la línea siguiente.
  const coincidencias = normal.matchAll(
    /([0-9OIS](?:[0-9OIS -]*[0-9OIS])?)[ -]*-?[ -]*([A-Z])(?=$|[^A-Z0-9])/g
  );
  for (const coincidencia of coincidencias) {
    const numero = coincidencia[1];
    if (!numero || !/\d/.test(numero) || !coincidencia[2]) continue;
    const inicio = coincidencia.index ?? 0;
    return {
      crudo: coincidencia[0].trim(),
      valor: coincidencia[0].trim(),
      inicio,
      fin: inicio + coincidencia[0].length
    };
  }
  return null;
}

/** Folios canónicos NNNN-X, tolerando O/0, I/1, S/5 y espacios internos. */
export function canonizarFolio(valor: string): string | null {
  const localizado = localizarFolio(valor);
  if (!localizado) return null;
  const normal = sinAcentos(localizado.valor).toUpperCase().replace(/\s+/g, ' ');
  const partes = /^([0-9OIS][0-9OIS\s-]*)\s*-?\s*([A-Z])$/.exec(normal.trim());
  if (!partes?.[1] || !partes[2]) return null;
  const numero = digitosOcr(partes[1]);
  if (numero.length !== 4) return null;
  return `${numero}-${partes[2]}`;
}

/** Como digitosOcr, pero conserva el punto decimal de la superficie en m². */
function decimalOcr(valor: string): string {
  return valor
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .replace(/S/g, '5')
    .replace(/[^0-9.]/g, '');
}

export function canonizarNumeroOficio(valor: string): string | null {
  const normal = sinAcentos(valor).toUpperCase().replace(/\s+/g, '');
  const dpl = /DPL[\/\-]?VF[\/\-]?([0-9OIS]{4})[\/\-]?([0-9OIS]{4})/.exec(normal);
  if (dpl?.[1] && dpl[2]) {
    const consecutivo = digitosOcr(dpl[1]);
    const anio = digitosOcr(dpl[2]);
    if (consecutivo.length === 4 && anio.length === 4) {
      return `DPL/VF/${consecutivo}/${anio}`;
    }
  }
  const of = /OF[\/\-]?([0-9OIS]{4})[\/\-]?([0-9OIS]{4})[\/\-]?([0-9OIS]{2})/.exec(normal);
  if (of?.[1] && of[2] && of[3]) {
    const anio = digitosOcr(of[1]);
    const consecutivo = digitosOcr(of[2]);
    const renglon = digitosOcr(of[3]);
    if (anio.length === 4 && consecutivo.length === 4 && renglon.length === 2) {
      return `OF-${anio}-${consecutivo}-${renglon}`;
    }
  }
  return null;
}

export function normalizarFecha(valor: string): string {
  const texto = sinAcentos(valor)
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .replace(/S/g, '5');
  const larga = /^(\d{4})[-/.]?(\d{2})[-/.]?(\d{2})$/.exec(texto);
  if (larga?.[1] && larga[2] && larga[3]) return `${larga[1]}-${larga[2]}-${larga[3]}`;
  const corta = /^(\d{2})[-/.]?(\d{2})[-/.]?(\d{4})$/.exec(texto);
  if (corta?.[1] && corta[2] && corta[3]) return `${corta[3]}-${corta[2]}-${corta[1]}`;
  return '';
}

export function normalizarHora(valor: string): string {
  const texto = sinAcentos(valor)
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .replace(/S/g, '5');
  const coincidencia = /\b(\d{1,2}):(\d{2})\b/.exec(texto);
  if (!coincidencia?.[1] || !coincidencia[2]) return '';
  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);
  if (horas > 23 || minutos > 59) return '';
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

export function normalizarTipoTramite(valor: string): string {
  const texto = sinAcentos(valor).toUpperCase();
  if (/RESTRINGIDO/.test(texto)) return 'Giro Restringido';
  if (/ANUNCIO/.test(texto)) return 'Anuncios';
  if (/GIRO\s*BLANCO|BLANCO/.test(texto)) return 'Giro Blanco';
  if (/PERMISO/.test(texto)) return 'Permiso de funcionamiento';
  if (/LICENCIA|NUEVA/.test(texto)) return 'Licencia de funcionamiento';
  return valor.trim();
}

export function normalizarDependencia(valor: string): string {
  const texto = sinAcentos(valor).toUpperCase();
  if (/BOMBEROS/.test(texto)) return 'Bomberos Tonalá';
  if (/PROTECCION\s*CIVIL/.test(texto)) return 'Protección Civil Tonalá';
  if (/VENTANILLA|PADRON|LICENCIAS/.test(texto)) return 'Ventanilla';
  return valor.trim().replace(/\s+/g, ' ');
}

function escapar(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patronEtiqueta(etiqueta: string): string {
  return sinAcentos(etiqueta)
    .trim()
    .split(/\s+/)
    .map(escapar)
    .join('[\\s:_\\-\\/]+');
}

const PALABRAS_ETIQUETA =
  'FECHA|HORA|FOLIO|DEPENDENCIA|RECIBIDO|ACUSE|OBSERVACIONES|NUMERO|N[°.]?\\s*CONTROL|COLONIA|CODIGO\\s*POSTAL|CP|TELEFONO|TIPO|SUPERFICIE|INVERSION|SOLICITUDES|ACEPTAR|CANCELAR';

/** Busca un valor tras una etiqueta, incluso si la etiqueta está partida en líneas. */
function valorTrasEtiqueta(texto: string, etiquetas: readonly string[]): string | null {
  const normal = sinAcentos(texto);
  for (const etiqueta of etiquetas) {
    const patron = new RegExp(
      `${patronEtiqueta(etiqueta)}\\s*[:=\\-]?\\s*(?:\\n\\s*)?([^\\n]+)`,
      'i'
    );
    const coincidencia = patron.exec(normal);
    if (!coincidencia?.[1]) continue;
    let valor = coincidencia[1].trim();
    valor = valor.replace(new RegExp(`\\s+(?=(?:${PALABRAS_ETIQUETA})\\s*[:=])`, 'i'), '').trim();
    valor = valor.replace(/^[:=\-]\s*/, '').trim();
    if (!valor) continue;
    if (new RegExp(`^(?:${PALABRAS_ETIQUETA})\\b`, 'i').test(valor)) continue;
    return valor;
  }
  return null;
}

function dividirGiros(valor: string): string[] {
  return valor
    .split(/[,;|]+/)
    .map((giro) => giro.trim())
    .filter((giro) => giro.length > 0);
}

function agregarGiros(destino: string[], texto: string): void {
  for (const giro of dividirGiros(texto)) {
    if (!destino.some((existente) => existente.toLowerCase() === giro.toLowerCase())) {
      destino.push(giro);
    }
  }
}

function extraerSolicitudes(texto: string): SolicitudLeidaOcr[] {
  const lineas = texto.split('\n').map((linea) => linea.trim()).filter(Boolean);
  const resultados: SolicitudLeidaOcr[] = [];
  let actual: SolicitudLeidaOcr | null = null;

  function cerrar(): void {
    if (actual && (actual.numero_control || actual.folio)) resultados.push(actual);
    actual = null;
  }

  for (const linea of lineas) {
    // El folio del sello o del acuse pertenece al oficio, NO a una solicitud.
    if (/FOLIO\s+DEL\s+ACUSE|FOLIO\s+MANUSCRITO|FOLIO\s+DEL\s+SELLO|RECIBIDO|SELLO/i.test(linea)) {
      continue;
    }
    const control = localizarNumeroControl(linea);
    const folio = localizarFolio(linea);
    const giroEtiquetado = valorTrasEtiqueta(linea, ['GIRO PRINCIPAL', 'GIRO', 'GIROS']);

    if (control || folio) {
      cerrar();
      actual = {
        numero_control: control ? (canonizarNumeroControl(control.valor) ?? '') : '',
        folio: folio ? (canonizarFolio(folio.valor) ?? '') : '',
        giros: []
      };
    }

    if (!actual) continue;

    if (giroEtiquetado) {
      agregarGiros(actual.giros, giroEtiquetado);
      continue;
    }

    let resto = linea;
    for (const localizado of [folio, control]) {
      if (localizado) resto = resto.replace(localizado.crudo, ' ');
    }
    resto = resto.replace(/^[\s,;:|\-/]+/, '').replace(/[\s,;:|]+$/, '').trim();
    if (
      resto &&
      resto.length < 90 &&
      !new RegExp(`^(?:${PALABRAS_ETIQUETA})\\b`, 'i').test(resto)
    ) {
      agregarGiros(actual.giros, resto);
    }
  }
  cerrar();
  return resultados;
}

function armarResultado(
  formato: FormatoOcr,
  campos: Partial<Record<ClaveCampoOcr, CampoOcr>>,
  faltantes: string[],
  advertencias: string[],
  textoCompleto: string,
  opciones: Readonly<OpcionesParser>,
  oficio?: OficioLeidoOcr,
  solicitudes?: SolicitudLeidaOcr[]
): ResultadoOcr {
  const conValidacion = Object.values(campos).some((campo) => campo?.requiereValidacion === true);
  const avisos = [...advertencias];
  if (conValidacion && !avisos.some((aviso) => aviso.includes('baja confianza'))) {
    avisos.push('Hay datos con baja confianza o que faltan. Revísalos antes de continuar.');
  }
  return {
    formato,
    campos,
    faltantes,
    advertencias: avisos,
    textoCompleto,
    ...(oficio ? { oficio } : {}),
    ...(solicitudes ? { solicitudes } : {}),
    ...(opciones.imagen ? { imagen: opciones.imagen } : {})
  };
}

/** Parser A: solicitud provisional de licencias de giros o anuncios. */
export function parsearSolicitud(
  texto: string,
  opciones: Readonly<OpcionesParser> = {}
): ResultadoOcr {
  const normal = sinAcentos(texto);
  const campos: Partial<Record<ClaveCampoOcr, CampoOcr>> = {};
  const faltantes: string[] = [];
  const base = confianzaBase(opciones);

  function poner(
    clave: ClaveCampoOcr,
    valor: string,
    ajuste = 0,
    manuscrito = false
  ): void {
    const campo = crearCampo(valor, base + ajuste, manuscrito);
    campos[clave] = campo;
    if (!campo.valor) faltantes.push(etiquetaCampo(clave));
  }

  const controlCrudo = valorTrasEtiqueta(normal, [
    'NUMERO DE CONTROL',
    'NUMERO CONTROL',
    'N DE CONTROL',
    'CONTROL'
  ]) ?? '';
  const folioCrudo = valorTrasEtiqueta(normal, ['FOLIO DE LA SOLICITUD', 'FOLIO']) ?? '';
  const fechaCruda = valorTrasEtiqueta(normal, ['FECHA DE SOLICITUD', 'FECHA']) ?? '';
  const telefonoCrudo =
    valorTrasEtiqueta(normal, ['TELEFONO CELULAR', 'TELEFONO', 'CELULAR']) ?? '';
  const superficieCruda = valorTrasEtiqueta(normal, ['SUPERFICIE M2', 'SUPERFICIE']) ?? '';
  const inversionCruda = valorTrasEtiqueta(normal, ['INVERSION ESTIMADA', 'INVERSION']) ?? '';
  const tipoCrudo = valorTrasEtiqueta(normal, ['TIPO DE TRAMITE', 'TIPO TRAMITE']) ?? '';
  const giroCrudo = valorTrasEtiqueta(normal, ['GIRO PRINCIPAL', 'GIRO']) ?? '';
  const anexosCrudo = valorTrasEtiqueta(normal, ['GIROS ANEXOS', 'GIROS ADICIONALES']) ?? '';

  const control = canonizarNumeroControl(controlCrudo) ?? '';
  const folio = canonizarFolio(folioCrudo) ?? '';
  const fecha = normalizarFecha(fechaCruda);
  const telefono = digitosOcr(telefonoCrudo);
  const superficieMatch = /[0-9OIS]+(?:\.[0-9OIS]+)?/.exec(superficieCruda);
  const inversionMatch = /[0-9OIS]+/.exec(inversionCruda);
  const superficie = superficieMatch ? decimalOcr(superficieMatch[0]) : '';
  const inversion = inversionMatch ? digitosOcr(inversionMatch[0]) : '';

  poner('numero_control', control, controlCrudo && controlCrudo.toUpperCase() !== control ? -10 : 0);
  poner('folio', folio, folioCrudo && folioCrudo.toUpperCase() !== folio ? -10 : 0);
  poner('fecha_solicitud', fecha, fechaCruda && fechaCruda !== fecha ? -8 : 0);
  poner(
    'nombre_contribuyente',
    valorTrasEtiqueta(normal, [
      'NOMBRE DEL CONTRIBUYENTE',
      'NOMBRE CONTRIBUYENTE',
      'CONTRIBUYENTE'
    ]) ?? ''
  );
  poner(
    'domicilio_contribuyente',
    valorTrasEtiqueta(normal, [
      'DOMICILIO DEL CONTRIBUYENTE',
      'DOMICILIO CONTRIBUYENTE'
    ]) ?? ''
  );
  poner(
    'domicilio_negocio',
    valorTrasEtiqueta(normal, [
      'DOMICILIO DEL NEGOCIO',
      'DOMICILIO NEGOCIO',
      'DOMICILIO COMERCIAL'
    ]) ?? ''
  );
  poner('colonia', valorTrasEtiqueta(normal, ['COLONIA']) ?? '');
  poner('cp', digitosOcr(valorTrasEtiqueta(normal, ['CODIGO POSTAL', 'C P', 'CP']) ?? ''));
  poner('telefono', telefono.length === 10 ? telefono : telefono, telefono.length === 10 ? 0 : -15);
  poner('tipo_tramite', normalizarTipoTramite(tipoCrudo));
  poner('giro_principal', giroCrudo);
  poner('giros_anexos', dividirGiros(anexosCrudo).join(', '));
  poner('superficie_m2', superficie);
  poner('inversion_estimada', inversion);

  return armarResultado(
    'solicitud',
    campos,
    faltantes,
    [],
    texto,
    opciones
  );
}

function camposDeSolicitudes(
  campos: Partial<Record<ClaveCampoOcr, CampoOcr>>,
  faltantes: string[],
  solicitudes: readonly SolicitudLeidaOcr[],
  base: number
): void {
  solicitudes.forEach((solicitud, indice) => {
    const claveControl = `solicitud_${indice}_numero_control` as ClaveCampoOcr;
    const claveFolio = `solicitud_${indice}_folio` as ClaveCampoOcr;
    const claveGiros = `solicitud_${indice}_giros` as ClaveCampoOcr;
    for (const [clave, valor] of [
      [claveControl, solicitud.numero_control],
      [claveFolio, solicitud.folio],
      [claveGiros, solicitud.giros.join(', ')]
    ] as const) {
      const campo = crearCampo(valor, base);
      campos[clave] = campo;
      if (!campo.valor) faltantes.push(etiquetaCampo(clave));
    }
  });
}

/** Parser B: oficio DPL/VF/XXXX/2026 con sello RECIBIDO. */
export function parsearOficioVerificacion(
  texto: string,
  opciones: Readonly<OpcionesParser> = {}
): ResultadoOcr {
  const normal = sinAcentos(texto);
  const campos: Partial<Record<ClaveCampoOcr, CampoOcr>> = {};
  const faltantes: string[] = [];
  const advertencias: string[] = [];
  const base = confianzaBase(opciones);

  function poner(clave: ClaveCampoOcr, valor: string, ajuste = 0, manuscrito = false): void {
    const campo = crearCampo(valor, base + ajuste, manuscrito);
    campos[clave] = campo;
    if (!campo.valor) faltantes.push(etiquetaCampo(clave));
  }

  const numeroCrudo =
    valorTrasEtiqueta(normal, ['NUMERO DE OFICIO', 'NUMERO OFICIO', 'OFICIO']) ?? normal;
  const numero = canonizarNumeroOficio(numeroCrudo) ?? '';
  const fechaCruda = valorTrasEtiqueta(normal, ['FECHA DE EMISION', 'FECHA EMISION', 'FECHA']) ?? '';
  const dependenciaCruda =
    valorTrasEtiqueta(normal, ['DEPENDENCIA DESTINO', 'DEPENDENCIA DESTINATARIA', 'DEPENDENCIA']) ??
    '';

  poner('numero_oficio', numero, numero && numeroCrudo.toUpperCase() !== numero ? -10 : 0);
  poner('fecha_emision', normalizarFecha(fechaCruda), fechaCruda ? -4 : 0);
  poner('dependencia_destino', normalizarDependencia(dependenciaCruda));

  const indiceSello = normal.toUpperCase().indexOf('RECIBIDO');
  const bloqueSello = indiceSello >= 0 ? normal.slice(indiceSello) : '';
  const selloFolioCrudo =
    valorTrasEtiqueta(bloqueSello, [
      'FOLIO MANUSCRITO DEL SELLO',
      'FOLIO MANUSCRITO',
      'FOLIO DEL SELLO',
      'FOLIO SELLO',
      'FOLIO'
    ]) ?? '';
  const selloFechaCruda = valorTrasEtiqueta(bloqueSello, ['FECHA DEL SELLO', 'FECHA']) ?? '';
  const selloHoraCruda = valorTrasEtiqueta(bloqueSello, ['HORA DEL SELLO', 'HORA']) ?? '';

  poner('sello_folio', selloFolioCrudo, 0, true);
  poner('sello_fecha', normalizarFecha(selloFechaCruda));
  poner('sello_hora', normalizarHora(selloHoraCruda));

  if (indiceSello < 0) {
    advertencias.push('No aparece el sello RECIBIDO. Confirma la fecha y el folio con el oficio físico.');
  }

  const solicitudes = extraerSolicitudes(normal);
  camposDeSolicitudes(campos, faltantes, solicitudes, base);
  if (solicitudes.length === 0) {
    advertencias.push('No pudimos leer la tabla de solicitudes. Puedes escribir los folios a mano.');
  }

  const sello = {
    folio: campos.sello_folio?.valor ?? '',
    fecha: campos.sello_fecha?.valor ?? '',
    hora: campos.sello_hora?.valor ?? ''
  };
  const oficio: OficioLeidoOcr = {
    numero_oficio: campos.numero_oficio?.valor ?? '',
    fecha_emision: campos.fecha_emision?.valor ?? '',
    dependencia_destino: campos.dependencia_destino?.valor ?? '',
    sello,
    acuse: null,
    solicitudes
  };

  return armarResultado(
    'oficio_verificacion',
    campos,
    faltantes,
    advertencias,
    texto,
    opciones,
    oficio,
    solicitudes
  );
}

/** Parser C: oficio multidependencia con acuse y tabla completa de solicitudes. */
export function parsearOficioMultidependencia(
  texto: string,
  opciones: Readonly<OpcionesParser> = {}
): ResultadoOcr {
  const normal = sinAcentos(texto);
  const campos: Partial<Record<ClaveCampoOcr, CampoOcr>> = {};
  const faltantes: string[] = [];
  const advertencias: string[] = [];
  const base = confianzaBase(opciones);

  function poner(clave: ClaveCampoOcr, valor: string, ajuste = 0, manuscrito = false): void {
    const campo = crearCampo(valor, base + ajuste, manuscrito);
    campos[clave] = campo;
    if (!campo.valor) faltantes.push(etiquetaCampo(clave));
  }

  const numeroCrudo =
    valorTrasEtiqueta(normal, ['NUMERO DE OFICIO', 'NUMERO OFICIO', 'OFICIO']) ?? normal;
  const numero = canonizarNumeroOficio(numeroCrudo) ?? '';
  const fechaCruda = valorTrasEtiqueta(normal, ['FECHA DE EMISION', 'FECHA EMISION', 'FECHA']) ?? '';
  const dependenciaCruda =
    valorTrasEtiqueta(normal, ['DEPENDENCIA DESTINO', 'DEPENDENCIA DESTINATARIA', 'DEPENDENCIA']) ??
    '';
  const indiceAcuse = /A\s*C\s*U\s*S\s*E/i.exec(normal)?.index ?? -1;
  const bloqueAcuse = indiceAcuse >= 0 ? normal.slice(indiceAcuse) : '';

  poner('numero_oficio', numero, numero && numeroCrudo.toUpperCase() !== numero ? -10 : 0);
  poner('fecha_emision', normalizarFecha(fechaCruda), fechaCruda ? -4 : 0);
  poner('dependencia_destino', normalizarDependencia(dependenciaCruda));
  const acuseFolioCrudo =
    valorTrasEtiqueta(bloqueAcuse, ['FOLIO DEL ACUSE', 'FOLIO ACUSE', 'FOLIO']) ?? '';
  poner(
    'acuse_folio',
    canonizarFolio(acuseFolioCrudo) ?? acuseFolioCrudo,
    canonizarFolio(acuseFolioCrudo) ? 0 : -10
  );
  poner(
    'acuse_fecha',
    normalizarFecha(valorTrasEtiqueta(bloqueAcuse, ['FECHA DEL ACUSE', 'FECHA']) ?? '')
  );
  poner(
    'acuse_hora',
    normalizarHora(valorTrasEtiqueta(bloqueAcuse, ['HORA DEL ACUSE', 'HORA']) ?? '')
  );

  if (indiceAcuse < 0) {
    advertencias.push('No aparece la palabra ACUSE. Revisa el documento antes de continuar.');
  }

  const solicitudes = extraerSolicitudes(normal);
  camposDeSolicitudes(campos, faltantes, solicitudes, base);
  if (solicitudes.length === 0) {
    advertencias.push('No pudimos leer la tabla de solicitudes. Puedes escribir los folios a mano.');
  }

  const oficio: OficioLeidoOcr = {
    numero_oficio: campos.numero_oficio?.valor ?? '',
    fecha_emision: campos.fecha_emision?.valor ?? '',
    dependencia_destino: campos.dependencia_destino?.valor ?? '',
    sello: null,
    acuse: {
      folio: campos.acuse_folio?.valor ?? '',
      fecha: campos.acuse_fecha?.valor ?? '',
      hora: campos.acuse_hora?.valor ?? ''
    },
    solicitudes
  };

  return armarResultado(
    'oficio_multidependencia',
    campos,
    faltantes,
    advertencias,
    texto,
    opciones,
    oficio,
    solicitudes
  );
}

export function detectarFormato(texto: string): FormatoOcr {
  const normal = sinAcentos(texto).replace(/\s+/g, ' ').toUpperCase();
  const esOficio = /(?:DPL[\/\s-]*VF|OF-20\d{2})/.test(normal);
  if (esOficio) {
    if (/A\s*C\s*U\s*S\s*E/.test(normal)) return 'oficio_multidependencia';
    if (/RECIBIDO/.test(normal)) return 'oficio_verificacion';
  }
  if (/SOLICITUD\s+PARA\s+TRAMITAR\s+LICENCIAS?|SOLICITUD\s+PARA\s+TRAMITAR/.test(normal)) {
    return 'solicitud';
  }
  return 'desconocido';
}

export function resultadoDesconocido(
  texto: string,
  opciones: Readonly<OpcionesParser> = {}
): ResultadoOcr {
  return armarResultado(
    'desconocido',
    {},
    [],
    [
      'No reconocemos este formato. Puedes capturar los datos a mano sin perder tu lugar.'
    ],
    texto,
    opciones
  );
}

/** Enruta el texto al parser correspondiente. Nunca modifica un expediente. */
export function procesarTextoOcr(
  texto: string,
  formatoSolicitado: FormatoOcr | 'auto' = 'auto',
  opciones: Readonly<OpcionesParser> = {}
): ResultadoOcr {
  const detectado = detectarFormato(texto);
  if (detectado === 'desconocido') return resultadoDesconocido(texto, opciones);

  let resultado: ResultadoOcr;
  switch (detectado) {
    case 'solicitud':
      resultado = parsearSolicitud(texto, opciones);
      break;
    case 'oficio_verificacion':
      resultado = parsearOficioVerificacion(texto, opciones);
      break;
    case 'oficio_multidependencia':
      resultado = parsearOficioMultidependencia(texto, opciones);
      break;
    default:
      return resultadoDesconocido(texto, opciones);
  }

  if (formatoSolicitado !== 'auto' && formatoSolicitado !== detectado) {
    return {
      ...resultado,
      advertencias: [
        `Este documento parece un ${ETIQUETA_FORMATO[detectado]}, no un ${ETIQUETA_FORMATO[formatoSolicitado]}. Revisa el tipo antes de continuar.`,
        ...resultado.advertencias
      ]
    };
  }
  return resultado;
}

/** Rebuilds structured data after the person edits any field in the review screen. */
export function actualizarResultadoOcr(
  resultado: Readonly<ResultadoOcr>,
  valores: Readonly<Record<string, string>>
): ResultadoOcr {
  const campos: Partial<Record<ClaveCampoOcr, CampoOcr>> = { ...resultado.campos };
  for (const [clave, valor] of Object.entries(valores)) {
    const anterior = campos[clave as ClaveCampoOcr];
    campos[clave as ClaveCampoOcr] = crearCampo(
      valor,
      anterior?.confianza ?? 100,
      false,
      true
    );
  }

  const faltantes = Object.entries(campos)
    .filter(([, campo]) => campo === undefined || !campo.valor)
    .map(([clave]) => etiquetaCampo(clave));

  let oficio = resultado.oficio;
  if (oficio) {
    oficio = {
      ...oficio,
      numero_oficio: campos.numero_oficio?.valor ?? oficio.numero_oficio,
      fecha_emision: campos.fecha_emision?.valor ?? oficio.fecha_emision,
      dependencia_destino: campos.dependencia_destino?.valor ?? oficio.dependencia_destino,
      sello: oficio.sello
        ? {
            ...oficio.sello,
            folio: campos.sello_folio?.valor ?? oficio.sello.folio,
            fecha: campos.sello_fecha?.valor ?? oficio.sello.fecha,
            hora: campos.sello_hora?.valor ?? oficio.sello.hora
          }
        : null,
      acuse: oficio.acuse
        ? {
            ...oficio.acuse,
            folio: campos.acuse_folio?.valor ?? oficio.acuse.folio,
            fecha: campos.acuse_fecha?.valor ?? oficio.acuse.fecha,
            hora: campos.acuse_hora?.valor ?? oficio.acuse.hora
          }
        : null
    };
  }

  let solicitudes = resultado.solicitudes;
  if (solicitudes) {
    solicitudes = solicitudes.map((solicitud, indice) => ({
      numero_control:
        campos[`solicitud_${indice}_numero_control` as ClaveCampoOcr]?.valor ??
        solicitud.numero_control,
      folio: campos[`solicitud_${indice}_folio` as ClaveCampoOcr]?.valor ?? solicitud.folio,
      giros: dividirGiros(
        campos[`solicitud_${indice}_giros` as ClaveCampoOcr]?.valor ?? solicitud.giros.join(', ')
      )
    }));
    if (oficio) oficio = { ...oficio, solicitudes };
  }

  return {
    ...resultado,
    campos,
    faltantes,
    ...(oficio ? { oficio } : {}),
    ...(solicitudes ? { solicitudes } : {})
  };
}
