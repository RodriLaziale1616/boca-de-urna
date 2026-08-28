# Modelo de datos

- `Election`: elección, ciudad, fecha, zona horaria, estado y reglas del kiosco.
- `Candidate`: candidato/opción, lista, partido, número, color y orden.
- `PollingPlace`: local asociado a una elección.
- `User`: administrador u operador; los operadores pueden quedar asignados a elección/local.
- `Vote`: respuesta anónima con elección, candidato, operador, local, UUID de idempotencia y timestamp.
- `Session`: sesión opaca con hash del token, CSRF y vencimiento.
- `AuditLog`: cambios administrativos relevantes.

`Vote` no contiene datos identificatorios del votante.
