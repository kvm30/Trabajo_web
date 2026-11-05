# Sistema de Votación en Vivo con Auditoría Criptográfica

Express + PostgreSQL + Socket.IO + JWT + Swagger. El frontend está en `../frontend/`, está construido con Vue 3 y Vite, y lo sirve el mismo servidor desde `../frontend/dist/`.

## Estructura del frontend

```text
frontend/
├── src/
│   ├── components/           # Pantallas Vue
│   ├── App.vue               # Navegación, sesión y eventos Socket.IO
│   └── api.js                # Comunicación con la API
├── css/styles.css
├── index.html
└── vite.config.js            # Proxy de API y Socket.IO para desarrollo
```

## Arranque
1. En DBeaver crea la base: `CREATE DATABASE backweb_db;` (o el nombre que pongas en `backend/.env`).
2. Ajusta `backend/.env` (guía en `backend/.env.example`): `DB_PASSWORD`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
3. Desde la raíz del proyecto, instala las dependencias y arranca la aplicación:
   ```powershell
   npm install
   npm run dev
   ```
4. Abre http://localhost:5173 para la interfaz de desarrollo · Swagger: http://localhost:3000/api-docs
5. Las tablas se crean solas al arrancar y se crea el usuario admin.

Para abrir el sitio desde otro dispositivo de la misma red Wi-Fi, sigue los pasos de [acceso en red local](../README.md#usar-desde-otros-dispositivos-en-la-misma-red-wi-fi).

## Recuperación de contraseña

Configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM` en `backend/.env` para habilitar el envío de enlaces de recuperación. Usa `SMTP_SECURE=true` con proveedores que requieren TLS directo (normalmente puerto 465); para el puerto 587, usa `SMTP_SECURE=false`. Define `APP_URL` con la URL pública del frontend (en local, `http://localhost:5173`). Los enlaces vencen en una hora y solo pueden utilizarse una vez.

## Elecciones, participación y notificaciones

El sistema mantiene separadas la participación (`voter_participation`) y la selección del voto (`votes`), sin asociar una cuenta con un candidato. El endpoint `GET /api/elections/participation` requiere una sesión con rol `voter` y solo devuelve conteos agregados.

El panel de administración permite programar y editar elecciones, administrar cuentas, y exportar resultados como CSV o imprimirlos/guardarlos como PDF. Las elecciones programadas se abren y cierran automáticamente.

Las notificaciones dentro del sitio informan sobre cambios de elecciones. Si configuras SMTP, también se envían avisos de apertura a quienes aún no han votado, recordatorios una hora antes del cierre y resultados al cerrar la elección. Los destinatarios del correo se ponen en copia oculta y los avisos pendientes se reintentan si falla el envío.

La sección **Calendario** agrupa elecciones próximas, abiertas y finalizadas. El administrador puede definir reglas e instrucciones y preguntas frecuentes, y probar una vista previa sin emitir votos reales. La bitácora registra acciones administrativas, nunca la opción por la que se votó.

La importación CSV requiere encabezados `name,email`, limita cada archivo a 500 personas y necesita SMTP para enviar los enlaces de configuración de contraseña (válidos por 48 horas). El modo de validación muestra filas inválidas o correos existentes antes de crear cuentas.

Para iniciar solamente un servicio usa `npm run dev:backend` o `npm run dev:frontend`. Vite usa el backend en `http://localhost:3000` como proxy para la API y Socket.IO.

Para compilar el frontend y ejecutar la aplicación de producción localmente:

```powershell
npm run build
npm start
```

## Publicación en Internet

La configuración de despliegue para Render está en [`../render.yaml`](../render.yaml). Sigue los pasos de publicación del [README principal](../README.md). Render proporciona el puerto y las variables de PostgreSQL; debes establecer `ADMIN_PASSWORD` al crear el Blueprint. La base de datos configurada es un recurso de pago para conservar los datos.

## Cómo funciona la auditoría
- `voter_participation` guarda QUIÉN votó (evita doble voto) pero no por quién.
- `votes` guarda POR QUIÉN se votó pero no quién (anonimato): no tiene `user_id`.
- Comprobante = SHA256(nonce aleatorio | elección | candidato | timestamp).
- Cada voto: `chain_hash = SHA256(prev_hash | comprobante | elección | candidato)`. Alterar un voto rompe la cadena (`GET /api/audit/:id/integrity`).
- Verificación ciudadana: `GET /api/audit/verify/:hash`.
- Conteo en vivo: evento `results:update` por Socket.IO a la sala `election:<id>`.
