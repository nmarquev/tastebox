# Deploy de TasteBox en VPS con CloudPanel

Guía paso a paso para publicar **https://tastebox.beweb.com.ar**.

Arquitectura en producción:

- **Frontend** (React + Vite) → build estático `dist/`, servido por Nginx.
- **Backend** (Express + Prisma) → proceso Node con **PM2**, escuchando HTTP en `127.0.0.1:5000`
  (TLS lo termina Nginx; por eso `SSL_ENABLED=false`).
- **DB**: SQLite en `backend/db/tastebox.db`.
- **Uploads**: en disco, `backend/uploads/`, servidos por el backend en `/uploads`.
- Nginx hace de reverse proxy de `/api` y `/uploads` hacia el backend y sirve el SPA en `/`.

> Convención de rutas: asumo que el sitio en CloudPanel queda en
> `/home/tastebox/htdocs/tastebox.beweb.com.ar`. Ajustá el usuario/ruta a tu instalación.
> En adelante: `SITE_DIR=/home/tastebox/htdocs/tastebox.beweb.com.ar`.

---

## 0) Requisitos previos

- VPS con CloudPanel instalado.
- DNS: `tastebox.beweb.com.ar` con un registro **A** apuntando a la IP del VPS.
- Node.js 20 LTS (o 22). CloudPanel permite instalar Node por sitio; si no, usá `nvm`.
- Acceso SSH al servidor.

## 1) Dependencias del sistema (para Puppeteer / Foodit-Cookidoo)

`puppeteer` necesita librerías de Chromium. `sharp`, `pdfkit` y `pdf-lib` ya no requieren binarios del SO.

```bash
sudo apt-get update
sudo apt-get install -y \
  ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
  libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 \
  libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
  libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
  libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
  libxss1 libxtst6 lsb-release wget xdg-utils
```

## 2) Crear el sitio en CloudPanel

1. CloudPanel → **Sites → Add Site → Create a Node.js Site** (o "Static" + se ajusta el vhost; cualquiera sirve, vamos a editar el vhost igual).
   - Domain: `tastebox.beweb.com.ar`
   - App Port: `5000` (el del backend)
2. **SSL/TLS → Let's Encrypt** → emitir certificado para el dominio (renovación automática).

## 3) Clonar el repo y configurar variables

```bash
SITE_DIR=/home/tastebox/htdocs/tastebox.beweb.com.ar
cd "$SITE_DIR"
git clone https://github.com/nmarquev/tastebox .   # o la URL con token/deploy key si el repo es privado
```

### Backend `.env` (`$SITE_DIR/backend/.env`)

```env
DATABASE_URL="file:./db/tastebox.db"
OPENAI_API_KEY="sk-..."            # o la key de OpenRouter
# OPENAI_BASE_URL="https://openrouter.ai/api/v1"   # solo si usás OpenRouter
OPENAI_MODEL="openai/gpt-4o-mini"
JWT_SECRET="<una-cadena-larga-y-secreta>"
PORT=5000
NODE_ENV=production
SSL_ENABLED=false                  # IMPORTANTE: Nginx termina el TLS
UPLOAD_DIR=./uploads
FRONTEND_URL=https://tastebox.beweb.com.ar
```

### Frontend `.env.production` (`$SITE_DIR/.env.production`) — OBLIGATORIO

Vite "hornea" las variables en build. Sin `VITE_API_URL`, el front apunta por defecto a
`http://localhost:3005` (ver `src/utils/api.ts`). Hay que setear el **origen completo**
(se usa tanto para `/api` como para `/uploads`):

```env
VITE_API_URL=https://tastebox.beweb.com.ar
```

> Tiene que existir **antes** de `npm run build` (paso 6). Si cambiás este valor, hay que volver a buildear.

## 4) Instalar dependencias

```bash
cd "$SITE_DIR"
npm ci                # frontend
cd backend
npm ci                # backend (descarga Chromium para puppeteer)
```

## 5) Base de datos (Prisma)

Usamos **`prisma db push`** (sincroniza el esquema directo desde `schema.prisma`, sin historial de
migraciones — simple y suficiente para un único usuario).

