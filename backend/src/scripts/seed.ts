import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Seed mínimo para producción: crea únicamente el usuario propietario (sin recetas ni datos demo).
// Configurable por variables de entorno; valores por defecto sólo para conveniencia local.
//   SEED_EMAIL, SEED_PASSWORD, SEED_NAME
async function main() {
  console.log('🌱 Iniciando seed...');

  const email = (process.env.SEED_EMAIL || 'admin@tastebox.local').trim().toLowerCase();
  const name = process.env.SEED_NAME || 'Admin';
  const password = process.env.SEED_PASSWORD || 'changeme123';

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {}, // no piso la contraseña si el usuario ya existe
    create: { email, name, password: hashedPassword },
  });

  console.log(`👤 Usuario listo: ${user.email}`);
  if (!process.env.SEED_PASSWORD) {
    console.log('⚠️  Usaste la contraseña por defecto ("changeme123"). Cambiala definiendo SEED_PASSWORD.');
  }
  console.log('✅ Seed completado (sin recetas).');
}

main()
  .catch((e) => {
    console.error('❌ Seed falló:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
