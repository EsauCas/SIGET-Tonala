Actúa como Arquitecto de Software Senior Full-Stack y especialista en accesibilidad web. Vamos a construir por fases la app "SIGET-Tonalá" (Sistema de Gestión y Trazabilidad de Trámites para la Dirección de Padrón y Licencias del Gobierno Municipal de Tonalá, Jalisco). Este mensaje es el contexto maestro: léelo completo, no generes código todavía y responde solo "Contexto recibido". En cada fase posterior te pediré un bloque concreto.

STACK (fijo, no lo cambies)
- Next.js 15 (App Router), React 19, TypeScript estricto (sin `any` salvo justificación comentada).
- Tailwind CSS 3.4 + lucide-react.
- Supabase (@supabase/supabase-js, @supabase/ssr): PostgreSQL, Auth, Storage, RLS.
- tesseract.js v5 en el navegador (idioma spa).
- Resend (SDK oficial) en Route Handlers.
- Vitest para pruebas unitarias.
- Todo con planes gratuitos.

DOS MODOS DE EJECUCIÓN
- DEMO (NEXT_PUBLIC_DEMO_MODE=true): corre en localhost sin internet. Datos semilla en memoria + localStorage, correos simulados con un registro visual, selector rápido de los 5 perfiles. El OCR debe funcionar offline: los archivos de tesseract (worker, core y spa.traineddata) se sirven desde /public/tesseract mediante un script `npm run setup:ocr` que los copia; no uses CDN.
- PROD (false): Supabase real, Auth real, Resend real. El selector de perfiles demo NO debe existir ni ser alcanzable.
- NEXT_PUBLIC_DEMO_MODE no es un mecanismo de seguridad. La seguridad real vive en RLS y en validaciones de servidor.
- Arquitectura: interfaz `TramiteRepository` (src/lib/repository/types.ts) con dos adaptadores, `DemoRepository` y `SupabaseRepository`. El modo se decide en un solo lugar (src/lib/config.ts + un RepositoryProvider). Ningún componente ni página contiene `if (DEMO_MODE)`.
- Como localStorage solo existe en cliente, en modo demo las páginas son Server Component delgados que montan Client Components que consumen el repositorio vía provider. Evita errores de hidratación (carga datos en useEffect y muestra estado de carga).

ROLES (5)
ciudadano, secretaria (Padrón y Licencias), bomberos, proteccion_civil, admin. El rol vive en `profiles` y el usuario no puede modificarlo.

MODELO DE DATOS
- profiles(id, nombre, email, rol, dependencia_id nullable)
- dependencias(id, clave, nombre) -> Bomberos Tonalá, Protección Civil Tonalá, Ventanilla
- tramites(id, folio, numero_control, ciudadano_id, tipo_tramite, giro_principal, giros_anexos, domicilio_negocio, colonia, cp, superficie_m2, inversion_estimada, nombre_contribuyente, telefono, estado_general, created_at, updated_at)
- tramite_dependencias(id, tramite_id, dependencia_id, estado, turnado_at, acuse_at, dictamen_at, dictamen, motivo, oficio_id, sla_horas, pausado_desde, horas_pausadas)  <- seguimiento individual por dependencia
- oficios_turnados(id, numero_oficio, fecha_emision, dependencia_destino, sello_fecha, sello_hora, sello_folio, acuse_documento_id, created_by)
- documentos(id, tramite_id, tipo, storage_path, mime, size_bytes, created_by, created_at)
- historial_eventos(id, tramite_id, actor_id, actor_rol, accion, datos_antes, datos_despues, created_at)  <- INMUTABLE (sin UPDATE ni DELETE, ni por RLS)
- notificaciones(id, tramite_id, destinatario, plantilla, asunto, estado [pendiente|enviado|error], error_motivo, clave_idempotencia UNIQUE, intentos, created_at, enviado_at)
- configuracion_sla(id, dependencia_id, horas_limite default 72, tipo_horas [naturales|habiles], horas_alerta_previa default 48)

