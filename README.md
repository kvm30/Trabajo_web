# Sistema de votación

## Estructura del proyecto

```text
.
├── package.json              # Workspaces y comandos para frontend/backend
├── package-lock.json         # Dependencias bloqueadas del proyecto
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   └── utils/
│   ├── .env.example
│   ├── package.json
│   └── README.md
├── frontend/
│   ├── src/
│   │   └── components/
│   ├── css/
│   ├── index.html
│   ├── package.json          # Aplicación Vue 3
│   └── vite.config.js
├── render.yaml
└── README.md
```

La raíz administra el proyecto como un monorepo npm: contiene los comandos comunes y coordina los workspaces `backend/` y `frontend/`. El **backend** contiene la API, la lógica del servidor y las migraciones de PostgreSQL. El **frontend** está construido con Vue 3 y Vite; el backend sirve los archivos compilados desde `frontend/dist`.

## Ejecutar localmente

1. Instala Node.js y PostgreSQL.
2. Crea la base de datos `backweb_db` y configura las variables en `backend/.env` (puedes usar `backend/.env.example` como guía).
3. Desde la raíz del proyecto, instala dependencias y arranca frontend y backend:

   ```powershell
   npm install
   npm run dev
   ```

4. Abre http://localhost:5173 para usar la interfaz de desarrollo. Vite conecta la API y Socket.IO con el backend en http://localhost:3000.

Para compilar el frontend y ejecutar la aplicación servida por Express:

```powershell
npm run build
npm start
```

La aplicación estará disponible en http://localhost:3000. Consulta las [instrucciones del backend](./backend/README.md) para detalles de configuración.

## Publicar para acceder desde Internet

El archivo [`render.yaml`](./render.yaml) configura el despliegue del frontend, el backend y una base de datos PostgreSQL en Render.

1. Sube este repositorio a GitHub y crea una cuenta en [Render](https://render.com/).
2. En Render, crea un **Blueprint** y conecta el repositorio.
3. Cuando Render lo solicite, define `ADMIN_PASSWORD` con una contraseña segura para la cuenta administradora.
4. Confirma la creación de los recursos. La base de datos definida usa el plan `basic-256mb`, que es de pago.
5. Al terminar el despliegue, abre la URL pública del servicio. Esa misma dirección funciona desde celulares y computadoras con acceso a Internet.

Render configura el puerto, las credenciales de PostgreSQL y el secreto de sesión automáticamente. No publiques el archivo `backend/.env` ni compartas las credenciales de administrador. Para conservar los votos, mantén activa la base de datos de pago; no la elimines desde Render.
