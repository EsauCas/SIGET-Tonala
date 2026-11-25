# PROGRESO · SIGET-Tonalá

**Última actualización:** 2026-11-25
**Estado general:** aplicación **congelada como demostración única**. No hay Supabase, Resend, autenticación real ni rutas `/api/*`. La interfaz, los datos, los correos y el reloj viven en el navegador. La arquitectura de producción se conserva sólo como documentación en `docs/produccion-futura/`.
**Fase actual:** Fase 9 (rediseño visual y usabilidad para adultos mayores) en cierre. El historial de entrega cubre las fases 1-6, el cierre 8 y el rediseño 9; no hay un bloque numerado como Fase 7 en este repositorio.

Reglas vigentes: Next.js 15 (App Router) · React 19 · TypeScript estricto · Tailwind 3.4 · tesseract.js v5 local · Vitest. Sin variables de entorno obligatorias, sin secretos, sin `// TODO` y sin botones decorativos. Los estados de carga, error, vacío y éxito están presentes en las vistas.

---

## Resumen de fases anteriores (consolidadas en la demo)

| Fase | Qué aportó | Estado hoy |
|---|---|---|
| 1 · Fundación | Tipos del modelo, semáforo derivado de 5 etapas, `canTransition`, SLA natural/hábil, interfaz `TramiteRepository`, semilla y script OCR offline. | Vigente. Semilla ampliada a 12 expedientes y persistencia v2. |
| 2 · Núcleo | Navegación accesible, inicio por rol, semáforo visual, detalle y bandeja base. | Vigente con adaptador demo como único repositorio; se eliminó el middleware y la sesión de servidor. |
| 3 · `/tramites` | Guía editable, asistente de 3 pasos, borrador, alta validada y evidencia ciudadana. | Vigente. La guía sigue marcada como contenido de ejemplo, no normativa. |
| 4 · `/gestion` | Bandeja por rol, turnado, acuses, recepción, dictámenes, recordatorios, diálogos accesibles y cajón de expediente. | Vigente. Todas las acciones operan sobre `localStorage` y validan rol en el repositorio. |
| 5 · OCR | Parsers A/B/C puros, confianza por campo, revisión editable y confirmación humana. Tesseract local sin CDN. | Vigente. Textos SINTÉTICOS; cámara o archivo, con captura manual si falla. |
| 6 · Correos y auditoría | Plantillas HTML, cola idempotente, recordatorios, métricas, historial global y panel de administración. | Vigente en cliente. Se eliminaron Resend, `/api/notify`, `/api/cron/sla` y el cron de Vercel; los recordatorios los dispara el botón de la demo. |
| 8 · Congelación demo | Un solo modo, sin dependencias de nube, reloj controlable, vista de correo segura, documentación y verificación sin `.env.local`. | Completada. Detalle abajo. |
| 9 · Rediseño accesible | Identidad Tonalá (café, barro, alfarería), encabezado único, tamaño de letra persistido, migas, shell de páginas, microcopy ciudadano y prueba de contraste. | **Sólo presentación:** sin cambios de lógica, repositorios, OCR, estados, SLA, rutas ni permisos. |

---

## Fase 8 — Congelación como demostración (completada)

**Objetivo:** entregar un proyecto que arranque con `npm install`, `npm run setup:ocr` y `npm run dev`, sin internet, sin cuentas y sin variables de entorno, conservando reales el OCR, la máquina de estados, el SLA, el semáforo y la interactividad.

### Entregado

