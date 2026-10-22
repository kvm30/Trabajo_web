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

El panel administrador permite programar fechas de inicio y cierre; el backend cambia el estado automáticamente y también verifica el horario al recibir cada voto. La participación se calcula sobre las cuentas con rol de votante registradas, sin exponer quién participó. Desde el panel se pueden filtrar elecciones y exportar resultados como CSV o imprimirlos/guardarlos como PDF desde el navegador.

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

El archivo [`render.yaml`](./render.yaml) configura el servicio web gratuito en Render. Para evitar el costo y la expiración de una base de datos gratuita de Render, la aplicación puede conectarse a PostgreSQL en el plan gratuito de Neon.

1. Sube los cambios de este repositorio a GitHub.
2. Crea un proyecto gratuito en [Neon](https://neon.tech/) y copia su cadena de conexión PostgreSQL (`DATABASE_URL`).
3. En [Render](https://render.com/), crea un **Blueprint** y conecta este repositorio.
4. Cuando Render solicite las variables, pega la cadena de Neon en `DATABASE_URL` y define una contraseña segura y única en `ADMIN_PASSWORD`.
5. Confirma el despliegue. Al terminar, Render mostrará la URL pública `https://...onrender.com`; compártela para que ingresen desde cualquier red o dispositivo.

El servicio gratuito de Render puede suspenderse tras un periodo sin visitas; el primer acceso después de la suspensión puede tardar alrededor de un minuto. Neon también aplica límites a su plan gratuito. Estos planes sirven para demostraciones y pruebas, pero no se recomiendan para elecciones reales o información que requiera disponibilidad y conservación garantizadas. No publiques `backend/.env` ni compartas las credenciales de administrador.
