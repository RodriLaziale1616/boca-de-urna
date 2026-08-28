# Arquitectura

## Separación de experiencias

`OPERATOR` y `ADMIN` comparten autenticación pero usan rutas y permisos diferentes. El operador no consume endpoints de resultados; el backend no entrega datos agregados a ese rol.

## Flujo de voto

1. El operador obtiene la elección asignada mediante `/api/operator/election`.
2. El navegador genera un `requestId` UUID.
3. `/api/operator/votes` valida sesión, rol, CSRF, estado de la elección, candidato, local, rate limit e idempotencia.
4. PostgreSQL inserta un registro append-only.
5. Se publica un evento SSE para refrescar el dashboard administrativo.

## Integridad

- `Vote.requestId` es único.
- No existen endpoints de actualización/borrado de votos.
- Un trigger PostgreSQL bloquea `UPDATE` y `DELETE` sobre `Vote`.
- Los candidatos quedan bloqueados cuando la elección deja el estado `DRAFT`.
- Al activar una elección se cierra cualquier otra elección activa.

## Tiempo real

El MVP usa Server-Sent Events con un `EventEmitter` en memoria y polling de respaldo cada 15 segundos. Por esa razón el despliegue inicial debe usar una sola réplica. Para múltiples réplicas, sustituir el bus local por Redis/PubSub.
