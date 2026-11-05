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

### Usar desde otros dispositivos en la misma red Wi-Fi

1. Inicia los servicios desde la computadora que tiene el proyecto y PostgreSQL:

   ```powershell
   npm run dev
   ```

2. En esa computadora, ejecuta `ipconfig` y busca la dirección **IPv4** del adaptador Wi-Fi activo (por ejemplo, `192.168.1.25`).
3. Desde el teléfono u otro dispositivo conectado a la misma red, abre `http://<IPv4-de-la-computadora>:5173` (por ejemplo, `http://192.168.1.25:5173`). No uses `localhost` en el otro dispositivo: esa dirección apuntaría al propio teléfono.

Vite y el backend escuchan en la red local; las solicitudes de API y Socket.IO se redirigen al backend automáticamente. Si Windows muestra una alerta de Firewall al iniciar Node.js, permite el acceso en redes **privadas**. Comprueba que ambos dispositivos estén en la misma red y que el router no tenga activado el aislamiento entre dispositivos. Para la versión compilada (`npm run build` y `npm start`), usa `http://<IPv4-de-la-computadora>:3000` en lugar del puerto 5173. Esto permite acceso en la red local; no publica el sitio en Internet.

Para compilar el frontend y ejecutar la aplicación servida por Express:

```powershell
npm run build
npm start
```

La aplicación estará disponible en http://localhost:3000. Consulta las [instrucciones del backend](./backend/README.md) para detalles de configuración.

## Historial de votos

Las personas con sesión iniciada pueden consultar los comprobantes guardados en **Mi historial**. Por privacidad, los comprobantes se conservan en el almacenamiento local del navegador y no se relacionan con la cuenta en el servidor; por eso el historial solo está disponible en el navegador donde se emitió el voto y se pierde al borrar sus datos.

## Participación anónima y notificaciones

Las cuentas votantes pueden abrir **Participación** para ver totales agregados por elección y el porcentaje general. El panel no lista personas ni relaciona cuentas con candidatos; no está disponible para visitantes sin sesión ni para administradores.

Si configuras SMTP, el sistema envía un aviso de apertura a quienes aún no han votado en esa elección, un recordatorio una hora antes del cierre a quienes ya participaron y los resultados al cerrar la elección a esas mismas personas. Los destinatarios se ponen en copia oculta. Los avisos pendientes se reintentan si falla el correo. Configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` y `APP_URL`; sin SMTP, el resto del sitio funciona, pero no se envían avisos.

## Calendario, reglas y administración

El **Calendario** reúne elecciones próximas, abiertas y finalizadas. Cada elección puede publicar reglas, instrucciones y preguntas frecuentes desde el panel administrador. En borradores, **Probar vista previa** permite ensayar la selección de una opción sin registrar votos ni cambiar resultados.

El panel también muestra una bitácora de cambios administrativos que no almacena la opción elegida por ningún votante. Para importar votantes, descarga la plantilla CSV con encabezados `name,email`, valídala en el panel y confirma la importación. Se admiten hasta 500 cuentas por archivo; cada persona recibe por correo un enlace de 48 horas para definir su contraseña, por lo que SMTP debe estar configurado.

## Publicar para acceder desde Internet

El archivo [`render.yaml`](./render.yaml) configura el despliegue del frontend, el backend y una base de datos PostgreSQL en Render.

1. Sube este repositorio a GitHub y crea una cuenta en [Render](https://render.com/).
2. En Render, crea un **Blueprint** y conecta el repositorio.
3. Cuando Render lo solicite, define `ADMIN_PASSWORD` con una contraseña segura para la cuenta administradora.
4. Confirma la creación de los recursos. La base de datos definida usa el plan `basic-256mb`, que es de pago.
5. Al terminar el despliegue, abre la URL pública del servicio. Esa misma dirección funciona desde celulares y computadoras con acceso a Internet.

Render configura el puerto, las credenciales de PostgreSQL y el secreto de sesión automáticamente. No publiques el archivo `backend/.env` ni compartas las credenciales de administrador. Para conservar los votos, mantén activa la base de datos de pago; no la elimines desde Render.