- **Un solo modo.** `src/lib/config.ts` exporta `DEMO_MODE = true` y `src/lib/repository/index.ts` crea siempre `DemoRepository`. `next.config.mjs` quedó sin alias ni ramas condicionales. No existe `NEXT_PUBLIC_DEMO_MODE` en el código fuente ni en el bundle.
- **Sin servicios externos en `src/`.** Eliminados los imports de `@supabase/*` y `resend` y sus dependencias en `package.json`/`package-lock.json`. Eliminados `src/middleware.ts`, `src/app/api/sesion`, `src/app/api/notify`, `src/app/api/cron/sla` y los adaptadores/clientes de servidor. Los artefactos correspondientes están en `docs/produccion-futura/{sql,codigo,config}` como texto de referencia; no se compilan ni se importan.
- **Selector de perfiles.** `DemoControls`, `DemoProfileSelector` y `LoginForm` permiten cambiar entre `ciudadano`, `secretaria`, `bomberos`, `proteccion_civil` y `admin`. No hay contraseñas: es un cambio de perfil ficticio.
- **Reloj de demostración.** `src/lib/reloj-demo.ts` centraliza `now()`, `ahoraDemo()`, `avanzarRelojDemo(horas)`, `reiniciarRelojDemo()` y la suscripción de eventos; persistencia en `siget-tonala:demo:reloj:v2`. `src/components/useRelojDemo.ts` suscribe las vistas con `useSyncExternalStore`. Todos los cálculos de SLA, métricas, recordatorios, semáforo y sellos usan ese reloj.
- **Controles de demostración en `/admin`.** «Avanzar 24 h», «Avanzar 48 h», «Avanzar 72 h», «Restablecer reloj», «Enviar recordatorios de tiempo de respuesta» y «Reiniciar datos de demostración». Cada acción avisa por `aria-live` y el reinicio restaura semilla **y** reloj.
- **Persistencia versionada.** `DemoRepository` guarda en `siget-tonala:demo` con `version: 2`; si la versión no coincide, vuelve a sembrar. Expone `estadoAlmacenamiento()` y muestra un mensaje claro si `localStorage` está lleno o deshabilitado, sin perder el expediente en curso.
- **Semilla lista para presentar.** 12 expedientes, 5 perfiles y 3 dependencias (Ventanilla, Bomberos, Protección Civil). Incluye los 5 colores del semáforo, un trámite con Bomberos aprobado y Protección Civil en observaciones (rojo aunque una dependencia aprobó), un vencido y uno por vencer. Los correos semilla tienen HTML institucional.
- **Vista previa de correo.** `src/components/VistaCorreo.tsx` abre un diálogo accesible con el HTML real de la plantilla dentro de un iframe con `srcDoc` y `sandbox=""`. Integrado en el toast (`EmailLogToast`), el historial y `/admin`. No hay botones que no hagan nada.
- **OCR offline honesto.** `npm run setup:ocr` copia worker, core y `spa.traineddata` a `public/tesseract` (3.2 MB). `OcrScanner` usa rutas locales y `gzip: false`; si se deniega la cámara, ofrece «Elegir imagen» y siempre «Capturar datos a mano». Ningún resultado modifica el expediente sin confirmación de ventanilla.
- **Accesibilidad.** Texto base 18 px, contraste 7:1, controles de 52 px (44 px en tablas de funcionarios), foco visible, skip-link, `aria-live`, diálogos con Esc y foco contenido, etiquetas asociadas y estado nunca dado sólo por color. Pie en todas las páginas: «Sistema de demostración. Todos los datos son ficticios.»
- **Pruebas.** 92 pruebas en 14 archivos. Nuevos casos para reloj persistente, versión 2 de persistencia, reseed, vista de correo y flujo de correos sin red; eliminados los casos de PROD, Resend y rutas `/api`.
- **Documentación.** `README.md` reescrito como guía demo (arranque, guion de 5 minutos, tabla real/simulado, verificación y límites). `docs/produccion-futura/README.md` explica qué se conservó y cómo se reactivaría.

### Decisiones de la fase

1. **Demo es el único modo.** No hay bandera que cambiar: `NEXT_PUBLIC_DEMO_MODE` se eliminó por completo. No es mecanismo de seguridad; en esta entrega no hay servidor que proteger.
2. **Autoridad simulada en cliente, reglas reales en el dominio.** `canTransition`, `puedeOperarDependencia`, `deriveEstadoGeneral` y el cálculo de SLA se aplican de verdad en la UI y en `DemoRepository`; no hay RLS ni validación de servidor.
3. **Producción como documento, no como código muerto.** SQL, clientes, repositorio y configuración futura viven en `docs/produccion-futura/` para que no se compilen ni den falsa sensación de estar activos.
4. **Tiempo Predecible.** El reloj es un desplazamiento persistente sobre `Date.now()`, con un solo punto de lectura (`now()`). Avanzarlo no altera los datos, sólo cambia cómo se calculan plazos y urgencias.
5. **Correos sin red.** La cola sigue siendo idempotente y registra estado, intentos y motivo; el transporte es simulado y siempre muestra el destinatario original. «Ver correo» enseña el HTML generado, no una captura.
6. **Persistencia defensiva.** Cambio de versión ⇒ reseed; `localStorage` indisponible ⇒ aviso visible; base64 por encima de 2 MB ⇒ se conserva metadata. El expediente nunca se pierde por un problema de almacenamiento.
7. **Sin `npm audit fix --force`.** Subiría a `vitest@5` y `next@16`, un cambio rompiente ajeno a esta entrega. Los avisos quedan documentados como limitación.

