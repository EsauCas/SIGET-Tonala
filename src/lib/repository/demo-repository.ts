import { LIMITE_BASE64_DEMO, validarArchivoEvidencia } from '@/lib/archivos';
import {
  canTransition,
  puedeConfirmarAcuseOcr,
  puedeOperarDependencia,
  deriveEstadoGeneral
} from '@/lib/domain/estado-tramite';
import { finalizarPausa, iniciarPausa } from '@/lib/domain/sla';
import { correoDe, numeroOficio, puedeVerFila } from '@/lib/gestion';
import {
  canonizarFolio,
  canonizarNumeroControl,
  canonizarNumeroOficio,
  normalizarFecha,
  normalizarHora
} from '@/lib/ocr-parsers';
import { crearEstadoSemilla, type EstadoDemo } from '@/lib/repository/demo-seed';
import { inicializarRelojDemo, now, reiniciarRelojDemo } from '@/lib/reloj-demo';
import type {
  Actor,
  ActualizarRolUsuarioInput,
  ActualizarSlaInput,
  ArchivoParaSubir,
  AgregarEvidenciaInput,
  CrearTramiteInput,
  DictaminarInput,
  FiltrosTramite,
  RegistrarAcuseInput,
  RegistrarAcuseLoteInput,
  RegistrarAcuseOficioInput,
  RegistrarIntentoNotificacionInput,
  RegistrarNotificacionInput,
  RegistrarRecepcionInput,
  RegistrarTurnoInput,
  ResultadoAcuseLote,
  ResultadoAcuseOficio,
  ResultadoSubida,
  TramiteRepository,
  TurnarTramiteInput
} from '@/lib/repository/types';
import type { ArchivoOcrParaGuardar } from '@/types/ocr';
import type {
  ConfiguracionSla,
  Dependencia,
  Documento,
  HistorialEvento,
  Notificacion,
  OficioTurnado,
  Profile,
  Tramite,
  TramiteConDetalle,
  TramiteDependencia
} from '@/types/database';

const CLAVE_LOCAL_STORAGE = 'siget-tonala:demo';
/** Cambió la semilla (escenarios SLA y correos con HTML): fuerza un reseed. */
export const VERSION_ESQUEMA = 2;

interface PersistenciaDemo {
  version: number;
  estado: EstadoDemo;
}

/**
 * Adaptador único de la demostración: datos ficticios en memoria
 * y persistencia en localStorage versionada. No contiene lógica de UI ni de rol
 * de la sesión real: el actor llega como parámetro y se valida en cada método.
 */
export class DemoRepository implements TramiteRepository {
  private estado: EstadoDemo | null = null;
  private problemaAlmacenamiento: string | null = null;
  private readonly oyentesPerfil = new Set<(perfil: Profile | null) => void>();

  constructor() {
    inicializarRelojDemo();
  }

  /** Estado honesto del almacenamiento, mostrado en el panel de administración. */
  estadoAlmacenamiento(): { disponible: boolean; mensaje: string | null } {
    return {
      disponible: this.problemaAlmacenamiento === null,
      mensaje: this.problemaAlmacenamiento
    };
  }

  private async cargar(): Promise<EstadoDemo> {
    if (this.estado) return this.estado;

    const semilla = crearEstadoSemilla();
    if (typeof window === 'undefined') {
      this.estado = semilla;
      return semilla;
    }

    try {
      const texto = window.localStorage.getItem(CLAVE_LOCAL_STORAGE);
      if (texto) {
        const persistido = JSON.parse(texto) as PersistenciaDemo;
        if (persistido.version === VERSION_ESQUEMA && esEstadoDemo(persistido.estado)) {
          this.estado = persistido.estado;
          return persistido.estado;
        }
      }
    } catch (error) {
      const esLectura = error instanceof DOMException || error instanceof Error;
      this.problemaAlmacenamiento = esLectura
        ? 'El navegador no permite leer el almacenamiento local. La demo funciona en memoria mientras esta pestaña esté abierta.'
        : 'No se pudo leer el almacenamiento local. Se cargaron los datos iniciales.';
    }

    this.estado = semilla;
    this.guardar();
    return semilla;
  }

  private guardar(): void {
    if (typeof window === 'undefined' || !this.estado) return;
    const persistencia: PersistenciaDemo = { version: VERSION_ESQUEMA, estado: this.estado };
    try {
      window.localStorage.setItem(CLAVE_LOCAL_STORAGE, JSON.stringify(persistencia));
    } catch {
      // Si el navegador se queda sin espacio, se conserva la metadata y se
      // descartan las copias en base64; el expediente sigue siendo consultable.
      const documentosLigeros = this.estado.documentos.map((documento) => {
        const copia: Documento = { ...documento };
        delete copia.contenidoBase64;
        return copia;
      });
      const ligero: PersistenciaDemo = {
        version: VERSION_ESQUEMA,
        estado: { ...this.estado, documentos: documentosLigeros }
      };
      try {
        window.localStorage.setItem(CLAVE_LOCAL_STORAGE, JSON.stringify(ligero));
        this.problemaAlmacenamiento =
          'El almacenamiento está lleno. Se guardaron los expedientes sin las copias de archivos; la sesión sigue funcionando.';
      } catch {
        this.problemaAlmacenamiento =
          'El navegador no permite guardar datos. Los cambios sólo durarán mientras esta pestaña esté abierta.';
      }
    }
  }

  private nuevoId(prefijo: string): string {
    const aleatorio =
      globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return `${prefijo}-${aleatorio}`;
  }

  private ahora(): string {
    return now().toISOString();
  }

  private dependencia(estado: EstadoDemo, id: string): Dependencia | undefined {
    return estado.dependencias.find((item) => item.id === id);
  }

  private slaHoras(estado: EstadoDemo, dependenciaId: string): number {
    return estado.configuracionSla.find((item) => item.dependencia_id === dependenciaId)?.horas_limite ?? 72;
  }

