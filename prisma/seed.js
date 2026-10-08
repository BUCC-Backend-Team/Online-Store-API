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

  // Sample catalog so a fresh database has something to browse and order.
  // Upsert by SKU keeps the seed safe to run more than once.
  const sampleProducts = [
    { sku: 'SAMPLE-TSHIRT', name: 'Cotton T-Shirt', description: 'Plain white tee', price: '15.00', stockQuantity: 100 },
    { sku: 'SAMPLE-MUG', name: 'Coffee Mug', description: '350ml ceramic mug', price: '8.50', stockQuantity: 50 },
    { sku: 'SAMPLE-CAP', name: 'Baseball Cap', description: 'Adjustable cap', price: '12.00', stockQuantity: 30 },
  ];

  for (const product of sampleProducts) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    });
  }
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