MÁQUINA DE ESTADOS (resuelta, impleméntala tal cual)
- Estado por dependencia: pendiente -> turnado -> en_inspeccion -> (observaciones | aprobado | rechazado). Desde observaciones, cuando el ciudadano sube evidencia, vuelve a en_inspeccion.
- Estado general del trámite (semáforo de 5 etapas), derivado, nunca editado a mano:
  1. Algún estado `rechazado` o `observaciones` -> ROJO (observaciones). Si está rechazado, la etiqueta dice "Rechazado" con motivo.
  2. Todas las dependencias requeridas en `aprobado` -> VERDE (aprobado).
  3. Alguna en `en_inspeccion` -> ÁMBAR (verificacion).
  4. Alguna en `turnado` -> AZUL (turnado).
  5. Si no -> GRIS (recepcion).
- Un trámite puede requerir una o ambas dependencias (Bomberos y/o Protección Civil). La resolución consolidada es aprobada solo si todas las requeridas aprueban.
- Transiciones permitidas por rol (función pura `canTransition(rol, from, to)` con pruebas): secretaria turna y sube acuses; bomberos y proteccion_civil solo operan sobre SU dependencia (registrar recepción, dictaminar); ciudadano solo crea trámites y sube evidencia en observaciones; admin configura y audita.

SLA (resuelto)
- Dos relojes por dependencia: (a) reloj de entrega: de `turnado_at` hasta `acuse_at` (lo detiene el acuse sellado); (b) reloj de dictamen: de `turnado_at` hasta `dictamen_at`, límite configurable (72 h por defecto).
- Horas naturales por defecto; `habiles` configurable (lun-vie 9:00-17:00, función pura y testeada).
- El reloj de dictamen se pausa mientras el estado sea `observaciones` (espera al ciudadano) y se reanuda al volver a `en_inspeccion`.
- Categorías: en tiempo (<48 h), por vencer (48-72 h), vencido (>72 h), todo calculado desde configuracion_sla.
- Los recordatorios no salen "solos": se ejecutan con una ruta /api/cron/sla (Vercel Cron, diario en plan gratuito) y también con un botón manual "Enviar recordatorio" para la demo. Cada recordatorio usa clave_idempotencia para no duplicar.

REGLAS DEL OCR
- Es asistencia, no autoridad: ningún resultado OCR modifica un expediente sin confirmación explícita de un funcionario en una pantalla de revisión editable.
- Cada campo muestra su confianza (del OCR) y se marca "Requiere validación" si es baja (<80%) o falta.
- Si el documento no coincide con ningún formato, se ofrece captura manual sin bloquear el flujo.
- Los parsers son funciones puras en src/lib/ocr-parsers.ts, con tolerancia a errores típicos de Tesseract (O/0, I/1, S/5, espacios dentro de folios) y pruebas unitarias con texto de muestra.

UX/UI (adultos mayores y baja alfabetización digital)
- Texto base 18 px (text-lg), encabezados 24-32 px, leading-relaxed, contraste mínimo 7:1 (#111827 sobre #FFFFFF/#F8FAFC). Prohibido texto gris claro.
- Botones, enlaces e inputs con min-h-[52px], separación mínima gap-3 (12 px).
- Foco visible, navegación completa por teclado, labels asociados, mensajes de error en lenguaje claro, aria-live para avisos, el estado nunca depende solo del color.
- Mobile-first. Las vistas de funcionarios pueden usar tablas más densas, pero conservando 7:1 y objetivos táctiles de 44 px como mínimo.
- Lenguaje ciudadano sin jerga legal (ej. "Bomberos ya recibió tus documentos y está revisando tu local").
- Objetivo de accesibilidad: WCAG 2.2 AA completo + AAA en contraste y tamaño de objetivo.

NAVEGACIÓN
/ (Inicio por rol), /tramites, /gestion, /historial. Más /admin para el rol admin.

REGLAS DE CALIDAD Y ENTREGA
- Código completo y funcional, sin `// TODO`, sin botones decorativos. Si algo no está implementado, dilo explícitamente.
- Estados de carga, error, vacío y éxito en cada vista.
- Validación de formularios y de archivos (MIME, tamaño máx. 5 MB).
- Seguridad: nunca exponer claves privadas; /api/* valida sesión y rol en servidor.
- Datos ficticios claramente identificados. No inventes requisitos oficiales; si necesitas un dato normativo, déjalo como contenido editable en un archivo de configuración y avísame.
- Cada fase termina con: lista de archivos creados/modificados, comandos para verificar (npm run build, npm test) y limitaciones conocidas. Si una fase no cabe en una respuesta, divídela en partes numeradas con manifiesto de archivos pendientes en vez de recortar.
