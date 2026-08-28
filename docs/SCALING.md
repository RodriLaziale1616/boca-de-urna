# Escalabilidad

El MVP está optimizado para una sola instancia en Railway. Para escalar a múltiples réplicas:

1. Sustituir el `EventEmitter` local por Redis/PubSub.
2. Mantener PostgreSQL como fuente de verdad.
3. Revisar rate limiting distribuido.
4. Ejecutar pruebas de carga con el número estimado de operadores concurrentes.
