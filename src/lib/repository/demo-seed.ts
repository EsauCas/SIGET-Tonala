import { deriveEstadoGeneral } from '@/lib/domain/estado-tramite';
import { renderizarCorreo } from '@/lib/email-templates';
import { now } from '@/lib/reloj-demo';
import type {
  ClaveDependencia,
  ConfiguracionSla,
  CorreoSimulado,
  Dependencia,
  Documento,
  EstadoDependencia,
  HistorialEvento,
  Notificacion,
  OficioTurnado,
  Profile,
  Tramite,
  TramiteDependencia
} from '@/types/database';

/**
 * Catálogos de ejemplo, NO requisitos oficiales. Se mantienen en un solo
 * archivo de contenido editable (src/lib/catalogos.ts) y se reexportan aquí
 * para conservar la API pública de la semilla.
 */
export { COLONIAS_TONALA, GIROS_TONALA } from '@/lib/catalogos';

export interface EstadoDemo {
  profiles: Profile[];
  dependencias: Dependencia[];
  tramites: Tramite[];
  tramiteDependencias: TramiteDependencia[];
  oficios: OficioTurnado[];
  documentos: Documento[];
  historial: HistorialEvento[];
  notificaciones: Notificacion[];
  configuracionSla: ConfiguracionSla[];
  correos: CorreoSimulado[];
  perfilActivoId: string;
}

export const IDS_DEMO = {
  ciudadana: 'usuario-ciudadana-01',
  secretaria: 'usuario-secretaria-01',
  bomberos: 'usuario-bomberos-01',
  proteccionCivil: 'usuario-pc-01',
  admin: 'usuario-admin-01',
  bomberosDep: 'dep-bomberos',
  pcDep: 'dep-proteccion-civil',
  ventanillaDep: 'dep-ventanilla'
} as const;

interface DependenciaSemilla {
  clave: ClaveDependencia;
  estado: EstadoDependencia;
  turnadoHace?: number;
  acuseHace?: number;
  dictamenHace?: number;
  motivo?: string | null;
  pausadoDesdeHace?: number;
  horasPausadas?: number;
  slaHoras?: number;
}

interface TramiteSemilla {
  id: string;
  folio: string;
  numeroControl: string;
  giro: string;
  girosAnexos: string[];
  domicilio: string;
  colonia: string;
  cp: string;
  superficie: number;
  inversion: number;
  nombre: string;
  telefono: string;
  tipo: string;
  creadoHace: number;
  dependencias: DependenciaSemilla[];
}

const HORA = 60 * 60 * 1000;
/** Fechas relativas al reloj de demostración, nunca al reloj real del equipo. */
const hace = (horas: number): string => new Date(now().getTime() - horas * HORA).toISOString();

