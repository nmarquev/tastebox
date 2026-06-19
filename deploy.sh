#!/bin/bash

#############################################
# TasteBox - Script de Deployment VPS
# Para usar con CloudPanel y PM2
#############################################

set -e  # Salir si hay error

echo "🚀 Iniciando deployment de TasteBox..."

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # Sin color

# Configuración
APP_NAME="tastebox"
REPO_URL="https://github.com/nmarquev/tastebox.git"
BRANCH="main"

echo -e "${YELLOW}📦 Paso 1: Descargando últimos cambios desde Git...${NC}"
git fetch origin
git reset --hard origin/$BRANCH
git pull origin $BRANCH

# Asegurar permisos de ejecución en scripts
chmod +x deploy.sh debug-backend.sh 2>/dev/null || true

echo -e "${YELLOW}🔧 Paso 2: Instalando dependencias...${NC}"
npm install --production=false

echo -e "${YELLOW}🔨 Paso 3: Compilando frontend...${NC}"
npm run build

echo -e "${YELLOW}🔨 Paso 4: Compilando backend...${NC}"
cd backend
npm install --production=false
npm run build

echo -e "${YELLOW}🗄️  Paso 4b: Sincronizando base de datos (Prisma)...${NC}"
# Asegurar carpetas de datos/uploads (no se borran en el deploy)
mkdir -p db uploads
npx prisma generate
npx prisma db push   # crea/actualiza el esquema en db/tastebox.db (incluye tablas nuevas)

# Seed opcional: crear el usuario inicial (sin recetas). Ejecutar con:  SEED=1 ./deploy.sh
if [ "${SEED:-0}" = "1" ]; then
  echo -e "${YELLOW}🌱 Seed: creando usuario inicial...${NC}"
  npm run db:seed
fi

echo -e "${YELLOW}🔄 Paso 5: Reiniciando servicio PM2...${NC}"
cd ..

# Crear directorio de logs si no existe
mkdir -p backend/logs

# Verificar si el proceso PM2 existe
if pm2 describe $APP_NAME > /dev/null 2>&1; then
    echo "Reiniciando proceso PM2 existente..."
    pm2 restart $APP_NAME --update-env
    pm2 save
else
    echo "Creando nuevo proceso PM2..."
    # Crear proceso con configuración de producción
    pm2 start backend/dist/index.js \
        --name $APP_NAME \
        --time \
        --max-memory-restart 1G \
        --node-args="--max-old-space-size=1024" \
        --error backend/logs/error.log \
        --output backend/logs/output.log \
        --env production
    pm2 save
fi

echo -e "${YELLOW}🧹 Paso 6: Limpieza...${NC}"
# Limpiar node_modules de desarrollo
npm prune --production

echo -e "${GREEN}✅ ¡Deployment completado exitosamente!${NC}"
echo -e "${GREEN}📊 Estado de PM2:${NC}"
pm2 status

echo -e "\n${YELLOW}📝 Comandos útiles:${NC}"
echo "  pm2 logs $APP_NAME       - Ver logs"
echo "  pm2 restart $APP_NAME    - Reiniciar app"
echo "  pm2 stop $APP_NAME       - Detener app"
echo "  pm2 monit                - Monitorear recursos"
