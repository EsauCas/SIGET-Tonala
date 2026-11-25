import { describe, expect, it } from 'vitest';
import {
  actualizarResultadoOcr,
  canonizarFolio,
  canonizarNumeroControl,
  canonizarNumeroOficio,
  detectarFormato,
  parsearOficioVerificacion,
  procesarTextoOcr
} from '@/lib/ocr-parsers';

/**
 * TODOS los textos de este archivo son SINTÉTICOS. El material real de muestra
 * llegó vacío en la entrega de la Fase 5. Los errores (O/0, I/1, S/5, espacios)
 * simulan fallos típicos de Tesseract, no transcripciones de documentos reales.
 */

const SOLICITUD_LIMPIA = [
  'SOLICITUD PARA TRAMITAR LICENCIAS DE GIROS Y ANUNCIOS',
  'NUMERO DE CONTROL: CTRL-2601-0001',
  'FOLIO DE LA SOLICITUD: 5011-B',
  'FECHA DE SOLICITUD: 2026-03-12',
  'NOMBRE DEL CONTRIBUYENTE: MARIA ELENA RUIZ LOPEZ',
  'DOMICILIO DEL CONTRIBUYENTE: CALLE PRIMAVERA 12',
  'DOMICILIO DEL NEGOCIO: AVENIDA JUAREZ 234',
  'COLONIA: CENTRO',
  'CODIGO POSTAL: 45400',
  'TELEFONO CELULAR: 3331000001',
  'TIPO DE TRAMITE: GIRO BLANCO',
  'GIRO PRINCIPAL: ABARROTES',
  'GIROS ANEXOS: PANADERIA, PAPELERIA',
  'SUPERFICIE M2: 45.5',
  'INVERSION ESTIMADA: 85000'
].join('\n');

const SOLICITUD_CON_ERRORES = [
  'SOLICITUD PARA TRAMITAR LICENCIAS DE GIROS Y ANUNCIOS',
  'NUMERO DE',
  'CONTROL: CTRL 26O1 0OO1',
  'FOLIO DE LA SOLICITUD: 5O11 - B',
  'FECHA DE SOLICITUD:',
  '2026-03-12',
  'NOMBRE DEL CONTRIBUYENTE: MARIA ELENA RUIZ LOPEZ',
  'DOMICILIO DEL CONTRIBUYENTE: CALLE PRIMAVERA 12',
  'DOMICILIO DEL NEGOCIO: AVENIDA JUAREZ 234',
  'COLONIA: CENTRO',
  'CODIGO POSTAL: 4540O',
  'TELEFONO CELULAR: 3331OO0OO1',
  'TIPO DE TRAMITE: GIRO BLANCO',
  'GIRO PRINCIPAL: ABARROTES',
  'GIROS ANEXOS: PANADERIA',
  'SUPERFICIE M2: 45',
  'INVERSION ESTIMADA: 85OOO'
].join('\n');

const OFICIO_INDIVIDUAL = [
  'DIRECCION DE PADRON Y LICENCIAS',
  'OFICIO DPL/VF/0223/2026',
  'FECHA DE EMISION: 2026-03-10',
  'DEPENDENCIA DESTINO: BOMBEROS TONALA',
  '',
  'RECIBIDO',
  'FOLIO MANUSCRITO DEL SELLO: 7O45',
  'FECHA DEL SELLO: 2026-03-12',
  'HORA DEL SELLO: 10:35',
  '',
  '1. NUMERO DE CONTROL: CTRL-2601-0001 FOLIO: 5011-B GIRO PRINCIPAL: ABARROTES',
  '2. NUMERO DE CONTROL: CTRL-2601-0002 FOLIO: 5012-B GIRO PRINCIPAL: PANADERIA'
].join('\n');

const OFICIO_LOTE = [
  'DIRECCION DE PADRON Y LICENCIAS',
  'OFICIO DPL/VF/0225/2026',
  'FECHA DE EMISION: 2026-03-14',
  'DEPENDENCIA DESTINO: BOMBEROS Y PROTECCION CIVIL TONALA',
  '',
  'ACUSE MULTIDEPENDENCIA',
  'FOLIO DEL ACUSE: 9O12-A',
  'FECHA DEL ACUSE: 2026-03-16',
  'HORA DEL ACUSE: 12:45',
  '',
  'NUMERO DE CONTROL: CTRL-2601-0003 FOLIO: 5013-B GIRO PRINCIPAL: RESTAURANTE',
  'NUMERO DE CONTROL: CTRL-2601-0004 FOLIO: 5014-B GIRO PRINCIPAL: FERRETERIA'
].join('\n');

