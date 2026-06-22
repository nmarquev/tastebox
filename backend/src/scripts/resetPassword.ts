import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Resetea la contraseña de un usuario por email (recuperación manual, para el dueño del servidor).
// Uso:
//   RESET_EMAIL=tu@email.com RESET_PASSWORD=tuNuevaClave npm run reset-password
async function main() {
  const email = (process.env.RESET_EMAIL || '').trim().toLowerCase();
  const password = process.env.RESET_PASSWORD || '';

  if (!email || !password) {
    console.error('❌ Faltan datos. Ejemplo:');
    console.error('   RESET_EMAIL=tu@email.com RESET_PASSWORD=nuevaClave123 npm run reset-password');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('❌ La contraseña debe tener al menos 6 caracteres.');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`❌ No existe un usuario con el email ${email}`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { email }, data: { password: hashed } });
  console.log(`✅ Contraseña actualizada para ${email}. Ya podés iniciar sesión con la nueva clave.`);
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