### Manifiesto de Fase 8

**Creados o reescritos:** `README.md`, `PROGRESO.md`, `docs/produccion-futura/README.md`, `package.json`, `package-lock.json`, `next.config.mjs`, `src/lib/config.ts`, `src/lib/repository/index.ts`, `src/lib/reloj-demo.ts`, `src/components/useRelojDemo.ts`, `src/components/VistaCorreo.tsx`, `src/components/EmailLogToast.tsx`, `src/components/EmailLogToast.test.tsx`, `src/components/DemoResetButton.tsx`, `src/components/demo/DemoControls.tsx`, `src/components/demo/DemoProfileSelector.tsx`, `src/components/LoginForm.tsx`, `src/components/Navbar.tsx`, `src/components/AuthProvider.tsx`, `src/components/RepositoryProvider.tsx`, `src/components/pages/AdminPanel.tsx`, `src/components/pages/InicioPorRol.tsx`, `src/components/pages/GestionTramites.tsx`, `src/components/pages/HistorialGlobal.tsx`, `src/components/DetalleTramite.tsx`, `src/components/OcrScanner.tsx`, `src/lib/repository/demo-repository.ts`, `src/lib/repository/demo-seed.ts`, `src/lib/repository/types.ts`, `src/lib/notificaciones/servicio.ts`, `src/lib/notificaciones/simulado.ts`, `src/lib/notificaciones/recordatorios.ts`, `src/lib/email-templates.ts`, `src/lib/ocr-integracion.ts`, `src/types/database.ts`, `src/types/ocr.ts`, `src/app/layout.tsx`, `src/lib/__tests__/reloj-demo.test.ts`, `src/lib/repository/__tests__/demo-repository.test.ts`, `src/components/AsistenteTramite.test.tsx`, `scripts/setup-ocr.mjs`.

**Traslados a `docs/produccion-futura/`:** `sql/schema.sql`, `sql/phase2-rpcs.sql`, `codigo/*.ts.txt` (clientes, mappers, repositorio, autorización y notificaciones de servidor), `config/.env.example.txt`, `config/vercel.json.txt`.

**Eliminados del árbol compilable:** `src/middleware.ts`, `src/app/api/**`, `src/lib/supabase/**`, `src/lib/repository/supabase-repository.ts`, `src/lib/repository/supabase-mappers.ts`, `src/lib/repository/servidor.ts`, `src/lib/autorizacion-servidor.ts`, `src/lib/notificaciones/servidor.ts`, `vercel.json`, `.env.example`.

---

## Fase 9 — Rediseño visual y usabilidad (completada en código)

**Objetivo:** hacer la demostración más legible y fácil de seguir para adultos mayores y personas con baja alfabetización digital, con identidad de Tonalá (café, barro, alfarería). **Sólo presentación:** no se cambiaron repositorios, OCR, máquina de estados, SLA, rutas ni permisos.

### Entregado

- **Identidad y tokens.** `tailwind.config.ts` y `src/lib/tokens-diseno.ts` son la única fuente de papel `#FBF5EC`, superficie `#FFFFFF`, tinta `#2B1810`, café `#4A2C1A`, barro `#8F3A18`, barro oscuro `#6E2B10`, ocre `#E8B04B`, arena `#D9C3A5`, borde de campo `#7A5C45` y foco `#0B3D91`. La arena se usa sólo como divisoria decorativa (`aria-hidden`), sin texto encima.
- **Contraste medible.** `src/lib/__tests__/contraste.test.ts` recorre todos los pares definidos: texto ≥ 7:1 (AAA) y bordes/foco ≥ 3:1. Se evitó texto blanco sobre el azul funcional anterior: el semáforo usa texto oscuro sobre fondos claros.
- **Encabezado único.** En todas las rutas: wordmark «SIGET Tonalá», subtítulo «Padrón y Licencias», indicador «Estás como: …», selector de perfil de prueba, navegación siempre visible, control «Tamaño de letra» (Normal / Grande / Muy grande) persistido en `siget-tonala:tamano-letra`, skip-link «Ir al contenido» y migas de pan fuera de Inicio.
- **Molde de página.** `PageShell` muestra título, frase «¿Qué puedo hacer aquí?», como máximo una acción principal, secciones separadas con `SeccionCard` y estados vacíos con `MensajeVacio`. El pie «Sistema de demostración. Todos los datos son ficticios.» permanece global.
- **Semáforo accesible.** Fondo claro, franja gruesa, ícono, etiqueta textual y «Paso X de 5»; el motivo del rechazo u observaciones se lee en texto. El estado nunca depende sólo del color.
- **Microcopy ciudadano.** «SLA» → «tiempo de respuesta»; «dictamen» → «resultado de la revisión»; «turnar» → «enviar a revisión»; «acuse» → «constancia de recibido». Se conservan literales que aparecen en pruebas existentes.
- **Lectura y touch.** Base 18 px, escalado de raíz a 125 % y 150 %, `leading-relaxed`, botones/campos de 52 px (44 px en tablas densas), separaciones de 12 px o más, foco cobalto de 3 px, `aria-live`, mensajes de error en lenguaje claro, `(obligatorio)` visible y `prefers-reduced-motion`.
- **OCR sin cambios de autoridad.** Cada campo muestra su confianza y lleva la etiqueta exacta «Requiere validación» cuando es baja (< 80 %) o falta. La captura manual sigue disponible sin bloquear el flujo y ningún resultado se guarda sin confirmación humana. Hay un solo indicador de pasos por pantalla.