  private tipoHoras(estado: EstadoDemo, dependenciaId: string): 'naturales' | 'habiles' {
    return estado.configuracionSla.find((item) => item.dependencia_id === dependenciaId)?.tipo_horas ?? 'naturales';
  }

  /** Consecutivo compartido por todas las dependencias de un mismo turno. */
  private consecutivoOficio(estado: EstadoDemo): number {
    let mayor = 0;
    for (const oficio of estado.oficios) {
      const coincidencia = /^DPL\/VF\/(\d{4})\/2026$/.exec(oficio.numero_oficio);
      if (coincidencia) mayor = Math.max(mayor, Number(coincidencia[1]));
    }
    return mayor + 1;
  }

  private recalcularEstadoGeneral(estado: EstadoDemo, tramiteId: string): void {
    const tramite = estado.tramites.find((item) => item.id === tramiteId);
    if (!tramite) return;
    const dependencias = estado.tramiteDependencias.filter((item) => item.tramite_id === tramiteId);
    tramite.estado_general = deriveEstadoGeneral(dependencias).etapa;
    tramite.updated_at = this.ahora();
  }

  private registrarEvento(
    estado: EstadoDemo,
    tramiteId: string,
    actor: Actor,
    accion: string,
    datosAntes: unknown,
    datosDespues: unknown
  ): void {
    const evento: HistorialEvento = {
      id: this.nuevoId('hist'),
      tramite_id: tramiteId,
      actor_id: actor.id,
      actor_rol: actor.rol,
      accion,
      datos_antes: datosAntes === null ? null : JSON.stringify(datosAntes),
      datos_despues: datosDespues === null ? null : JSON.stringify(datosDespues),
      created_at: this.ahora()
    };
    estado.historial.push(evento);
  }

  private aDetalle(estado: EstadoDemo, tramite: Tramite): TramiteConDetalle {
    return {
      ...tramite,
      giros_anexos: [...tramite.giros_anexos],
      dependencias: estado.tramiteDependencias
        .filter((item) => item.tramite_id === tramite.id)
        .map((item) => ({ ...item })),
      documentos: estado.documentos
        .filter((item) => item.tramite_id === tramite.id)
        .map((item) => ({ ...item }))
    };
  }

  private obtenerDependenciaTramite(
    estado: EstadoDemo,
    tramiteDependenciaId: string
  ): TramiteDependencia {
    const dependencia = estado.tramiteDependencias.find((item) => item.id === tramiteDependenciaId);
    if (!dependencia) throw new Error('No encontramos esa revisión. Revisa el folio e inténtalo de nuevo.');
    return dependencia;
  }

  private validarOperador(actor: Actor, dependenciaId: string): void {
    if (!puedeOperarDependencia(actor.rol, actor.dependencia_id, dependenciaId)) {
      throw new Error('Tu usuario no puede operar sobre esta dependencia.');
    }
  }

  private validarVentanilla(actor: Actor): void {
    if (actor.rol !== 'secretaria') {
      throw new Error('Solo la ventanilla puede confirmar acuses leídos por OCR.');
    }
  }

  private agregarDocumentoOcr(
    estado: EstadoDemo,
    tramiteId: string,
    imagen: ArchivoOcrParaGuardar | undefined,
    actor: Actor
  ): string | null {
    if (!imagen) return null;
    const id = this.nuevoId('doc');
    estado.documentos.push({
      id,
      tramite_id: tramiteId,
      tipo: 'acuse',
      storage_path: imagen.storagePath ?? `demo:///${tramiteId}/${imagen.nombre}`,
      mime: imagen.mime,
      size_bytes: imagen.sizeBytes,
      created_by: actor.id,
      created_at: this.ahora(),
      ...(imagen.contenidoBase64 ? { contenidoBase64: imagen.contenidoBase64 } : {})
    });
    return id;
  }

  /**
   * Cierra el reloj de entrega con el sello confirmado y, sólo mediante la
   * regla explícita de acuse OCR, deja la revisión en inspección.
   */
  private aplicarAcuseOcr(
    estado: EstadoDemo,
    fila: TramiteDependencia,
    actor: Actor,
    sello: { folio: string; fecha: string; hora: string },
    documentoId: string | null,
    numeroOficioTexto: string
  ): boolean {
    if (fila.acuse_at !== null) return false;
    if (fila.estado !== 'turnado' || !fila.turnado_at) {
      throw new Error('Primero se debe turnar el oficio y después confirmar el acuse.');
    }

    const antes = { estado: fila.estado, acuse_at: fila.acuse_at };
    fila.acuse_at = this.ahora();
    this.registrarEvento(estado, fila.tramite_id, actor, 'acuse_ocr_registrado', antes, {
      numero_oficio: numeroOficioTexto,
      sello_folio: sello.folio,
      sello_fecha: sello.fecha,
      sello_hora: sello.hora,
      documento_id: documentoId
    });

    if (puedeConfirmarAcuseOcr(actor.rol, antes.estado, 'en_inspeccion')) {
      if (fila.pausado_desde) {
        const reanudado = finalizarPausa(
          fila.pausado_desde,
          fila.horas_pausadas,
          now(),
          this.tipoHoras(estado, fila.dependencia_id)
        );
        fila.horas_pausadas = reanudado.horas_pausadas;
        fila.pausado_desde = null;
      }
      fila.estado = 'en_inspeccion';
      this.registrarEvento(
        estado,
        fila.tramite_id,
        actor,
        'recepcion_por_acuse_ocr',
        { estado: antes.estado },
        { estado: fila.estado, numero_oficio: numeroOficioTexto }
      );
    }

    this.recalcularEstadoGeneral(estado, fila.tramite_id);
    return true;
  }