describe('canonización tolerante a errores OCR (casos sintéticos)', () => {
  it('corrige O/0, I/1 y espacios en números de control y folios', () => {
    expect(canonizarNumeroControl('CTRL 26O1 0OO1')).toBe('CTRL-2601-0001');
    expect(canonizarNumeroControl('C0NTR0L-26O1-0OO1')).toBe('CTRL-2601-0001');
    expect(canonizarFolio('5O11 - B')).toBe('5011-B');
    expect(canonizarFolio('9 012 A')).toBe('9012-A');
    expect(canonizarNumeroOficio('DPL/VF/O223/2O26')).toBe('DPL/VF/0223/2026');
  });

  it('no inventa folios ni números de control cuando no hay suficientes dígitos', () => {
    expect(canonizarFolio('sin folio')).toBeNull();
    expect(canonizarNumeroControl('ABC-1234')).toBeNull();
  });
});

describe('Parser A · solicitud (texto sintético)', () => {
  it('detecta el formato y extrae los campos principales', () => {
    expect(detectarFormato(SOLICITUD_LIMPIA)).toBe('solicitud');

    const resultado = procesarTextoOcr(SOLICITUD_LIMPIA, 'solicitud');
    expect(resultado.formato).toBe('solicitud');
    expect(resultado.campos.numero_control?.valor).toBe('CTRL-2601-0001');
    expect(resultado.campos.folio?.valor).toBe('5011-B');
    expect(resultado.campos.nombre_contribuyente?.valor).toBe('MARIA ELENA RUIZ LOPEZ');
    expect(resultado.campos.cp?.valor).toBe('45400');
    expect(resultado.campos.telefono?.valor).toBe('3331000001');
    expect(resultado.campos.tipo_tramite?.valor).toBe('Giro Blanco');
    expect(resultado.campos.giros_anexos?.valor).toBe('PANADERIA, PAPELERIA');
    expect(resultado.campos.superficie_m2?.valor).toBe('45.5');
    expect(resultado.faltantes).toEqual([]);
  });

  it('tolera líneas partidas y errores O/0 sin perder campos', () => {
    const resultado = procesarTextoOcr(SOLICITUD_CON_ERRORES, 'solicitud');

    expect(resultado.campos.numero_control?.valor).toBe('CTRL-2601-0001');
    expect(resultado.campos.folio?.valor).toBe('5011-B');
    expect(resultado.campos.cp?.valor).toBe('45400');
    expect(resultado.campos.telefono?.valor).toBe('3331000001');
    expect(resultado.campos.inversion_estimada?.valor).toBe('85000');
    expect(resultado.campos.numero_control?.confianza).toBeLessThan(90);
  });

  it('marca como faltantes los campos que no aparecen', () => {
    const texto = SOLICITUD_LIMPIA.split('\n')
      .filter((linea) => !linea.startsWith('TELEFONO') && !linea.startsWith('COLONIA'))
      .join('\n');
    const resultado = procesarTextoOcr(texto, 'solicitud');

    expect(resultado.faltantes).toContain('Teléfono');
    expect(resultado.faltantes).toContain('Colonia');
    expect(resultado.campos.telefono?.requiereValidacion).toBe(true);
  });

  it('baja la confianza global cuando Tesseract la reporta baja', () => {
    const resultado = procesarTextoOcr(SOLICITUD_LIMPIA, 'solicitud', { confianzaGlobal: 61 });
    expect(resultado.campos.folio?.confianza).toBe(61);
    expect(resultado.campos.folio?.requiereValidacion).toBe(true);
    expect(resultado.advertencias.some((aviso) => aviso.includes('baja confianza'))).toBe(true);
  });
});