### Decisiones de la fase

1. **Un solo sistema de color.** Los aliases heredados (`enfasis`, `lienzo`, `slate`, azules/ámbar/rojo/verde de Tailwind) desaparecieron del árbol compilable; los componentes consumen los tokens en español.
2. **Color + forma + palabra.** Las franjas anchas, íconos y etiquetas acompañan al color en estados y avisos.
3. **Arena decorativa.** No se coloca texto sobre `#D9C3A5`; sus usos son `aria-hidden` y no cuentan para el contraste de componentes activos.
4. **Cero cambios de dominio.** El escalado de texto y el reestilo no alteran datos ni transiciones: el comportamiento de la Fase 8 queda intacto.
5. **Verificación manual explícita.** No hay navegador ni cámara en el entorno de entrega; los pasos de escritorio, móvil, zoom y teclado quedan descritos abajo y deben ejecutarse con `npm run dev`.

### Manifiesto de Fase 9

**Creados:** `src/lib/tokens-diseno.ts`, `src/lib/__tests__/contraste.test.ts`, `src/components/layout/Header.tsx`, `ControlTamanoLetra.tsx`, `PerfilDemo.tsx`, `MigasPan.tsx`, `PageShell.tsx`, `SeccionCard.tsx`, `TarjetaAccion.tsx`, `IndicadorPasos.tsx`, `MensajeVacio.tsx` y `estilos.ts`.

**Modificados:** `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/components/Navbar.tsx`, `src/components/pages/InicioPorRol.tsx`, `SeccionTramites.tsx`, `GestionTramites.tsx`, `HistorialGlobal.tsx`, `AdminPanel.tsx`, `ListadoTramites.tsx`, `src/components/AsistenteTramite.tsx`, `CamposSolicitud.tsx`, `GuiaLicencias.tsx`, `SemaforoTramite.tsx`, `OcrScanner.tsx`, `AcuseIndividualPanel.tsx`, `AcuseLotePanel.tsx`, `DetalleTramite.tsx`, `DrawerExpediente.tsx`, `DialogoConfirmacion.tsx`, `EstadosVista.tsx`, `EmailLogToast.tsx`, `VistaCorreo.tsx`, `TramiteLista.tsx`, `LoginForm.tsx`, `SubirEvidencia.tsx`, `DemoResetButton.tsx`, `src/components/demo/DemoProfileSelector.tsx`, `src/app/login/page.tsx`, `src/app/tramites/nuevo/page.tsx`, `src/app/tramites/[id]/page.tsx`, `README.md` y este `PROGRESO.md`.

---

## Verificación ejecutada (sin `.env.local`)

Se movió `.env.local` a un archivo temporal, se corrieron los tres comandos y se restauró. Estado final: `.env.local` presente (ignorado por Git), temporal eliminado.

| Comando | Resultado |
|---|---|
| `npm test` | **92/92** en 14 archivos (exit 0) |
| `npm run lint` | sin errores ni advertencias (exit 0) |
| `npm run build` | correcto sin variables de entorno; sin rutas `/api/*` (exit 0) |
| `npm run setup:ocr` | worker, core y `spa.traineddata` copiados a `public/tesseract` (3.2 MB) |
| `grep` sobre `.next/static` | 0 coincidencias de `@supabase`, `resend`, `NEXT_PUBLIC_DEMO_MODE`, `/api/notify`, `/api/sesion`, `/api/cron/sla` |
| `git log` | sin commits: la rama `master` no tiene historial |

