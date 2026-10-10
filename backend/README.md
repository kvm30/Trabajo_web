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
