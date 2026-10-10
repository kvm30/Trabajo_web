# Sistema de votación

## Estructura del proyecto

```text
.
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
│   ├── package.json
│   └── vite.config.js
├── render.yaml
└── README.md
```

El **backend** contiene la API, la lógica del servidor y las migraciones de PostgreSQL. El **frontend** está construido con Vue 3 y Vite; el backend sirve los archivos compilados desde `frontend/dist`.

Consulta las [instrucciones del backend](./backend/README.md) para instalar, compilar y ejecutar el sitio localmente.

## Publicar para acceder desde Internet

El archivo [`render.yaml`](./render.yaml) configura el despliegue del frontend, el backend y una base de datos PostgreSQL en Render.

1. Sube este repositorio a GitHub y crea una cuenta en [Render](https://render.com/).
2. En Render, crea un **Blueprint** y conecta el repositorio.
3. Cuando Render lo solicite, define `ADMIN_PASSWORD` con una contraseña segura para la cuenta administradora.
4. Confirma la creación de los recursos. La base de datos definida usa el plan `basic-256mb`, que es de pago.
5. Al terminar el despliegue, abre la URL pública del servicio. Esa misma dirección funciona desde celulares y computadoras con acceso a Internet.

Render configura el puerto, las credenciales de PostgreSQL y el secreto de sesión automáticamente. No publiques el archivo `backend/.env` ni compartas las credenciales de administrador. Para conservar los votos, mantén activa la base de datos de pago; no la elimines desde Render.
