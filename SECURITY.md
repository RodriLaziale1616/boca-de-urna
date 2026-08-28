# Seguridad — Boca de Urna

## Principios

1. **La pantalla del operador no recibe resultados.** La API de operador solo entrega elección, candidatos y local asignado.
2. **No se recolectan datos del votante.** No hay campos de nombre, cédula, teléfono, email ni dirección IP en `Vote`.
3. **Toda autorización se valida en backend.** Ocultar botones no es un control de seguridad.
4. **Cada voto es inmutable desde la interfaz.** El MVP no expone endpoints para editar o borrar votos.
5. **Cierre centralizado.** Solo un administrador puede activar/cerrar la elección; al cerrarla el backend rechaza nuevos votos.

## Controles implementados

- Roles `ADMIN` y `OPERATOR`.
- Sesiones opacas con token aleatorio de 256 bits; en base solo se guarda SHA-256 del token.
- Cookies `HttpOnly`, `SameSite=Strict` y `Secure` en producción.
- Token CSRF por sesión para todas las mutaciones autenticadas.
- Contraseñas con bcrypt, coste 12.
- Rate limiting de login, global y específico por operador.
- Cooldown de 1,2 s entre registros del mismo operador.
- `requestId` UUID único por voto para idempotencia y protección contra doble toque/reintentos.
- Validación Zod de payloads y límites de longitud.
- Helmet + CSP + bloqueo de iframes (`frame-ancestors 'none'`).
- Payload JSON limitado a 60 KB.
- Respuestas API con `Cache-Control: no-store`.
- Auditoría de altas/cambios administrativos.
- Al cambiar contraseña o deshabilitar un operador, se invalidan sus sesiones activas.
- Si el dispositivo queda sin internet, la pantalla de voto se bloquea; no se aceptan colas locales manipulables.

## Antes de producción

- Mantener el repositorio **privado**.
- Usar una contraseña inicial de administrador larga y única y rotarla después del primer acceso.
- No colocar secretos en GitHub; usar Variables de Railway.
- Activar backups del PostgreSQL de Railway.
- Mantener **una sola réplica** en el MVP porque el refresco SSE usa un bus en memoria. Para varias réplicas usar Redis/PubSub.
- Probar roles con dos cuentas distintas y confirmar que `/api/admin/*` devuelve 403 al operador.
- Cerrar la elección al terminar la jornada y exportar/respaldar la base.
- Revisar el Audit Log si hay actividad administrativa inesperada.
