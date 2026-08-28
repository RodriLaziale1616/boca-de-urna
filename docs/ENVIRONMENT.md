# Variables de entorno

| Variable | Requerida | Uso |
|---|---|---|
| `NODE_ENV` | Sí en producción | Usar `production` |
| `DATABASE_URL` | Sí | Conexión PostgreSQL |
| `SESSION_TTL_HOURS` | No | Duración de sesión, default 12 |
| `ADMIN_NAME` | Primer arranque | Nombre del admin inicial |
| `ADMIN_USERNAME` | Primer arranque | Usuario del admin inicial |
| `ADMIN_PASSWORD` | Primer arranque | Contraseña del admin inicial |
| `PUBLIC_APP_NAME` | No | Nombre público del sistema |

Nunca guardar valores reales en el repositorio.