Comandos para reproducirlo:

```bash
npm test
npm run lint
npm run build
npm run setup:ocr
```

```powershell
# Comprobación de que el bundle no contiene rastros de PROD
Get-ChildItem .next/static -Recurse -File |
  Select-String -Pattern '@supabase','resend','NEXT_PUBLIC_DEMO_MODE','/api/notify','/api/sesion','/api/cron/sla' -SimpleMatch
# Debe devolver 0 coincidencias.
```

`npm audit` reporta 5 avisos (2 moderados, 1 alto, 2 críticos) en dependencias de desarrollo y en el `postcss` interno de Next 15; `npm audit fix --force` no se aplicó porque rompería la versión fijada de Next y Vitest.

---

## Verificación manual pendiente en navegador

Estos pasos **no se ejecutaron con herramientas automáticas** (no hay navegador ni cámara en el entorno). Deben realizarse con `npm run dev` y `http://localhost:3000`:

1. **Perfiles y semáforo.** Cambiar entre los cinco perfiles. Confirmar que el semáforo muestra color + ícono + etiqueta + «Paso X de 5», nunca sólo color, y que los cinco colores aparecen en la semilla.
2. **Conflicto de dependencias.** Abrir el expediente semilla con Bomberos aprobado y Protección Civil en observaciones: debe estar en rojo con motivo. Como ciudadanía, subir evidencia: vuelve a ámbar. No debe existir un botón de evidencia para el perfil de Bomberos.
3. **Reloj y tiempo de respuesta.** Como administración, anotar las horas de un expediente por vencer; pulsar «Avanzar 48 h» y comprobar que pasa a vencido. Pulsar «Enviar recordatorios de tiempo de respuesta», ver el toast con «Ver correo» y abrir la vista previa: el iframe no debe permitir scripts ni navegación. Pulsar el mismo botón otra vez: no debe duplicarse la notificación. «Restablecer reloj» devuelve la hora real.
4. **Persistencia y reinicio.** Recargar la página: el desplazamiento del reloj y los cambios deben continuar. Pulsar «Reiniciar datos de demostración»: deben volver los 12 expedientes iniciales y el reloj real.
5. **OCR sin internet.** Con `npm run setup:ocr` ya ejecutado, usar una imagen local generada con los textos sintéticos de las pruebas. Revisar confianza por campo, «Requiere validación» y edición manual. Denegar el permiso de cámara y comprobar que «Elegir imagen» y «Capturar datos a mano» siguen funcionando. Sin conexión, la lectura debe terminar igual.
6. **Teclado y móvil.** Recorrer avec skip-link, selector, controles de reloj y diálogos con Tab/Shift+Tab/Esc; el foco debe ser visible y volver al origen. Reducir la ventana a menos de 768 px: sin desbordamiento horizontal, tablas convertidas en tarjetas y objetivos táctiles conservados.
7. **Pie y correos.** Comprobar el pie «Sistema de demostración. Todos los datos son ficticios.» en todas las rutas y que los correos del historial y del panel abren la misma vista previa segura.

### Fase 9: comprobación manual de 5 tareas

Repite cada tarea en cuatro condiciones: **(A)** 1280 px con «Normal»; **(B)** 360 px; **(C)** zoom del navegador al 200 %; **(D)** «Muy grande» desde el encabezado. Después haz un recorrido completo **sólo con teclado** (Tab, Shift+Tab, Enter/Espacio y Esc). En todos los casos comprueba: skip-link «Ir al contenido» al enfocarlo, foco cobalto visible, sin desbordamiento horizontal de la página, avisos anunciados por `aria-live`, ninguna pista dada sólo por hover y lenguaje sin jerga.

