# Operación del sistema

La pantalla de operador es deliberadamente mínima y no muestra resultados. El centro de control administrativo concentra resultados, cortes, operadores y configuración.

Para el MVP, mantener una sola réplica del servicio web/API para que el bus SSE en memoria sea consistente. El polling de respaldo de 15 segundos mantiene el dashboard actualizado si una conexión SSE se corta.