```bash
cd "$SITE_DIR/backend"
mkdir -p db uploads
npx prisma generate
npx prisma db push          # crea/actualiza todas las tablas en db/tastebox.db
# Crear el usuario inicial (SIN recetas). Definí las credenciales por entorno:
SEED_EMAIL="vos@tudominio.com" SEED_PASSWORD="<contraseña-fuerte>" SEED_NAME="Tu Nombre" npm run db:seed
```

> Si preferís migraciones formales (`prisma migrate deploy`), tené en cuenta que el historial de
> migraciones del repo no está 100% alineado con el esquema (se usó `db push` en dev). `db push` evita
> ese problema.

## 6) Build del frontend

```bash
cd "$SITE_DIR"
npm run build         # genera dist/
```

## 7) Build + arranque del backend con PM2

```bash
cd "$SITE_DIR/backend"
npm run build         # compila a dist/ (tsc, tolera errores de tipos pre-existentes)
npm i -g pm2          # si no está
pm2 start dist/index.js --name tastebox
pm2 save
pm2 startup           # seguí la instrucción que imprime para que arranque al bootear
```

Verificá que el backend responde local:

```bash
curl -s http://127.0.0.1:5000/api/health
```

> En la práctica, los pasos 4–7 (deps, build front/back, Prisma, seed y PM2) los automatiza
> **`./deploy.sh`** (ver paso 10). La primera vez podés correr `SEED=1 ./deploy.sh` para crear el usuario.

## 8) Configurar Nginx (vhost del sitio en CloudPanel)

CloudPanel → Site → **Vhost** (o "Nginx Settings"). El SPA se sirve desde `dist/` y se proxean
`/api` y `/uploads` al backend. Dentro del `server { ... }` que ya gestiona CloudPanel
(con el SSL de Let's Encrypt), dejá la raíz y las locations así:

```nginx
    root /home/tastebox/htdocs/tastebox.beweb.com.ar/dist;
    index index.html;

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;          # importación/LLM pueden tardar
        client_max_body_size 15m;         # subida de imágenes/DOCX
    }

    # Imágenes subidas (servidas por el backend)
    location /uploads/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
    }

    # SPA: cualquier ruta cae en index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
```

Guardá y recargá Nginx (CloudPanel lo hace al guardar, o `sudo systemctl reload nginx`).

## 9) Verificación

- `https://tastebox.beweb.com.ar` carga el frontend.
- Login / listar recetas funciona (consume `/api`).
- Las imágenes (`/uploads/...`) se ven.
- Importar por URL / DOCX / extensión y generar PDF de una receta funcionan.

## 10) Actualizaciones futuras (deploy de nuevos cambios)

Usá el script versionado **`deploy.sh`** (hace git pull + build front/back + `prisma db push` + reload PM2):

```bash
cd "$SITE_DIR"
./deploy.sh              # actualizar a lo último de main
./deploy.sh --no-pull    # rebuild sin git pull
SEED=1 ./deploy.sh       # además corre el seed (usuario inicial; definí SEED_EMAIL/SEED_PASSWORD en backend/.env)
```

> Si `deploy.sh` no es ejecutable: `chmod +x deploy.sh`.

---

## Notas

- **Extensión de Chrome**: `npm run package-extension` genera `dist/tastebox-extension.zip`.
  Subilo a `/downloads/` del sitio si querés ofrecerlo para descarga.
- **Backups**: respaldá `backend/db/tastebox.db` y `backend/uploads/` periódicamente.
- **DB pesada en dev**: la `dev.db` local pesa ~72 MB porque 163 imágenes están guardadas como
  base64 dentro de `recipe_images.url` en vez de como archivos en `uploads/`. En prod conviene
  empezar con DB limpia. (Pendiente opcional: migrar esas imágenes base64 a `uploads/` para aligerar
  DB y backups.)
- **CORS**: el backend en `NODE_ENV=production` solo permite el origen `https://tastebox.beweb.com.ar`
  y extensiones de Chrome (ver `backend/src/index.ts`).