1. **Iniciar un trámite (Ciudadanía).** Desde Inicio pulsa «Iniciar un trámite». Prueba «Capturar datos a mano» y comprueba etiquetas arriba, ayuda corta, `(obligatorio)` visible, un solo indicador «Paso 1 de 3» y errores en texto claro si dejas campos vacíos. Con imagen local, revisa que cada campo muestre su confianza y «Requiere validación» cuando corresponda; edita un dato y confirma. Debe aparecer el folio y un aviso de éxito.
2. **Ver cómo va y qué sigue (Ciudadanía).** Abre el expediente desde `/tramites`. El semáforo debe mostrar franja gruesa, ícono, etiqueta, «Paso X de 5» y «Lo que sigue: …». Cambia a un expediente observado, rechazado y aprobado: el motivo se lee en texto, nunca sólo por color.
3. **Subir una constancia con el escáner (Ventanilla).** En `/gestion`, abre el panel de constancia de recibido y usa una imagen local. Confirma que la lectura propone folio, fecha y hora con su confianza, que los campos son editables y que «Requiere validación» aparece en los datos dudosos. Guarda sólo después de confirmar; comprueba la ruta alterna «Capturar datos a mano» sin cámara.
4. **Enviar a revisión (Ventanilla).** En `/gestion`, selecciona un expediente listo y pulsa «Enviar a revisión». Deben generarse el oficio y un reloj por dependencia; el texto «turnar» no debe aparecer como acción. El diálogo debe anunciar el resultado por `aria-live` y devolver el foco al origen al cerrarse con Esc.
5. **Dar el resultado de la revisión (Bomberos).** Cambia el perfil desde el encabezado («Estás como: …»). En `/gestion` confirma que Bomberos sólo ve y opera sus expedientes: «Recibimos los documentos» y después «Resultado de la revisión». Registra una observación con motivo; vuelve como Ciudadanía y sube evidencia: el semáforo cambia a ámbar sin perder el motivo en el historial.

Para terminar, en `/admin` pulsa «Enviar recordatorios de tiempo de respuesta» dos veces y comprueba que no se duplica; verifica las migas de pan en `/tramites/nuevo` y `/gestion`, y que el pie de datos ficticios aparece en las cinco rutas.

---

## Limitaciones conocidas

1. **No es un sistema oficial.** No hay autenticación, RLS ni validación de servidor: las reglas se aplican en el navegador. El selector de perfiles no es una medida de seguridad.
2. **Sin servicios externos.** No hay base de datos PostgreSQL, Supabase, Resend, Vercel Cron ni envío real de correos. Nada sale de la computadora.
3. **OCR con material sintético.** Los parsers se calibraron con textos inventados; con formatos impresos reales hay que ampliar muestras. La confianza es por campo derivada de reglas deterministas, no probabilidad por token. No se leen PDF ni otros idiomas.
4. **Archivos.** Se validan MIME y 5 MB; la copia base64 se guarda sólo hasta 2 MB. No hay descarga ni vista previa de los documentos; el acuse OCR tampoco se puede volver a abrir como archivo.
5. **Pruebas.** Cobertura unitaria y de componente (92 pruebas). No se ejecutaron E2E en navegador, cámara física, dispositivo móvil real ni auditoría automatizada con axe.
6. **Artefactos OCR.** `public/tesseract/` está ignorado por Git: hay que ejecutar `npm run setup:ocr` después de clonar o de cambiar de versión de `tesseract.js`.
7. **Auditoría de dependencias.** Cinco avisos de `npm audit`; se documentan y no se corrigen con `--force` para no romper la versión fijada.
8. **Historial de Git.** El repositorio no tiene commits. Las fases 3, 4, 5, 6 y 8, incluidos todos los cambios demo-only, permanecen sin commitear.
9. **`AGENTS.md` sin actualizar.** Es el contexto maestro original y todavía describe los dos modos, Supabase, Resend y `/api/cron/sla`. No se modificó porque es una instrucción del usuario, pero la entrega congelada ya no sigue ese apartado: la decisión vigente es la documentada en `README.md` y en este archivo.

---

## Mensaje de commit sugerido

```text
feat(fase8): congelar SIGET-Tonalá como demostración autónoma

Elimina Supabase, Resend, autenticación y rutas /api del código compilable;
el único adaptador es DemoRepository con persistencia versionada v2 y un
reloj de demo persistente (24/48/72 h, restablecer y reinicio de semilla).
La semilla incluye los cinco estados del semáforo, conflicto entre
dependencias, plazos vencido y por vencer, y correos con HTML institucional.
Añade vista previa segura de correos, pie de datos ficticios y OCR local sin
CDN con alternativa de archivo y captura manual. Traslada la arquitectura de
producción a docs/produccion-futura/ como referencia no compilada.

Incluye fases 3, 4, 5 y 6 si se entregan juntas: asistente con borrador,
bandeja operativa, OCR con confirmación humana y cola idempotente en cliente.

Pruebas: 92/92 · lint limpio · build correcto sin .env.local ni secretos.
```
