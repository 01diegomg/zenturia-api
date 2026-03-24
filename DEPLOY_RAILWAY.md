# Guía de Despliegue en Railway - ZENTURIA

## Requisitos Previos
- Cuenta en [Railway](https://railway.app)
- Cuenta en [Cloudinary](https://cloudinary.com)
- Repositorio en GitHub con este proyecto

---

## Paso 1: Subir código a GitHub

```bash
cd barberia-proyecto-final
git init
git add .
git commit -m "Initial commit - ZENTURIA API"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/zenturia-api.git
git push -u origin main
```

---

## Paso 2: Crear Proyecto en Railway

1. Ve a [railway.app](https://railway.app) e inicia sesión con GitHub
2. Click en **"New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Selecciona tu repositorio `zenturia-api`

---

## Paso 3: Agregar PostgreSQL

1. En el proyecto de Railway, click en **"+ New"**
2. Selecciona **"Database"** → **"Add PostgreSQL"**
3. Railway creará la base de datos y la variable `DATABASE_URL` automáticamente
4. **IMPORTANTE:** Conecta la base de datos a tu servicio:
   - Click en tu servicio (el que tiene el código)
   - Ve a **Variables**
   - Click en **"Add Reference"** → selecciona `DATABASE_URL` del PostgreSQL

---

## Paso 4: Configurar Variables de Entorno

En Railway, ve a tu servicio → **Variables** y agrega:

| Variable | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | *(genera una clave segura)* |
| `JWT_REFRESH_SECRET` | *(genera otra clave segura)* |
| `CLOUDINARY_CLOUD_NAME` | *(tu cloud name)* |
| `CLOUDINARY_API_KEY` | *(tu API key)* |
| `CLOUDINARY_API_SECRET` | *(tu API secret)* |
| `ALLOWED_ORIGINS` | `https://tu-app.up.railway.app` |

### Generar claves JWT seguras:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Paso 5: Deploy

Railway despliega automáticamente al detectar cambios en GitHub.

El script `build` ejecuta:
- `prisma generate` (genera el cliente)
- `prisma db push` (sincroniza el schema con PostgreSQL)

---

## Paso 6: Verificar

1. Railway te dará una URL como `https://tu-app.railway.app`
2. Prueba el endpoint de salud: `https://tu-app.railway.app/health`
3. Deberías ver: `{"status":"ok","timestamp":"..."}`

---

## Seed de Datos (Opcional)

Para cargar datos iniciales después del deploy:

1. En Railway, ve a tu servicio
2. Abre la terminal (Shell)
3. Ejecuta:
```bash
npm run db:seed
```

---

## Troubleshooting

### Error: "Migration failed"
- Verifica que `DATABASE_URL` esté configurada correctamente
- Asegúrate de que las migraciones sean para PostgreSQL, no SQLite

### Error: "Cannot find module '@prisma/client'"
- El script `postinstall` debería generar el cliente
- Si falla, agrega `npx prisma generate` al inicio del script `start`

### Error: "CORS blocked"
- Agrega tu dominio de Railway a `ALLOWED_ORIGINS`

---

## URLs Importantes

- **API Base**: `https://tu-app.railway.app`
- **Health Check**: `https://tu-app.railway.app/health`
- **Web App**: `https://tu-app.railway.app` (sirve el frontend)

---

## Endpoints Disponibles

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/register/client` | Registrar cliente |
| POST | `/login/client` | Login cliente |
| POST | `/login/admin` | Login admin |
| GET | `/appointments/my` | Mis citas |
| POST | `/appointments/create` | Crear cita |
| GET | `/content/services` | Listar servicios |
| GET | `/gallery` | Obtener galería |
| GET | `/health` | Estado del servidor |
