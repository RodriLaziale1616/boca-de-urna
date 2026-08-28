# Boca de Urna

Aplicación responsive de boca de urna con dos experiencias separadas:

- **Operador / kiosco:** registra una respuesta anónima sin exponer resultados.
- **Administrador:** ve resultados acumulados, cortes por hora, rendimiento de operadores y configuración.

## Stack

- React + Vite + TypeScript
- Node.js + Express + TypeScript
- Prisma + PostgreSQL
- Server-Sent Events para refresco en tiempo real

## Seguridad incluida

- Sesiones opacas en cookie `HttpOnly`, `Secure` en producción y `SameSite=Strict`.
- Protección CSRF para todas las mutaciones.
- RBAC real en backend (`ADMIN` / `OPERATOR`).
- Rate limiting global, de login y de registro de votos.
- Idempotencia por voto para impedir duplicados por doble toque/reintento.
- Cooldown mínimo entre votos de un mismo operador.
- Helmet/CSP, payload limitado y validación Zod.
- Contraseñas con bcrypt (12 rondas).
- Auditoría de cambios administrativos.
- Sin nombre, cédula, teléfono ni IP del votante.
- El operador nunca recibe resultados desde la API.

## Desarrollo local

1. Copiar `.env.example` a `.env` y cambiar la contraseña inicial.
2. Crear una base PostgreSQL.
3. Ejecutar:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Web: `http://localhost:5173`  
API: `http://localhost:4000`

## Primer administrador

En el arranque, si todavía no existe ningún usuario y están definidas estas variables, se crea el primer administrador:

- `ADMIN_NAME`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD` (mínimo 10 caracteres)

## Railway

1. Crear proyecto desde este repositorio.
2. Agregar PostgreSQL.
3. Configurar `DATABASE_URL` usando la referencia del servicio PostgreSQL.
4. Configurar `ADMIN_NAME`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` y `SESSION_TTL_HOURS=12`.
5. Railway detectará `railway.json`, compilará ambos workspaces y ejecutará migraciones antes de arrancar.
6. Usar una sola réplica para el MVP. Si se escala horizontalmente, reemplazar el bus SSE en memoria por Redis/PubSub.

## Flujo recomendado el día de la elección

- El administrador crea la elección, locales, candidatos y operadores.
- Cada operador inicia sesión en su dispositivo y queda bloqueado en su pantalla de encuesta.
- El administrador activa la elección.
- Los votos llegan en tiempo real al dashboard.
- Al cierre, el administrador cambia el estado a `CLOSED`, lo que bloquea nuevos registros.
