# Despliegue en Railway

## Servicios

- Aplicación `boca-de-urna` desde este repositorio.
- PostgreSQL administrado por Railway.

## Variables requeridas

```text
NODE_ENV=production
DATABASE_URL=<referencia al PostgreSQL de Railway>
SESSION_TTL_HOURS=12
ADMIN_NAME=<nombre del administrador inicial>
ADMIN_USERNAME=<usuario inicial>
ADMIN_PASSWORD=<contraseña larga y única>
PUBLIC_APP_NAME=Boca de Urna
```

No guardar valores reales de estas variables en GitHub.

## Configuración recomendada

- Una sola réplica para el MVP.
- Healthcheck: `/api/health`.
- Backups de PostgreSQL habilitados.
- Dominio HTTPS administrado por Railway o dominio propio.
- Después del primer arranque confirmar que el administrador pudo iniciar sesión y luego rotar `ADMIN_PASSWORD` en Railway.

## Prueba previa a campo

1. Crear elección de prueba.
2. Crear dos candidatos y un local.
3. Crear un usuario operador.
4. Iniciar sesión en otro navegador como operador.
5. Confirmar que el operador no puede acceder a `/api/admin/*`.
6. Activar la encuesta y registrar votos de prueba.
7. Verificar dashboard, cortes por hora y ranking de operadores.
8. Cerrar la elección y comprobar que el backend rechaza nuevos votos.