  private notificarOcr(
    estado: EstadoDemo,
    tramiteId: string,
    clave: string,
    destinatario: string,
    asunto: string,
    cuerpo: string
  ): void {
    if (estado.notificaciones.some((item) => item.clave_idempotencia === clave)) return;
    // Se encola pendiente. Sólo el procesador de la cola marca el envío y
    // registra el correo simulado.
    estado.notificaciones.push({
      id: this.nuevoId('notif'),
      tramite_id: tramiteId,
      destinatario,
      plantilla: 'acuse_ocr',
      asunto,
      estado: 'pendiente',
      error_motivo: null,
      clave_idempotencia: clave,
      intentos: 0,
      created_at: this.ahora(),
      enviado_at: null,
      cuerpo,
      enviado_a: null,
      destinatario_original: null
    });
  }

  async listarDependencias(): Promise<Dependencia[]> {
    const estado = await this.cargar();
    return estado.dependencias.map((item) => ({ ...item }));
  }

  async listarTramites(filtros: FiltrosTramite = {}): Promise<TramiteConDetalle[]> {
    const estado = await this.cargar();
    const busqueda = filtros.busqueda?.trim().toLocaleLowerCase() ?? '';

    return estado.tramites
      .filter((tramite) => {
        const actor = filtros.actor;
        if (actor?.rol === 'ciudadano') return false;
        if (
          actor &&
          (actor.rol === 'bomberos' || actor.rol === 'proteccion_civil')
        ) {
          if (!actor.dependencia_id) return false;
          const propia = estado.tramiteDependencias.find(
            (item) =>
              item.tramite_id === tramite.id && item.dependencia_id === actor.dependencia_id
          );
          if (!propia?.turnado_at) return false;
        }
        if (filtros.etapa && tramite.estado_general !== filtros.etapa) return false;
        if (filtros.ciudadanoId && tramite.ciudadano_id !== filtros.ciudadanoId) return false;
        if (filtros.dependenciaId) {
          const asignado = estado.tramiteDependencias.some(
            (item) => item.tramite_id === tramite.id && item.dependencia_id === filtros.dependenciaId
          );
          if (!asignado) return false;
        }
        if (busqueda) {
          const texto = [tramite.folio, tramite.numero_control, tramite.nombre_contribuyente, tramite.colonia, tramite.giro_principal]
            .join(' ')
            .toLocaleLowerCase();
          if (!texto.includes(busqueda)) return false;
        }
        return true;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((tramite) => this.aDetalle(estado, tramite));
  }

  async obtenerTramite(id: string, actor?: Actor): Promise<TramiteConDetalle | null> {
    const estado = await this.cargar();
    const tramite = estado.tramites.find((item) => item.id === id);
    if (!tramite) return null;
    const detalle = this.aDetalle(estado, tramite);
    return actor && !puedeVerFila(detalle, actor) ? null : detalle;
  }

  async crearTramite(input: CrearTramiteInput): Promise<Tramite> {
    const estado = await this.cargar();
    if (input.actor.rol !== 'ciudadano' && input.actor.rol !== 'secretaria') {
      throw new Error('Solo la ciudadanía o la ventanilla pueden registrar una solicitud.');
    }
    if (input.dependenciasRequeridas.length === 0) {
      throw new Error('Selecciona al menos una dependencia: Bomberos o Protección Civil.');
    }
    if (!input.giro_principal.trim() || !input.domicilio_negocio.trim() || !input.nombre_contribuyente.trim()) {
      throw new Error('Falta el giro, el domicilio o el nombre de la persona contribuyente.');
    }

    const ahora = this.ahora();
    const consecutivo = String(estado.tramites.length + 1).padStart(4, '0');
    const id = this.nuevoId('tramite');
    const tramite: Tramite = {
      id,
      folio: `TT-2026-${consecutivo}`,
      numero_control: `CTRL-2601-${consecutivo}`,
      ciudadano_id: input.actor.id,
      tipo_tramite: input.tipo_tramite,
      giro_principal: input.giro_principal.trim(),
      giros_anexos: [...input.giros_anexos],
      domicilio_negocio: input.domicilio_negocio.trim(),
      domicilio_contribuyente: (input.domicilio_contribuyente ?? '').trim(),
      fecha_solicitud: input.fecha_solicitud || ahora.slice(0, 10),
      colonia: input.colonia.trim(),
      cp: input.cp.trim(),
      superficie_m2: input.superficie_m2,
      inversion_estimada: input.inversion_estimada,
      nombre_contribuyente: input.nombre_contribuyente.trim(),
      telefono: input.telefono.trim(),
      estado_general: 'recepcion',
      created_at: ahora,
      updated_at: ahora
    };

    const nuevasDependencias: TramiteDependencia[] = [];
    for (const clave of input.dependenciasRequeridas) {
      const dependencia = estado.dependencias.find((item) => item.clave === clave);
      if (!dependencia) throw new Error('La dependencia seleccionada no existe.');
      nuevasDependencias.push({
        id: this.nuevoId('td'),
        tramite_id: id,
        dependencia_id: dependencia.id,
        estado: 'pendiente',
        turnado_at: null,
        acuse_at: null,
        dictamen_at: null,
        dictamen: null,
        motivo: null,
        oficio_id: null,
        sla_horas: this.slaHoras(estado, dependencia.id),
        pausado_desde: null,
        horas_pausadas: 0,
        fecha_visita: null
      });
    }

    tramite.estado_general = deriveEstadoGeneral(nuevasDependencias).etapa;
    estado.tramites.push(tramite);
    estado.tramiteDependencias.push(...nuevasDependencias);
    this.registrarEvento(estado, id, input.actor, 'tramite_creado', null, {
      folio: tramite.folio,
      dependencias: input.dependenciasRequeridas
    });
    this.guardar();
    return { ...tramite, giros_anexos: [...tramite.giros_anexos] };
  }

  async registrarTurno(input: RegistrarTurnoInput): Promise<TramiteDependencia> {
    const estado = await this.cargar();
    const dependencia = this.obtenerDependenciaTramite(estado, input.tramiteDependenciaId);
    this.validarOperador(input.actor, dependencia.dependencia_id);
    if (!canTransition(input.actor.rol, dependencia.estado, 'turnado')) {
      throw new Error('En este momento no es posible turnar esta revisión.');
    }

    const ahora = this.ahora();
    const destino = this.dependencia(estado, dependencia.dependencia_id);
    const oficioId = this.nuevoId('oficio');
    const numero = numeroOficio(this.consecutivoOficio(estado));
    estado.oficios.push({
      id: oficioId,
      numero_oficio: numero,
      fecha_emision: ahora,
      dependencia_destino: dependencia.dependencia_id,
      sello_fecha: null,
      sello_hora: null,
      sello_folio: null,
      acuse_documento_id: null,
      created_by: input.actor.id
    });

    const antes = { estado: dependencia.estado };
    dependencia.estado = 'turnado';
    dependencia.turnado_at = ahora;
    dependencia.oficio_id = oficioId;
    this.registrarEvento(estado, dependencia.tramite_id, input.actor, 'turnado_registrado', antes, {
      estado: dependencia.estado,
      dependencia: destino?.clave ?? 'desconocida',
      numero_oficio: numero
    });
    this.recalcularEstadoGeneral(estado, dependencia.tramite_id);
    this.guardar();
    return { ...dependencia };
  }

  async turnarTramite(input: TurnarTramiteInput): Promise<TramiteDependencia[]> {
    const estado = await this.cargar();
    if (input.actor.rol !== 'secretaria') {
      throw new Error('Solo la ventanilla puede turnar un oficio.');
    }
    const ids = [...new Set(input.tramiteDependenciaIds)];
    if (ids.length === 0) {
      throw new Error('Selecciona al menos una dependencia para turnar.');
    }

    const filas = ids.map((id) => this.obtenerDependenciaTramite(estado, id));
    const tramiteId = filas[0]?.tramite_id;
    if (!tramiteId || filas.some((item) => item.tramite_id !== tramiteId)) {
      throw new Error('Todas las revisiones seleccionadas deben ser del mismo trámite.');
    }
    for (const fila of filas) {
      this.validarOperador(input.actor, fila.dependencia_id);
      if (!canTransition(input.actor.rol, fila.estado, 'turnado')) {
        throw new Error('Una de las revisiones seleccionadas ya fue turnada.');
      }
    }

    const ahora = this.ahora();
    const numero = numeroOficio(this.consecutivoOficio(estado));
    for (const fila of filas) {
      const oficioId = this.nuevoId('oficio');
      estado.oficios.push({
        id: oficioId,
        numero_oficio: numero,
        fecha_emision: ahora,
        dependencia_destino: fila.dependencia_id,
        sello_fecha: null,
        sello_hora: null,
        sello_folio: null,
        acuse_documento_id: null,
        created_by: input.actor.id
      });
      const antes = { estado: fila.estado };
      fila.estado = 'turnado';
      fila.turnado_at = ahora;
      fila.oficio_id = oficioId;
      this.registrarEvento(estado, tramiteId, input.actor, 'turnado_registrado', antes, {
        estado: 'turnado',
        dependencia: this.dependencia(estado, fila.dependencia_id)?.clave ?? 'desconocida',
        numero_oficio: numero
      });
    }
    this.recalcularEstadoGeneral(estado, tramiteId);
    this.guardar();
    return filas.map((fila) => ({ ...fila }));
  }

  async registrarAcuse(input: RegistrarAcuseInput): Promise<TramiteDependencia> {
    const estado = await this.cargar();
    const dependencia = this.obtenerDependenciaTramite(estado, input.tramiteDependenciaId);
    if (input.actor.rol !== 'secretaria') {
      throw new Error('Solo la ventanilla puede registrar el acuse sellado.');
    }
    if (dependencia.estado !== 'turnado' || !dependencia.turnado_at) {
      throw new Error('Primero se debe turnar el Oficio y después registrar el acuse.');
    }
    if (!input.selloFolio.trim()) {
      throw new Error('Escribe el folio del sello para registrar el acuse.');
    }

    const ahora = this.ahora();
    let documentoId = input.documentoId;
    if (!documentoId) {
      documentoId = this.nuevoId('doc');
      estado.documentos.push({
        id: documentoId,
        tramite_id: dependencia.tramite_id,
        tipo: 'acuse',
        storage_path: `demo:///${dependencia.tramite_id}/acuse-simulado.pdf`,
        mime: 'application/pdf',
        size_bytes: 0,
        created_by: input.actor.id,
        created_at: ahora
      });
    } else {
      const documento = estado.documentos.find((item) => item.id === documentoId);
      if (!documento || documento.tramite_id !== dependencia.tramite_id) {
        throw new Error('El documento de acuse no pertenece a este trámite.');
      }
    }

    const oficio = estado.oficios.find((item) => item.id === dependencia.oficio_id);
    if (oficio) {
      oficio.sello_fecha = input.selloFecha ?? ahora.slice(0, 10);
      oficio.sello_hora = input.selloHora ?? ahora.slice(11, 16);
      oficio.sello_folio = input.selloFolio.trim();
      oficio.acuse_documento_id = documentoId;
    }

    dependencia.acuse_at = ahora;
    this.registrarEvento(estado, dependencia.tramite_id, input.actor, 'acuse_registrado', null, {
      sello_folio: input.selloFolio.trim(),
      documento_id: documentoId
    });
    this.recalcularEstadoGeneral(estado, dependencia.tramite_id);
    this.guardar();
    return { ...dependencia };
  }

  async registrarAcuseOficio(input: RegistrarAcuseOficioInput): Promise<ResultadoAcuseOficio> {
    const estado = await this.cargar();
    this.validarVentanilla(input.actor);

    const numero = canonizarNumeroOficio(input.numero_oficio) ?? input.numero_oficio.trim().toUpperCase();
    if (!numero) throw new Error('Falta el número de oficio leído.');
    const oficio = estado.oficios.find(
      (item) => item.numero_oficio === numero || canonizarNumeroOficio(item.numero_oficio) === numero
    );
    if (!oficio) {
      throw new Error('No encontramos ese oficio en la bandeja. Revisa el número leído.');
    }

    const selloFolio = input.selloFolio.trim();
    if (!selloFolio) throw new Error('Confirma el folio manuscrito del sello.');
    const filas = estado.tramiteDependencias.filter((item) => item.oficio_id === oficio.id);
    if (filas.length === 0) {
      throw new Error('Ese oficio todavía no tiene expedientes turnados.');
    }
    if (filas.every((item) => item.acuse_at !== null)) {
      return {
        numero_oficio: oficio.numero_oficio,
        tramitesActualizados: 0,
        expedientes: filas.map((item) => ({ ...item })),
        aviso: 'Este oficio ya tenía acuse registrado. No se duplicó ningún evento.'
      };
    }

    const ahora = this.ahora();
    const sello = {
      folio: selloFolio,
      fecha: normalizarFecha(input.selloFecha ?? '') || ahora.slice(0, 10),
      hora: normalizarHora(input.selloHora ?? '') || ahora.slice(11, 16)
    };
    oficio.sello_folio = sello.folio;
    oficio.sello_fecha = sello.fecha;
    oficio.sello_hora = sello.hora;

    const actualizados: TramiteDependencia[] = [];
    for (const fila of filas) {
      const documentoId = this.agregarDocumentoOcr(estado, fila.tramite_id, input.imagen, input.actor);
      if (documentoId && !oficio.acuse_documento_id) oficio.acuse_documento_id = documentoId;
      if (this.aplicarAcuseOcr(estado, fila, input.actor, sello, documentoId, oficio.numero_oficio)) {
        actualizados.push({ ...fila });
      }
      const tramite = estado.tramites.find((item) => item.id === fila.tramite_id);
      this.notificarOcr(
        estado,
        fila.tramite_id,
        `acuse-individual-${oficio.numero_oficio}-${sello.folio}-${fila.tramite_id}`,
        correoDe('ventanilla'),
        `Acuse recibido: ${tramite?.folio ?? fila.tramite_id}`,
        'La dependencia ya recibió el oficio y comenzó la revisión de tu solicitud.'
      );
    }

    this.guardar();
    return {
      numero_oficio: oficio.numero_oficio,
      tramitesActualizados: actualizados.length,
      expedientes: actualizados,
      aviso: `Acuse confirmado en ${actualizados.length} ${actualizados.length === 1 ? 'expediente' : 'expedientes'}. Se detuvo el reloj de entrega.`
    };
  }

  async registrarAcuseLote(input: RegistrarAcuseLoteInput): Promise<ResultadoAcuseLote> {
    const estado = await this.cargar();
    this.validarVentanilla(input.actor);

    const numero = canonizarNumeroOficio(input.numero_oficio) ?? input.numero_oficio.trim().toUpperCase();
    if (!numero) throw new Error('Falta el número de oficio leído.');
    const oficio = estado.oficios.find(
      (item) => item.numero_oficio === numero || canonizarNumeroOficio(item.numero_oficio) === numero
    );
    if (!oficio) {
      throw new Error('No encontramos ese oficio en la bandeja. Revisa el número leído.');
    }
    const acuseFolio = canonizarFolio(input.acuseFolio) ?? input.acuseFolio.trim();
    if (!acuseFolio) throw new Error('Confirma el folio del acuse.');
    const claveLote = `acuse-lote-${oficio.numero_oficio}-${acuseFolio}`;

    const previo = estado.historial.find(
      (item) =>
        item.accion === 'acuse_lote_ocr_registrado' && (item.datos_despues ?? '').includes(claveLote)
    );
    if (previo) {
      let detalle: { foliosNoEncontrados?: string[]; notificaciones?: number } = {};
      try {
        detalle = JSON.parse(previo.datos_despues ?? '{}') as typeof detalle;
      } catch {
        detalle = {};
      }
      return {
        numero_oficio: oficio.numero_oficio,
        tramitesActualizados: 0,
        foliosNoEncontrados: detalle.foliosNoEncontrados ?? [],
        notificaciones: detalle.notificaciones ?? 0,
        reprocessado: true,
        aviso: 'Este oficio ya se procesó. No se duplicaron eventos ni notificaciones.'
      };
    }

    const ahora = this.ahora();
    oficio.sello_folio = acuseFolio;
    oficio.sello_fecha = normalizarFecha(input.acuseFecha ?? '') || ahora.slice(0, 10);
    oficio.sello_hora = normalizarHora(input.acuseHora ?? '') || ahora.slice(11, 16);

    const foliosNoEncontrados: string[] = [];
    const actualizados: TramiteDependencia[] = [];
    let notificaciones = 0;
    let primerTramiteId = estado.tramiteDependencias.find(
      (item) => item.oficio_id === oficio.id
    )?.tramite_id;

    for (const solicitud of input.solicitudes) {
      const control = canonizarNumeroControl(solicitud.numero_control) ?? '';
      const folio = canonizarFolio(solicitud.folio) ?? '';
      const etiqueta = folio || control || 'folio desconocido';
      const tramite = estado.tramites.find(
        (item) => (control !== '' && item.numero_control === control) || (folio !== '' && item.folio === folio)
      );
      if (!tramite) {
        foliosNoEncontrados.push(etiqueta);
        continue;
      }
      primerTramiteId = primerTramiteId ?? tramite.id;

      // Un acuse multidependencia cierra TODAS las revisiones turnadas del
      // expediente, no sólo la que coincida con este renglón del oficio.
      const filas = estado.tramiteDependencias.filter(
        (item) => item.tramite_id === tramite.id && item.estado === 'turnado'
      );
      if (filas.length === 0) {
        foliosNoEncontrados.push(etiqueta);
        continue;
      }

      const documentoId = this.agregarDocumentoOcr(estado, tramite.id, input.imagen, input.actor);
      if (documentoId && !oficio.acuse_documento_id) oficio.acuse_documento_id = documentoId;
      for (const fila of filas) {
        if (this.aplicarAcuseOcr(estado, fila, input.actor, {
          folio: acuseFolio,
          fecha: oficio.sello_fecha ?? ahora.slice(0, 10),
          hora: oficio.sello_hora ?? ahora.slice(11, 16)
        }, documentoId, oficio.numero_oficio)) {
          actualizados.push({ ...fila });
        }
      }

      const girosNuevos = solicitud.giros
        .map((giro) => giro.trim())
        .filter((giro) => giro.length > 0 && !tramite.giros_anexos.includes(giro));
      if (girosNuevos.length > 0) {
        const antes = { giros_anexos: [...tramite.giros_anexos] };
        tramite.giros_anexos.push(...girosNuevos);
        tramite.updated_at = this.ahora();
        this.registrarEvento(estado, tramite.id, input.actor, 'giros_actualizados_por_ocr', antes, {
          giros_anexos: [...tramite.giros_anexos]
        });
      }

      const antesNotificacion = estado.notificaciones.length;
      const destinatario =
        estado.profiles.find((item) => item.id === tramite.ciudadano_id)?.email ?? correoDe('ventanilla');
      this.notificarOcr(
        estado,
        tramite.id,
        `${claveLote}-${tramite.id}`,
        destinatario,
        `Ya recibimos los documentos de ${tramite.folio}`,
        `${tramite.folio}: Bomberos y Protección Civil ya recibieron tu expediente. Ahora revisan tu local.`
      );
      if (estado.notificaciones.length > antesNotificacion) notificaciones += 1;
    }

    if (!primerTramiteId) {
      throw new Error('Ese oficio no tiene expedientes asociados.');
    }
    this.registrarEvento(
      estado,
      primerTramiteId,
      input.actor,
      'acuse_lote_ocr_registrado',
      null,
      {
        claveIdempotencia: claveLote,
        numero_oficio: oficio.numero_oficio,
        acuse_folio: acuseFolio,
        tramitesActualizados: actualizados.length,
        foliosNoEncontrados,
        notificaciones
      }
    );
    this.guardar();

    return {
      numero_oficio: oficio.numero_oficio,
      tramitesActualizados: actualizados.length,
      foliosNoEncontrados,
      notificaciones,
      reprocessado: false,
      aviso: `Se actualizaron ${actualizados.length} ${actualizados.length === 1 ? 'expediente' : 'expedientes'}${foliosNoEncontrados.length > 0 ? ` y ${foliosNoEncontrados.length} folios no se encontraron` : ''}.`
    };
  }

  async registrarRecepcion(input: RegistrarRecepcionInput): Promise<TramiteDependencia> {
    const estado = await this.cargar();
    const dependencia = this.obtenerDependenciaTramite(estado, input.tramiteDependenciaId);
    this.validarOperador(input.actor, dependencia.dependencia_id);
    if (!canTransition(input.actor.rol, dependencia.estado, 'en_inspeccion')) {
      throw new Error('Esta revisión no puede pasar a inspección desde su estado actual.');
    }

    const antes = { estado: dependencia.estado, pausado_desde: dependencia.pausado_desde };
    if (dependencia.pausado_desde) {
      const reanudado = finalizarPausa(
        dependencia.pausado_desde,
        dependencia.horas_pausadas,
        now(),
        this.tipoHoras(estado, dependencia.dependencia_id)
      );
      dependencia.horas_pausadas = reanudado.horas_pausadas;
      dependencia.pausado_desde = null;
    }
    dependencia.estado = 'en_inspeccion';
    this.registrarEvento(estado, dependencia.tramite_id, input.actor, 'recepcion_registrada', antes, {
      estado: dependencia.estado
    });
    this.recalcularEstadoGeneral(estado, dependencia.tramite_id);
    this.guardar();
    return { ...dependencia };
  }

  async dictaminar(input: DictaminarInput): Promise<TramiteDependencia> {
    const estado = await this.cargar();
    const dependencia = this.obtenerDependenciaTramite(estado, input.tramiteDependenciaId);
    this.validarOperador(input.actor, dependencia.dependencia_id);
    if (!canTransition(input.actor.rol, dependencia.estado, input.dictamen)) {
      throw new Error('Tu usuario no puede dictaminar en este momento.');
    }
    if (input.dictamen !== 'aprobado' && !input.motivo?.trim()) {
      throw new Error('Escribe el motivo para que la persona contribuyente entienda qué hacer.');
    }

    let fechaVisita: string | null = null;
    if (input.actor.rol === 'proteccion_civil') {
      const fecha = input.fechaVisita?.trim() ?? '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(new Date(`${fecha}T12:00:00Z`).getTime())) {
        throw new Error('Registra la fecha de tu visita antes de emitir el dictamen.');
      }
      fechaVisita = fecha;
    }

    const antes = { estado: dependencia.estado, motivo: dependencia.motivo };
    dependencia.estado = input.dictamen;
    dependencia.dictamen = input.dictamen;
    dependencia.motivo = input.dictamen === 'aprobado' ? null : input.motivo?.trim() ?? null;
    if (fechaVisita) dependencia.fecha_visita = fechaVisita;

    if (input.dictamen === 'observaciones') {
      dependencia.dictamen_at = null;
      dependencia.pausado_desde = iniciarPausa();
    } else {
      dependencia.dictamen_at = this.ahora();
      dependencia.pausado_desde = null;
    }

    this.registrarEvento(estado, dependencia.tramite_id, input.actor, 'dictamen_registrado', antes, {
      estado: dependencia.estado,
      motivo: dependencia.motivo,
      ...(fechaVisita ? { fecha_visita: fechaVisita } : {})
    });
    this.recalcularEstadoGeneral(estado, dependencia.tramite_id);
    this.guardar();
    return { ...dependencia };
  }

  async agregarEvidencia(input: AgregarEvidenciaInput): Promise<Documento> {
    const estado = await this.cargar();
    const dependencia = this.obtenerDependenciaTramite(estado, input.tramiteDependenciaId);
    const tramite = estado.tramites.find((item) => item.id === dependencia.tramite_id);
    if (!tramite || tramite.ciudadano_id !== input.actor.id || input.actor.rol !== 'ciudadano') {
      throw new Error('Solo la persona dueña del trámite puede subir esta evidencia.');
    }
    if (!canTransition('ciudadano', dependencia.estado, 'en_inspeccion')) {
      throw new Error('La evidencia solo se puede subir cuando el trámite está en observaciones.');
    }
    const problema = validarArchivoEvidencia({ type: input.mime, size: input.sizeBytes });
    if (problema) throw new Error(problema);
    if (!input.storagePath.trim() || !input.nombreArchivo.trim()) {
      throw new Error('Falta el nombre del archivo.');
    }

    const documento: Documento = {
      id: this.nuevoId('doc'),
      tramite_id: tramite.id,
      tipo: input.tipo,
      storage_path: input.storagePath.trim(),
      mime: input.mime,
      size_bytes: input.sizeBytes,
      created_by: input.actor.id,
      created_at: this.ahora()
    };
    if (input.contenidoBase64) documento.contenidoBase64 = input.contenidoBase64;
    estado.documentos.push(documento);

    const antes = { estado: dependencia.estado, pausado_desde: dependencia.pausado_desde };
    if (dependencia.pausado_desde) {
      const reanudado = finalizarPausa(
        dependencia.pausado_desde,
        dependencia.horas_pausadas,
        now(),
        this.tipoHoras(estado, dependencia.dependencia_id)
      );
      dependencia.horas_pausadas = reanudado.horas_pausadas;
      dependencia.pausado_desde = null;
    }
    dependencia.estado = 'en_inspeccion';
    dependencia.motivo = null;
    this.registrarEvento(estado, tramite.id, input.actor, 'evidencia_entregada', antes, {
      estado: dependencia.estado,
      documento_id: documento.id,
      nombre: input.nombreArchivo
    });
    this.recalcularEstadoGeneral(estado, tramite.id);
    this.guardar();
    return { ...documento };
  }

  async listarHistorial(tramiteId: string): Promise<HistorialEvento[]> {
    const estado = await this.cargar();
    return estado.historial
      .filter((item) => item.tramite_id === tramiteId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((item) => ({ ...item }));
  }

  async listarOficios(): Promise<OficioTurnado[]> {
    const estado = await this.cargar();
    return estado.oficios.map((item) => ({ ...item }));
  }

  async listarDocumentos(tramiteId: string): Promise<Documento[]> {
    const estado = await this.cargar();
    return estado.documentos
      .filter((item) => item.tramite_id === tramiteId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((item) => ({ ...item }));
  }

  async listarNotificaciones(): Promise<Notificacion[]> {
    const estado = await this.cargar();
    return estado.notificaciones.map((item) => ({ ...item }));
  }

  async registrarNotificacion(input: RegistrarNotificacionInput): Promise<Notificacion> {
    const estado = await this.cargar();
    const existente = estado.notificaciones.find(
      (item) => item.clave_idempotencia === input.claveIdempotencia
    );
    if (existente) return { ...existente };

    // Se encola pendiente. El procesador de la cola es el único que registra
    // el envío y el correo simulado.
    const notificacion: Notificacion = {
      id: this.nuevoId('notif'),
      tramite_id: input.tramiteId,
      destinatario: input.destinatario,
      plantilla: input.plantilla,
      asunto: input.asunto,
      estado: 'pendiente',
      error_motivo: null,
      clave_idempotencia: input.claveIdempotencia,
      intentos: 0,
      created_at: this.ahora(),
      enviado_at: null,
      cuerpo: input.cuerpo,
      enviado_a: null,
      destinatario_original: null
    };
    estado.notificaciones.push(notificacion);
    this.guardar();
    return { ...notificacion };
  }

  async encolarNotificacion(input: RegistrarNotificacionInput): Promise<Notificacion> {
    return this.registrarNotificacion(input);
  }

  async listarNotificacionesPendientes(): Promise<Notificacion[]> {
    const estado = await this.cargar();
    return estado.notificaciones
      .filter((item) => item.estado === 'pendiente' || item.estado === 'error')
      .map((item) => ({ ...item }));
  }

  async marcarIntentoNotificacion(
    input: RegistrarIntentoNotificacionInput
  ): Promise<Notificacion> {
    const estado = await this.cargar();
    const notificacion = estado.notificaciones.find((item) => item.id === input.id);
    if (!notificacion) throw new Error('No existe esa notificación.');

    notificacion.estado = input.estado;
    notificacion.intentos = Math.max(0, input.intentos);
    notificacion.error_motivo = input.errorMotivo;
    notificacion.enviado_at = input.enviadoAt;
    notificacion.cuerpo = input.cuerpo;
    notificacion.html = input.html ?? null;
    notificacion.plantilla = input.plantilla ?? notificacion.plantilla;
    notificacion.enviado_a = input.enviadoA;
    notificacion.destinatario_original = input.destinatarioOriginal;

    if (
      input.estado === 'enviado' &&
      !estado.correos.some((item) => item.clave_idempotencia === notificacion.clave_idempotencia)
    ) {
      estado.correos.push({
        id: this.nuevoId('correo'),
        destinatario: input.enviadoA,
        asunto: notificacion.asunto,
        cuerpo: input.cuerpo,
        html: input.html ?? '',
        plantilla: input.plantilla ?? notificacion.plantilla,
        fecha: input.enviadoAt ?? this.ahora(),
        clave_idempotencia: notificacion.clave_idempotencia
      });
    }
    this.guardar();
    return { ...notificacion };
  }

  async reintentarNotificacion(claveIdempotencia: string): Promise<Notificacion | null> {
    const estado = await this.cargar();
    const notificacion = estado.notificaciones.find(
      (item) => item.clave_idempotencia === claveIdempotencia
    );
    if (!notificacion) return null;
    notificacion.estado = 'pendiente';
    notificacion.intentos = 0;
    notificacion.error_motivo = null;
    notificacion.enviado_at = null;
    this.guardar();
    return { ...notificacion };
  }

  async listarUsuarios(): Promise<Profile[]> {
    const estado = await this.cargar();
    return estado.profiles.map((item) => ({ ...item }));
  }

  async actualizarRolUsuario(input: ActualizarRolUsuarioInput): Promise<Profile> {
    const estado = await this.cargar();
    if (input.actor.rol !== 'admin') {
      throw new Error('Sólo la administración puede cambiar roles.');
    }
    if (input.id === input.actor.id && input.rol !== input.actor.rol) {
      throw new Error('No puedes cambiar tu propio rol.');
    }
    const perfil = estado.profiles.find((item) => item.id === input.id);
    if (!perfil) throw new Error('No existe ese usuario.');
    perfil.rol = input.rol;
    this.guardar();
    return { ...perfil };
  }

  async listarConfiguracionSla(): Promise<ConfiguracionSla[]> {
    const estado = await this.cargar();
    return estado.configuracionSla.map((item) => ({ ...item }));
  }

  async actualizarConfiguracionSla(input: ActualizarSlaInput): Promise<ConfiguracionSla> {
    const estado = await this.cargar();
    if (input.actor.rol !== 'admin') {
      throw new Error('Solo la administración puede cambiar los plazos.');
    }
    if (input.horasLimite <= 0 || input.horasAlertaPrevia <= 0 || input.horasAlertaPrevia >= input.horasLimite) {
      throw new Error('El aviso debe ser menor al límite y ambos deben ser mayores a cero.');
    }

    const configuracion = estado.configuracionSla.find((item) => item.id === input.id);
    if (!configuracion) throw new Error('No existe esa configuración de plazos.');

    configuracion.horas_limite = input.horasLimite;
    configuracion.horas_alerta_previa = input.horasAlertaPrevia;
    configuracion.tipo_horas = input.tipoHoras;
    this.guardar();
    return { ...configuracion };
  }

  // Capacidades exclusivas de la demo, usadas por el selector de perfiles.

  async listarPerfiles(): Promise<Profile[]> {
    const estado = await this.cargar();
    return estado.profiles.map((item) => ({ ...item }));
  }

  async seleccionarPerfil(id: string): Promise<void> {
    const estado = await this.cargar();
    if (!estado.profiles.some((item) => item.id === id)) {
      throw new Error('Ese perfil de demostración no existe.');
    }
    estado.perfilActivoId = id;
    this.guardar();
    this.notificarCambioPerfil();
  }

  async obtenerPerfilActivo(): Promise<Profile | null> {
    const estado = await this.cargar();
    return estado.profiles.find((item) => item.id === estado.perfilActivoId) ?? null;
  }

  suscribirPerfil(listener: (perfil: Profile | null) => void): () => void {
    this.oyentesPerfil.add(listener);
    return () => {
      this.oyentesPerfil.delete(listener);
    };
  }

  private notificarCambioPerfil(): void {
    const perfil = this.estado?.profiles.find((item) => item.id === this.estado?.perfilActivoId) ?? null;
    const copia = perfil ? { ...perfil } : null;
    for (const oyente of this.oyentesPerfil) oyente(copia);
  }

  async subirArchivo(input: ArchivoParaSubir): Promise<ResultadoSubida> {
    const { archivo } = input;
    const problema = validarArchivoEvidencia(archivo);
    if (problema) throw new Error(problema);

    const resultado: ResultadoSubida = {
      storagePath: `demo:///${input.tramiteId}/${archivo.name}`,
      mime: archivo.type,
      sizeBytes: archivo.size,
      nombreArchivo: archivo.name
    };
    if (archivo.size <= LIMITE_BASE64_DEMO) {
      const contenidoBase64 = await leerComoBase64(archivo);
      if (contenidoBase64) resultado.contenidoBase64 = contenidoBase64;
    }
    return resultado;
  }

  async listarCorreosSimulados() {
    const estado = await this.cargar();
    return estado.correos.map((item) => ({ ...item }));
  }

  async reiniciar(): Promise<void> {
    this.estado = null;
    this.problemaAlmacenamiento = null;
    reiniciarRelojDemo();
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(CLAVE_LOCAL_STORAGE);
    } catch {
      this.problemaAlmacenamiento =
        'El navegador no permite borrar el almacenamiento. Se reiniciaron los datos en memoria.';
    }
    await this.cargar();
    this.notificarCambioPerfil();
  }
}

/** Convierte el archivo a data URL en el navegador; en Node devuelve cadena vacía. */
function leerComoBase64(archivo: File): Promise<string> {
  if (typeof FileReader === 'undefined') return Promise.resolve('');
  return new Promise((resolver) => {
    const lector = new FileReader();
    lector.onload = () => resolver(typeof lector.result === 'string' ? lector.result : '');
    lector.onerror = () => resolver('');
    lector.readAsDataURL(archivo);
  });
}

function esEstadoDemo(valor: unknown): valor is EstadoDemo {
  if (typeof valor !== 'object' || valor === null) return false;
  const objeto = valor as Record<string, unknown>;
  const campos = [
    'profiles',
    'dependencias',
    'tramites',
    'tramiteDependencias',
    'oficios',
    'documentos',
    'historial',
    'notificaciones',
    'configuracionSla',
    'correos'
  ];
  return campos.every((campo) => Array.isArray(objeto[campo])) && typeof objeto.perfilActivoId === 'string';
}