const TRAMITES_SEMILLA: readonly TramiteSemilla[] = [
  {
    id: 'tramite-001',
    folio: 'TT-2026-0001',
    numeroControl: 'CTRL-2601-0001',
    giro: 'Abarrotes',
    girosAnexos: [],
    domicilio: 'Calle Hidalgo 214',
    colonia: 'Centro',
    cp: '45400',
    superficie: 48,
    inversion: 85000,
    nombre: 'María Elena Ruiz López',
    telefono: '3331000001',
    tipo: 'Licencia de funcionamiento',
    creadoHace: 30,
    dependencias: [{ clave: 'bomberos', estado: 'turnado', turnadoHace: 20 }]
  },
  {
    id: 'tramite-002',
    folio: 'TT-2026-0002',
    numeroControl: 'CTRL-2601-0002',
    giro: 'Panadería',
    girosAnexos: ['Venta de café'],
    domicilio: 'Av. Reforma 1025',
    colonia: 'Lázaro Cárdenas',
    cp: '45420',
    superficie: 92,
    inversion: 160000,
    nombre: 'Jorge Alberto Sánchez Pérez',
    telefono: '3331000002',
    tipo: 'Licencia de funcionamiento',
    creadoHace: 60,
    dependencias: [
      { clave: 'bomberos', estado: 'en_inspeccion', turnadoHace: 50, acuseHace: 45 },
      { clave: 'proteccion_civil', estado: 'turnado', turnadoHace: 12 }
    ]
  },
  {
    id: 'tramite-003',
    folio: 'TT-2026-0003',
    numeroControl: 'CTRL-2601-0003',
    giro: 'Papelería',
    girosAnexos: [],
    domicilio: 'Calle Juárez 88',
    colonia: 'Centro',
    cp: '45400',
    superficie: 36,
    inversion: 60000,
    nombre: 'Rosa María Gutiérrez Vargas',
    telefono: '3331000003',
    tipo: 'Licencia de funcionamiento',
    creadoHace: 200,
    dependencias: [
      { clave: 'bomberos', estado: 'aprobado', turnadoHace: 180, acuseHace: 175, dictamenHace: 150 },
      { clave: 'proteccion_civil', estado: 'aprobado', turnadoHace: 180, acuseHace: 174, dictamenHace: 140 }
    ]
  },
  {
    id: 'tramite-004',
    folio: 'TT-2026-0004',
    numeroControl: 'CTRL-2601-0004',
    giro: 'Restaurante',
    girosAnexos: ['Venta de bebidas'],
    domicilio: 'Av. Ribot 340',
    colonia: 'Jardines de Tonalá',
    cp: '45460',
    superficie: 150,
    inversion: 320000,
    nombre: 'Carlos Daniel Mendoza Ruiz',
    telefono: '3331000004',
    tipo: 'Permiso de funcionamiento',
    creadoHace: 120,
    dependencias: [
      {
        clave: 'bomberos',
        estado: 'observaciones',
        turnadoHace: 100,
        acuseHace: 95,
        dictamenHace: 40,
        pausadoDesdeHace: 40,
        horasPausadas: 0,
        motivo: 'Falta el croquis de salidas de emergencia.'
      },
      {
        clave: 'proteccion_civil',
        estado: 'aprobado',
        turnadoHace: 100,
        acuseHace: 96,
        dictamenHace: 70
      }
    ]
  },
  {
    id: 'tramite-005',
    folio: 'TT-2026-0005',
    numeroControl: 'CTRL-2601-0005',
    giro: 'Taller mecánico',
    girosAnexos: [],
    domicilio: 'Calle Industrial 77',
    colonia: 'Prados de la Providencia',
    cp: '45485',
    superficie: 210,
    inversion: 240000,
    nombre: 'Ana Patricia Flores Hernández',
    telefono: '3331000005',
    tipo: 'Licencia de funcionamiento',
    creadoHace: 300,
    dependencias: [
      {
        clave: 'bomberos',
        estado: 'rechazado',
        turnadoHace: 280,
        acuseHace: 275,
        dictamenHace: 220,
        motivo: 'No hay extintor vigente en el local.'
      },
      {
        clave: 'proteccion_civil',
        estado: 'aprobado',
        turnadoHace: 280,
        acuseHace: 274,
        dictamenHace: 250
      }
    ]
  },
  {
    id: 'tramite-006',
    folio: 'TT-2026-0006',
    numeroControl: 'CTRL-2601-0006',
    giro: 'Salón de belleza',
    girosAnexos: [],
    domicilio: 'Calle Morelos 19',
    colonia: 'Villa de Tonalá',
    cp: '45430',
    superficie: 42,
    inversion: 75000,
    nombre: 'Laura Guadalupe Ramírez Díaz',
    telefono: '3331000006',
    tipo: 'Licencia de funcionamiento',
    creadoHace: 8,
    dependencias: []
  },
  {
    id: 'tramite-007',
    folio: 'TT-2026-0007',
    numeroControl: 'CTRL-2601-0007',
    giro: 'Ferretería',
    girosAnexos: [],
    domicilio: 'Av. Tonalá 812',
    colonia: 'El Rosario',
    cp: '45440',
    superficie: 120,
    inversion: 190000,
    nombre: 'Miguel Ángel Torres Campos',
    telefono: '3331000007',
    tipo: 'Permiso de funcionamiento',
    creadoHace: 150,
    dependencias: [
      { clave: 'bomberos', estado: 'aprobado', turnadoHace: 140, acuseHace: 138, dictamenHace: 100 },
      { clave: 'proteccion_civil', estado: 'en_inspeccion', turnadoHace: 140, acuseHace: 136 }
    ]
  },
  {
    id: 'tramite-008',
    folio: 'TT-2026-0008',
    numeroControl: 'CTRL-2601-0008',
    giro: 'Venta de ropa',
    girosAnexos: [],
    domicilio: 'Calle Zaragoza 501',
    colonia: 'La Aurora',
    cp: '45450',
    superficie: 65,
    inversion: 110000,
    nombre: 'Sofía Alejandra Nieto Cruz',
    telefono: '3331000008',
    tipo: 'Licencia de funcionamiento',
    creadoHace: 96,
    dependencias: [
      { clave: 'bomberos', estado: 'turnado', turnadoHace: 80, slaHoras: 72 },
      { clave: 'proteccion_civil', estado: 'pendiente' }
    ]
  },
  {
    id: 'tramite-009',
    folio: 'TT-2026-0009',
    numeroControl: 'CTRL-2601-0009',
    giro: 'Panadería',
    girosAnexos: ['Venta de pan de dulce'],
    domicilio: 'Calle Obrero Mundial 233',
    colonia: 'Cerro del Cuatro',
    cp: '45410',
    superficie: 78,
    inversion: 130000,
    nombre: 'Pedro Antonio Villanueva León',
    telefono: '3331000009',
    tipo: 'Licencia de funcionamiento',
    creadoHace: 40,
    dependencias: [
      {
        clave: 'bomberos',
        estado: 'en_inspeccion',
        turnadoHace: 35,
        acuseHace: 32,
        pausadoDesdeHace: 10,
        horasPausadas: 4
      }
    ]
  },
  {
    id: 'tramite-010',
    folio: 'TT-2026-0010',
    numeroControl: 'CTRL-2601-0010',
    giro: 'Abarrotes',
    girosAnexos: ['Venta de telescopios: datos de ejemplo, no un requisito'],
    domicilio: 'Calle Loma Dorada 64',
    colonia: 'Prados de la Providencia',
    cp: '45485',
    superficie: 55,
    inversion: 95000,
    nombre: 'Elena Beatriz Castillo Ortega',
    telefono: '3331000010',
    tipo: 'Permiso de funcionamiento',
    creadoHace: 45,
    dependencias: [
      { clave: 'proteccion_civil', estado: 'observaciones', turnadoHace: 38, acuseHace: 36, dictamenHace: 15, motivo: 'Falta el croquis del local.' }
    ]
  },
  {
    id: 'tramite-011',
    folio: 'TT-2026-0011',
    numeroControl: 'CTRL-2601-0011',
    giro: 'Depósito de materiales',
    girosAnexos: [],
    domicilio: 'Calle Fresno 908',
    colonia: 'Jardines de Tonalá',
    cp: '45460',
    superficie: 180,
    inversion: 210000,
    nombre: 'Javier Antonio Ramírez Luna',
    telefono: '3331000011',
    tipo: 'Permiso de funcionamiento',
    creadoHace: 110,
    dependencias: [
      { clave: 'bomberos', estado: 'en_inspeccion', turnadoHace: 96, acuseHace: 90 }
    ]
  },
  {
    id: 'tramite-012',
    folio: 'TT-2026-0012',
    numeroControl: 'CTRL-2601-0012',
    giro: 'Consultorio médico',
    girosAnexos: [],
    domicilio: 'Av. Guadalajara 720',
    colonia: 'Centro',
    cp: '45400',
    superficie: 70,
    inversion: 180000,
    nombre: 'Lucía Fernanda Ortega Silva',
    telefono: '3331000012',
    tipo: 'Licencia de funcionamiento',
    creadoHace: 72,
    dependencias: [
      { clave: 'bomberos', estado: 'en_inspeccion', turnadoHace: 60, acuseHace: 55 }
    ]
  }
];

