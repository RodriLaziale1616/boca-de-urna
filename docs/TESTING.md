# Pruebas mínimas

- Login correcto e incorrecto.
- Operador recibe 403 en endpoints administrativos.
- Admin recibe 403 en endpoints exclusivos de operador cuando corresponda.
- Doble envío con el mismo `requestId` no duplica votos.
- Doble toque rápido queda bloqueado.
- Voto con candidato de otra elección es rechazado.
- Voto cuando la elección está cerrada es rechazado.
- Dispositivo offline bloquea la UI de voto.
- Dashboard refleja votos en tiempo real y mediante polling de respaldo.
- Filtro por local mantiene totales consistentes.
- Trigger PostgreSQL rechaza `UPDATE` y `DELETE` sobre `Vote`.