describe('Parser B · oficio individual con sello (texto sintético)', () => {
  it('detecta el formato, lee el sello y extrae las solicitudes turnadas', () => {
    expect(detectarFormato(OFICIO_INDIVIDUAL)).toBe('oficio_verificacion');

    const resultado = procesarTextoOcr(OFICIO_INDIVIDUAL, 'oficio_verificacion');
    expect(resultado.formato).toBe('oficio_verificacion');
    expect(resultado.oficio?.numero_oficio).toBe('DPL/VF/0223/2026');
    expect(resultado.oficio?.fecha_emision).toBe('2026-03-10');
    expect(resultado.oficio?.dependencia_destino).toBe('Bomberos Tonalá');
    expect(resultado.oficio?.sello).toEqual({
      folio: '7O45',
      fecha: '2026-03-12',
      hora: '10:35'
    });
    expect(resultado.solicitudes).toHaveLength(2);
    expect(resultado.solicitudes?.[0]).toMatchObject({
      numero_control: 'CTRL-2601-0001',
      folio: '5011-B'
    });
    expect(resultado.solicitudes?.[0]?.giros).toContain('ABARROTES');
  });

  it('el folio manuscrito del sello siempre requiere validación humana', () => {
    const resultado = procesarTextoOcr(OFICIO_INDIVIDUAL, 'oficio_verificacion');
    const campo = resultado.campos.sello_folio;

    expect(campo?.confianza).toBeGreaterThanOrEqual(80);
    expect(campo?.requiereValidacion).toBe(true);
  });

  it('avisa cuando no aparece el sello RECIBIDO', () => {
    const sinSello = OFICIO_INDIVIDUAL.replace('RECIBIDO', 'DOCUMENTO');
    // Se llama al parser directo: sin RECIBIDO el enrutador ya no reconocería B.
    const resultado = parsearOficioVerificacion(sinSello);

    expect(resultado.advertencias.some((aviso) => aviso.includes('sello RECIBIDO'))).toBe(true);
  });
});

describe('Parser C · oficio multidependencia con acuse (texto sintético)', () => {
  it('lee el acuse y la tabla completa de solicitudes', () => {
    expect(detectarFormato(OFICIO_LOTE)).toBe('oficio_multidependencia');

    const resultado = procesarTextoOcr(OFICIO_LOTE, 'oficio_multidependencia');
    expect(resultado.formato).toBe('oficio_multidependencia');
    expect(resultado.oficio?.numero_oficio).toBe('DPL/VF/0225/2026');
    expect(resultado.oficio?.acuse).toEqual({
      folio: '9012-A',
      fecha: '2026-03-16',
      hora: '12:45'
    });
    expect(resultado.solicitudes).toHaveLength(2);
    expect(resultado.solicitudes?.map((item) => item.folio)).toEqual(['5013-B', '5014-B']);
    expect(resultado.campos.solicitud_0_numero_control?.valor).toBe('CTRL-2601-0003');
  });

  it('sincroniza los cambios hechos en la revisión editable con el resultado estructurado', () => {
    const resultado = procesarTextoOcr(OFICIO_LOTE, 'oficio_multidependencia');
    const editado = actualizarResultadoOcr(resultado, {
      acuse_folio: '9012-A',
      solicitud_0_giros: 'RESTAURANTE, PANADERIA'
    });

    expect(editado.campos.acuse_folio?.validadoPorHumano).toBe(true);
    expect(editado.campos.acuse_folio?.requiereValidacion).toBe(false);
    expect(editado.oficio?.solicitudes[0]?.giros).toEqual(['RESTAURANTE', 'PANADERIA']);
    expect(editado.solicitudes?.[0]?.giros).toEqual(['RESTAURANTE', 'PANADERIA']);
  });
});

describe('documento desconocido (texto sintético)', () => {
  it('no inventa campos y ofrece captura manual sin bloquear', () => {
    const texto = 'PAPEL SUELTO SIN MEMBRETE\nHOLA';
    const resultado = procesarTextoOcr(texto, 'auto');

    expect(resultado.formato).toBe('desconocido');
    expect(Object.keys(resultado.campos)).toHaveLength(0);
    expect(resultado.advertencias.some((aviso) => aviso.includes('capturar los datos a mano'))).toBe(true);
  });

  it('avisa si el documento parece de otro formato', () => {
    const resultado = procesarTextoOcr(SOLICITUD_LIMPIA, 'oficio_verificacion');
    expect(resultado.advertencias.some((aviso) => aviso.includes('parece un solicitud'))).toBe(true);
  });
});
