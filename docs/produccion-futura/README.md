# Arquitectura de producción (referencia futura)

Esta carpeta conserva, **solo como documentación**, el diseño que se usaría si el sistema llegara a instalarse en un entorno real. Nada de lo que está aquí se importa desde `src/`, no se compila y no forma parte de la demostración.

La aplicación entregada es demo-only: no hay Supabase, Resend, rutas `/api/*` de sesión o correo, ni variables de entorno obligatorias.

## Contenido

| Archivo | Qué documenta |
|---|---|
| `sql/schema.sql` | Tablas, RLS, triggers para historial inmutable, Storage y datos semilla. |
| `sql/phase2-rpcs.sql` | Funciones `SECURITY DEFINER` para operaciones multi-tabla y RPCs OCR/acuses. |
| `codigo/supabase-client.ts.txt` | Cliente navegador con `@supabase/ssr`. |
| `codigo/supabase-server.ts.txt` | Cliente servidor con cookies y `service_role` aislado. |
| `codigo/supabase-repository.ts.txt` | Adaptador `TramiteRepository` sobre PostgreSQL/Storage. |
| `codigo/supabase-mappers.ts.txt` | Conversión validada de filas a entidades, sin `any`. |
| `codigo/repositorio-servidor.ts.txt` | Punto de creación del adaptador en servidor. |
| `codigo/autorizacion-servidor.ts.txt` | Verificación de sesión y rol en Route Handlers. |
| `codigo/notificaciones-servidor.ts.txt` | Envío con SDK de Resend y validación en servidor. |
| `config/.env.example.txt` | Variables que se necesitarían en esa instalación futura. |
| `config/vercel.json.txt` | Cron diario para recordatorios SLA. |

## Reglas para reactivarla

1. Restaurar las dependencias y los archivos de servidor como código fuente real, no como texto.
2. Aplicar el SQL a un proyecto propio y verificar RLS con pruebas de aislamiento por rol.
3. Reintroducir el middleware y las rutas `/api/sesion`, `/api/notify` y `/api/cron/sla` con validación de sesión y rol en servidor.
4. Volver a exigir claves privadas solo en servidor; nunca exponer `service_role` ni secretos al navegador.
5. Revisar la guía de requisitos: los textos actuales son ejemplos, no normativa oficial.
