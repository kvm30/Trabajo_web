# Sistema de Votación en Vivo con Auditoría Criptográfica

Express + PostgreSQL + Socket.IO + JWT + Swagger. El front está en `public/` y lo sirve el mismo servidor.

## Estructura del frontend

El frontend usa JavaScript nativo con módulos ES y no requiere compilación:

```text
public/
├── index.html
├── css/
│   └── styles.css
└── js/
    ├── app.js              # Navegación, sesión y eventos Socket.IO
    ├── api.js              # Comunicación con la API
    ├── utils.js            # Utilidades compartidas de interfaz
    └── views/              # Pantallas por funcionalidad
        ├── admin.js
        ├── detail.js
        ├── elections.js
        ├── login.js
        └── verify.js
```

## Arranque
1. En DBeaver crea la base: `CREATE DATABASE backweb_db;` (o el nombre que pongas en `.env`)
2. Ajusta `.env` (guía en `.env.example`): `DB_PASSWORD`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
3. `npm install` y luego `npm run dev`
4. App: http://localhost:3000 · Swagger: http://localhost:3000/api-docs
5. Las tablas se crean solas al arrancar y se crea el usuario admin.

## Cómo funciona la auditoría
- `voter_participation` guarda QUIÉN votó (evita doble voto) pero no por quién.
- `votes` guarda POR QUIÉN se votó pero no quién (anonimato): no tiene `user_id`.
- Comprobante = SHA256(nonce aleatorio | elección | candidato | timestamp).
- Cada voto: `chain_hash = SHA256(prev_hash | comprobante | elección | candidato)`. Alterar un voto rompe la cadena (`GET /api/audit/:id/integrity`).
- Verificación ciudadana: `GET /api/audit/verify/:hash`.
- Conteo en vivo: evento `results:update` por Socket.IO a la sala `election:<id>`.
