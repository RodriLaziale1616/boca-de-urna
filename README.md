# Boca de Urna

Sistema responsive de boca de urna con dos experiencias completamente separadas:

- **Operador / kiosco:** registra una respuesta anónima y nunca recibe resultados desde la API.
- **Administrador:** visualiza resultados acumulados en tiempo real, cortes por hora, actividad de operadores, locales y configuración de la elección.

## Stack

- React + Vite + TypeScript
- Node.js + Express + TypeScript
- Prisma + PostgreSQL
- Server-Sent Events para actualización en tiempo real

## Seguridad incluida

- Roles `ADMIN` y `OPERATOR` validados en backend.
- Sesiones opacas con cookie `HttpOnly`, `SameSite=Strict` y `Secure` en producción.
- Protección CSRF en mutaciones autenticadas.
- Contraseñas con bcrypt (coste 12).
- Rate limiting global, de login y de registro de votos.
- Idempotencia por `requestId` UUID y protección contra doble toque.
- Cooldown por operador.
- Helmet, CSP, payload limitado y validación Zod.
- Registro de auditoría para cambios administrativos.
- Votos append-only: el MVP no expone edición/borrado y PostgreSQL bloquea `UPDATE/DELETE` sobre `Vote`.
- Sin nombre, cédula, teléfono, email ni IP del votante en la tabla de votos.
- Si el dispositivo queda offline, el registro queda bloqueado; no existe cola local manipulable.

## Desarrollo local

1. Copiar `.env.example` a `.env`.
2. Crear una base PostgreSQL.
3. Cambiar la contraseña inicial del administrador.
4. Ejecutar:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Web: `http://localhost:5173`  
API: `http://localhost:4000`

## Primer administrador

Si todavía no existe ningún usuario, al arrancar se crea el administrador inicial usando:

- `ADMIN_NAME`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD` (mínimo 10 caracteres)

Nunca subir credenciales reales al repositorio.

## Railway

1. Crear un proyecto desde este repositorio.
2. Agregar PostgreSQL.
3. Configurar `DATABASE_URL` con la referencia del servicio PostgreSQL.
4. Configurar `NODE_ENV=production`, `ADMIN_NAME`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` y `SESSION_TTL_HOURS=12`.
5. Railway utilizará `railway.json`, compilará frontend/API y ejecutará las migraciones antes de arrancar.
6. Para el MVP usar una sola réplica; para escalar horizontalmente, reemplazar el bus SSE en memoria por Redis/PubSub.

## Operación

1. El administrador crea la elección.
2. Configura candidatos, colores y locales.
3. Crea operadores y les asigna elección/local.
4. Activa la encuesta.
5. Los operadores usan únicamente la pantalla de votación.
6. El dashboard del administrador recibe resultados en tiempo real.
7. Al finalizar, el administrador cierra la encuesta y el backend rechaza nuevos registros.

Ver también [`SECURITY.md`](./SECURITY.md).
