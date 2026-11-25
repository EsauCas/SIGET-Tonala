# SIGET-Tonalá · demostración funcional

**Sistema de Gestión y Trazabilidad de Trámites** de la Dirección de Padrón y Licencias del Gobierno Municipal de Tonalá, Jalisco.

Esta entrega es **solo una demostración**. Corre en tu computadora, sin internet, sin cuentas, sin contraseñas y sin servicios externos. Todos los nombres, folios, direcciones y correos son ficticios.

> **Sistema de demostración. Todos los datos son ficticios.** (aparece también en el pie de cada página).

---

## Arranque en 3 pasos

Necesitas Node.js 20 o superior.

```bash
npm install
npm run setup:ocr
npm run dev
```

Abre **http://localhost:3000** y elige uno de los cinco perfiles que aparecen arriba:

| Perfil | Para qué sirve |
|---|---|
| Ciudadanía | Registrar un trámite y subir evidencia cuando pidan un documento |
| Ventanilla (secretaria) | Turnar oficios, registrar acuses con lectura OCR y confirmar |
| Bomberos | Recibir y dictaminar solo sus expedientes |
| Protección Civil | Recibir, agendar visita y dictaminar solo sus expedientes |
| Administración | Configurar plazos y roles, mover el reloj y ver los correos simulados |

No hay `.env.local` obligatorio. No hay que crear proyectos en la nube ni copiar llaves. `NEXT_PUBLIC_DEMO_MODE` **no existe** en esta versión: el modo demo es el único modo.

`npm run setup:ocr` copia desde `node_modules` el worker, el core y `spa.traineddata` a `public/tesseract`. Esos archivos no se descargan en tiempo de ejecución: la lectura OCR funciona aunque el equipo esté sin conexión. Vuelve a ejecutar el comando si borras `public/tesseract` o cambias de versión de `tesseract.js`.

---

## Guion de presentación (5 minutos)

1. **Entrar (30 s).** Elige «María Elena Ruiz · ciudadana». Mira el semáforo: color, ícono, etiqueta y paso de 5, nunca solo color.
2. **Solicitar (1 min).** «Iniciar un trámite» → captura manual o foto del documento → revisa cada campo con su confianza → confirma. El folio lo genera el sistema.
3. **Turnar (1 min).** Cambia a «Secretaría · Ventanilla». En `/gestion`, turna el nuevo expediente a Bomberos y Protección Civil. Se genera un número de oficio y cada dependencia tiene su propio reloj.
4. **Acuse OCR (1 min).** Sube una imagen de prueba en el panel de acuse. La lectura propone folio, fecha y hora; edita lo que quieras y confirma. Nada se guarda sin esa confirmación. Si no hay cámara o se deniega, usa «Elegir imagen» o «Capturar datos a mano».
5. **Dictaminar y semáforo (1 min).** Cambia a Bomberos, registra recepción y emite un dictamen. Cambia a Protección Civil y deja el expediente en observaciones: el semáforo se pone rojo aunque la otra dependencia haya aprobado. La ciudadanía sube evidencia y vuelve a ámbar.
6. **SLA y correos (30 s).** Entra como Administración. Pulsa «Avanzar 48 h» y luego «Enviar recordatorios SLA». Aparece el aviso con «Ver correo»: se abre el HTML institucional dentro de un iframe aislado. «Restablecer reloj» y «Reiniciar datos de demostración» devuelven todo al inicio.

Semilla lista para mostrar sin hacer nada: 12 expedientes, los 5 colores del semáforo, un trámite con Bomberos aprobado y Protección Civil en observaciones, un vencido y uno por vencer.

---

## Qué es real y qué es simulado

