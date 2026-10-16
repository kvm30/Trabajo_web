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
│   │   ├── assets/           # Estilos globales y recursos estáticos
│   │   ├── components/       # Componentes reutilizables
│   │   ├── layouts/          # Estructuras compartidas de las páginas
│   │   ├── router/           # Rutas de Vue Router
│   │   ├── services/         # Comunicación con la API
│   │   └── views/            # Páginas de la aplicación
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

El archivo [`render.yaml`](./render.yaml) configura el frontend y el backend en una instancia gratuita de Render. Para mantener PostgreSQL en el plan gratuito, la base se aloja por separado en Neon. El Blueprint no crea bases de datos de pago.

1. Crea un proyecto gratuito en [Neon](https://neon.tech/) y copia su cadena de conexión PostgreSQL desde **Connect**. Neon requiere SSL; la aplicación lo valida automáticamente al usar `DATABASE_URL`.
2. Crea una cuenta en [Render](https://render.com/) y conecta este repositorio de GitHub con **New → Blueprint**.
3. Al aplicar el Blueprint, introduce la cadena de conexión de Neon como `DATABASE_URL` y define un `ADMIN_PASSWORD` seguro. No compartas ni subas esas credenciales al repositorio.
4. Confirma que el servicio web esté en el plan **Free** antes de desplegar. El Blueprint no aprovisiona PostgreSQL en Render.
5. Cuando termine el despliegue, abre la URL pública de Render. Podrás visitar esa dirección desde teléfonos y computadores con acceso a Internet.

En el plan gratuito de Render, el servidor se suspende tras un periodo sin actividad y puede tardar alrededor de un minuto en despertar. Neon Free también tiene límites de uso y suspende la base cuando está inactiva. Estos planes son adecuados para pruebas y proyectos pequeños, no para aplicaciones de producción con requisitos de disponibilidad. No publiques `backend/.env`, la URL de Neon ni la contraseña de administrador.