function dependenciaId(clave: ClaveDependencia): string {
  if (clave === 'bomberos') return IDS_DEMO.bomberosDep;
  if (clave === 'proteccion_civil') return IDS_DEMO.pcDep;
  return IDS_DEMO.ventanillaDep;
}

export function crearEstadoSemilla(): EstadoDemo {
  const profiles: Profile[] = [
    {
      id: IDS_DEMO.ciudadana,
      nombre: 'María Elena Ruiz López',
      email: 'maria.ruiz@correo-ejemplo.mx',
      rol: 'ciudadano',
      dependencia_id: null
    },
    {
      id: IDS_DEMO.secretaria,
      nombre: 'Lic. Teresa Aguilar Méndez',
      email: 'teresa.aguilar@tonala-ejemplo.gob.mx',
      rol: 'secretaria',
      dependencia_id: IDS_DEMO.ventanillaDep
    },
    {
      id: IDS_DEMO.bomberos,
      nombre: 'Cap. Roberto Salinas Vega',
      email: 'roberto.salinas@tonala-ejemplo.gob.mx',
      rol: 'bomberos',
      dependencia_id: IDS_DEMO.bomberosDep
    },
    {
      id: IDS_DEMO.proteccionCivil,
      nombre: 'Ing. Verónica Paredes Nava',
      email: 'veronica.paredes@tonala-ejemplo.gob.mx',
      rol: 'proteccion_civil',
      dependencia_id: IDS_DEMO.pcDep
    },
    {
      id: IDS_DEMO.admin,
      nombre: 'Administrador SIGET (demo)',
      email: 'admin.siget@tonala-ejemplo.gob.mx',
      rol: 'admin',
      dependencia_id: null
    }
  ];

  const dependencias: Dependencia[] = [
    { id: IDS_DEMO.bomberosDep, clave: 'bomberos', nombre: 'Bomberos Tonalá' },
    { id: IDS_DEMO.pcDep, clave: 'proteccion_civil', nombre: 'Protección Civil Tonalá' },
    { id: IDS_DEMO.ventanillaDep, clave: 'ventanilla', nombre: 'Ventanilla' }
  ];

  const tramites: Tramite[] = [];
  const tramiteDependencias: TramiteDependencia[] = [];
  const oficios: OficioTurnado[] = [];
  const documentos: Documento[] = [];
  const historial: HistorialEvento[] = [];

  for (const [indice, semilla] of TRAMITES_SEMILLA.entries()) {
    const creado = hace(semilla.creadoHace);
    const dependenciasDelTramite: TramiteDependencia[] = [];

    for (const [indiceDependencia, item] of semilla.dependencias.entries()) {
      const id = `td-${semilla.id}-${item.clave}`;
      const turnadoAt = item.turnadoHace === undefined ? null : hace(item.turnadoHace);
      const oficioId = turnadoAt ? `oficio-${semilla.id}-${item.clave}` : null;

      if (oficioId && turnadoAt) {
        const acuse = item.acuseHace === undefined ? null : hace(item.acuseHace);
        oficios.push({
          id: oficioId,
          numero_oficio: `OF-2026-${String(indice + 1).padStart(4, '0')}-${String(indiceDependencia + 1).padStart(2, '0')}`,
          fecha_emision: turnadoAt,
          dependencia_destino: dependenciaId(item.clave),
          sello_fecha: acuse ? acuse.slice(0, 10) : null,
          sello_hora: acuse ? acuse.slice(11, 16) : null,
          sello_folio: acuse ? `SEL-2026-${String(indice + 1).padStart(4, '0')}` : null,
          acuse_documento_id: acuse ? `doc-acuse-${semilla.id}-${item.clave}` : null,
          created_by: IDS_DEMO.secretaria
        });
      }

      if (item.acuseHace !== undefined) {
        documentos.push({
          id: `doc-acuse-${semilla.id}-${item.clave}`,
          tramite_id: semilla.id,
          tipo: 'acuse',
          storage_path: `demo:///${semilla.id}/acuse-${item.clave}.pdf`,
          mime: 'application/pdf',
          size_bytes: 128000,
          created_by: IDS_DEMO.secretaria,
          created_at: hace(item.acuseHace)
        });
      }

      const fila: TramiteDependencia = {
        id,
        tramite_id: semilla.id,
        dependencia_id: dependenciaId(item.clave),
        estado: item.estado,
        turnado_at: turnadoAt,
        acuse_at: item.acuseHace === undefined ? null : hace(item.acuseHace),
        dictamen_at: item.dictamenHace === undefined ? null : hace(item.dictamenHace),
        dictamen: item.dictamenHace === undefined ? null : item.estado,
        motivo: item.motivo ?? null,
        oficio_id: oficioId,
        sla_horas: item.slaHoras ?? 72,
        pausado_desde: item.pausadoDesdeHace === undefined ? null : hace(item.pausadoDesdeHace),
        horas_pausadas: item.horasPausadas ?? 0,
        fecha_visita: null
      };
      dependenciasDelTramite.push(fila);
      tramiteDependencias.push(fila);

      historial.push({
        id: `hist-${id}`,
        tramite_id: semilla.id,
        actor_id: item.estado === 'pendiente' ? IDS_DEMO.ciudadana : IDS_DEMO.secretaria,
        actor_rol: item.estado === 'pendiente' ? 'ciudadano' : 'secretaria',
        accion: 'cambio_estado_dependencia',
        datos_antes: null,
        datos_despues: JSON.stringify({ dependencia: item.clave, estado: item.estado }),
        created_at: turnadoAt ?? creado
      });
    }

    documentos.push({
      id: `doc-solicitud-${semilla.id}`,
      tramite_id: semilla.id,
      tipo: 'solicitud',
      storage_path: `demo:///${semilla.id}/solicitud.pdf`,
      mime: 'application/pdf',
      size_bytes: 245000,
      created_by: IDS_DEMO.ciudadana,
      created_at: creado
    });

    historial.unshift({
      id: `hist-creacion-${semilla.id}`,
      tramite_id: semilla.id,
      actor_id: IDS_DEMO.ciudadana,
      actor_rol: 'ciudadano',
      accion: 'tramite_creado',
      datos_antes: null,
      datos_despues: JSON.stringify({ folio: semilla.folio, giro: semilla.giro }),
      created_at: creado
    });

    tramites.push({
      id: semilla.id,
      folio: semilla.folio,
      numero_control: semilla.numeroControl,
      ciudadano_id: IDS_DEMO.ciudadana,
      tipo_tramite: semilla.tipo,
      giro_principal: semilla.giro,
      giros_anexos: [...semilla.girosAnexos],
      domicilio_negocio: semilla.domicilio,
      // Datos ficticios: en la semilla el domicilio particular coincide con el del negocio.
      domicilio_contribuyente: semilla.domicilio,
      fecha_solicitud: creado.slice(0, 10),
      colonia: semilla.colonia,
      cp: semilla.cp,
      superficie_m2: semilla.superficie,
      inversion_estimada: semilla.inversion,
      nombre_contribuyente: semilla.nombre,
      telefono: semilla.telefono,
      estado_general: deriveEstadoGeneral(dependenciasDelTramite).etapa,
      created_at: creado,
      updated_at: creado
    });
  }

  const plantillaObservaciones = renderizarCorreo('observaciones_ciudadano', {
    folio: 'TT-2026-0004',
    nombreCiudadano: 'María Elena Ruiz López',
    dependencia: 'Bomberos Tonalá',
    motivo: 'Falta el croquis de salidas de emergencia.',
    esDemo: true
  });

  const notificaciones: Notificacion[] = [
    {
      id: 'notif-001',
      tramite_id: 'tramite-004',
      destinatario: 'maria.ruiz@correo-ejemplo.mx',
      plantilla: 'observaciones_ciudadano',
      asunto: plantillaObservaciones.asunto,
      estado: 'enviado',
      error_motivo: null,
      clave_idempotencia: 'demo-observaciones-0004-v1',
      intentos: 1,
      created_at: hace(38),
      enviado_at: hace(37),
      cuerpo: plantillaObservaciones.texto,
      html: plantillaObservaciones.html,
      enviado_a: 'maria.ruiz@correo-ejemplo.mx',
      destinatario_original: null
    },
    {
      id: 'notif-002',
      tramite_id: 'tramite-001',
      destinatario: 'bomberos.recordatorio@tonala-ejemplo.gob.mx',
      plantilla: 'recordatorio_sla',
      asunto: 'Recordatorio: revisión del trámite TT-2026-0001',
      estado: 'pendiente',
      error_motivo: null,
      clave_idempotencia: 'demo-sla-0001-v1',
      intentos: 0,
      created_at: hace(5),
      enviado_at: null
    }
  ];

  const correos: CorreoSimulado[] = [
    {
      id: 'correo-001',
      destinatario: 'maria.ruiz@correo-ejemplo.mx',
      asunto: plantillaObservaciones.asunto,
      cuerpo: plantillaObservaciones.texto,
      html: plantillaObservaciones.html,
      plantilla: 'observaciones_ciudadano',
      fecha: hace(37),
      clave_idempotencia: 'demo-observaciones-0004-v1'
    }
  ];

  const configuracionSla: ConfiguracionSla[] = [
    { id: 'sla-bomberos', dependencia_id: IDS_DEMO.bomberosDep, horas_limite: 72, tipo_horas: 'naturales', horas_alerta_previa: 48 },
    { id: 'sla-pc', dependencia_id: IDS_DEMO.pcDep, horas_limite: 72, tipo_horas: 'habiles', horas_alerta_previa: 48 },
    { id: 'sla-ventanilla', dependencia_id: IDS_DEMO.ventanillaDep, horas_limite: 72, tipo_horas: 'naturales', horas_alerta_previa: 48 }
  ];

  return {
    profiles,
    dependencias,
    tramites,
    tramiteDependencias,
    oficios,
    documentos,
    historial,
    notificaciones,
    configuracionSla,
    correos,
    perfilActivoId: IDS_DEMO.ciudadana
  };
}