| Funcionalidad | Estado | Comentario |
|---|---|---|
| OCR con Tesseract v5 en español | **Real** | Historial local, sin CDN. Confianza por campo y revisión editable. |
| Parseadores de solicitud, oficio y lote | **Reales** | Funciones puras con 13 pruebas; toleran O/0, I/1, S/5 y espacios. |
| Máquina de estados por dependencia | **Real** | `canTransition` por rol + semáforo derivado de 5 etapas. |
| Cálculo de SLA (naturales y hábiles) | **Real** | Dos relojes, pausa en observaciones, 72/48 h configurables. |
| Idempotencia de notificaciones | **Real** | Clave única en el registro local; un recordatorio por día y fila. |
| Plantillas de correo HTML | **Reales** | Se generan de verdad; «Ver correo» muestra ese HTML. |
| Reloj de demo y recordatorios manuales | **Reales** | Botones 24/48/72 h, restablecer y enviar recordatorios. |
| Persistencia en `localStorage` | **Real** | Versión 2; reseed automático al cambiar de versión; aviso si está lleno o deshabilitado. |
| Accesibilidad | **Real** | 18 px base, contraste 7:1, objetivos de 52 px, foco visible, `aria-live`, diálogos con Esc y foco contenido. |
| Inicio de sesión | **Simulado** | Selector de cinco perfiles ficticios; no hay autenticación. |
| Envío de correos | **Simulado** | Buzón visual en pantalla; no sale de la computadora. |
| Base de datos | **Simulada** | Datos en memoria y `localStorage`; no hay PostgreSQL ni RLS activos. |
| Subida de archivos | **Simulada** | Copia en base64 dentro del navegador (2 MB como máximo); metadata por encima de ese límite. |
| Roles y permisos | **Simulados en cliente** | Las reglas se aplican de verdad en la UI y en el repositorio, pero no hay un servidor que las revalide. |

Los textos y folios usados en las pruebas OCR son **SINTÉTICOS**. No se han proporcionado formatos oficiales. Las guías de requisitos de `src/config/requisitos.ts` están marcadas como contenido de ejemplo, no como normativa.

---

## Estructura

- `src/lib/config.ts` y `src/lib/repository/index.ts`: único punto donde se crea el repositorio (`DemoRepository`).
- `src/lib/repository/types.ts`: interfaz `TramiteRepository` y capacidades de demo.
- `src/lib/reloj-demo.ts` + `src/components/useRelojDemo.ts`: reloj persistente y su suscripción React.
- `src/lib/domain/`: semáforo, transiciones por rol y SLA (funciones puras y probadas).
- `src/lib/ocr-parsers.ts`, `src/lib/ocr-image.ts`, `src/components/OcrScanner.tsx`: captura asistida y revisión humana.
- `src/lib/notificaciones/`: cola idempotente, recordatorios, métricas y plantillas HTML.
- `src/components/pages/AdminPanel.tsx`: «Controles de demostración», roles, plazos y auditoría de correos.
- `docs/produccion-futura/`: **único** lugar con SQL, clientes, repositorio y configuración pensados para una instalación real. No se importan desde `src/`.

---

## Verificación

```bash
npm test          # 92 pruebas en 14 archivos
npm run lint      # sin errores
npm run build     # correcto sin .env.local
npm run setup:ocr # artefactos OCR locales
```

El build no necesita variables de entorno: no hay secretos que exponer ni rutas `/api/*` de autenticación, correo o cron.

`npm audit` reporta 5 avisos heredados (2 moderados, 1 alto, 2 críticos) en dependencias de desarrollo y en el `postcss` interno de Next 15. No se aplicó `npm audit fix --force`: exigiría subir a `vitest@5` y `next@16`, un cambio rompiente que no corresponde a esta entrega.

---

## Limitaciones conocidas

- La demostración no es un sistema oficial ni sustituye un trámite real.
- No hay autenticación, RLS ni validación de servidor: la «autoridad» vive en el navegador.
- El OCR reconoce diseños sintéticos; con formatos impresos reales hay que ampliar muestras y recalibrar.
- La confianza es por campo derivada de reglas deterministas, no probabilidad por token.
- No hay vista previa ni descarga de los archivos guardados; solo se conserva su metadata y, cuando cabe, una copia local.
- No se ejecutaron pruebas E2E con cámara física ni auditoría automatizada con axe en navegador.

Detalle de fases, decisiones, manifiesto de archivos y verificaciones en `PROGRESO.md`.
