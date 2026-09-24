require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME;

  if (!email || !password || !name) {
    throw new Error('ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_NAME are required to seed the admin');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      password: passwordHash,
      role: 'admin',
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
