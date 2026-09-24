const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const products = [
  {
    sku: 'TECH-WHP-001',
    name: 'Wireless Noise-Canceling Headphones',
    description: 'Premium over-ear headphones with active noise cancellation and 30-hour battery life.',
    price: 199.99,
    stockQuantity: 45,
    isActive: true,
  },
  {
    sku: 'TECH-MKB-002',
    name: 'Mechanical Gaming Keyboard',
    description: 'RGB backlit mechanical keyboard with tactile switches and detachable USB-C cable.',
    price: 89.99,
    stockQuantity: 60,
    isActive: true,
  },
  {
    sku: 'TECH-WMS-003',
    name: 'Ergonomic Wireless Mouse',
    description: 'Precision wireless mouse with adjustable DPI and rechargeable battery.',
    price: 49.99,
    stockQuantity: 80,
    isActive: true,
  },
  {
    sku: 'TECH-MON-004',
    name: '27-inch 4K UHD Monitor',
    description: 'Ultra-sharp IPS display with HDR support, 144Hz refresh rate, and HDMI/DisplayPort inputs.',
    price: 349.99,
    stockQuantity: 25,
    isActive: true,
  },
  {
    sku: 'TECH-USB-005',
    name: '7-in-1 USB-C Hub Adapter',
    description: 'Multi-port adapter featuring 4K HDMI, 100W Power Delivery, SD card reader, and 3 USB 3.0 ports.',
    price: 39.99,
    stockQuantity: 120,
    isActive: true,
  },
  {
    sku: 'HOME-SSK-006',
    name: 'Smart Stainless Steel Kettle',
    description: 'Electric gooseneck kettle with variable temperature presets and keep-warm function.',
    price: 69.99,
    stockQuantity: 35,
    isActive: true,
  },
  {
    sku: 'HOME-ADP-007',
    name: 'Aroma Diffuser and Humidifier',
    description: 'Ultrasonic cool mist humidifier with 7 LED ambient colors and auto shut-off.',
    price: 29.99,
    stockQuantity: 90,
    isActive: true,
  },
  {
    sku: 'HOME-DLT-008',
    name: 'LED Desk Lamp with Wireless Charger',
    description: 'Dimmable eye-caring desk light with built-in 10W wireless fast-charging pad.',
    price: 44.99,
    stockQuantity: 50,
    isActive: true,
  },
  {
    sku: 'FIT-SWT-009',
    name: 'Waterproof Smart Fitness Watch',
    description: 'Activity tracker with heart rate monitor, sleep tracking, GPS, and 7-day battery life.',
    price: 129.99,
    stockQuantity: 40,
    isActive: true,
  },
  {
    sku: 'FIT-YGM-010',
    name: 'Non-Slip Eco-Friendly Yoga Mat',
    description: '6mm high-density cushioned exercise mat with alignment lines and carrying strap.',
    price: 34.99,
    stockQuantity: 75,
    isActive: true,
  },
  {
    sku: 'FIT-SSB-011',
    name: 'Insulated Stainless Steel Water Bottle',
    description: '32oz vacuum-insulated flask keeping drinks cold for 24 hours or hot for 12 hours.',
    price: 24.99,
    stockQuantity: 110,
    isActive: true,
  },
  {
    sku: 'ACC-LBP-012',
    name: 'Water-Resistant Laptop Backpack',
    description: 'Durable travel backpack with padded sleeve for up to 15.6-inch laptops and anti-theft pocket.',
    price: 59.99,
    stockQuantity: 65,
    isActive: true,
  },
  {
    sku: 'ACC-PBK-013',
    name: '20,000mAh Portable Power Bank',
    description: 'High-capacity power bank with 22.5W fast charging and dual USB outputs.',
    price: 42.99,
    stockQuantity: 85,
    isActive: true,
  },
  {
    sku: 'AUD-BSP-014',
    name: 'Portable Waterproof Bluetooth Speaker',
    description: 'Compact outdoor wireless speaker with deep bass, IPX7 water resistance, and 12-hour playtime.',
    price: 54.99,
    stockQuantity: 70,
    isActive: true,
  },
  {
    sku: 'LIF-BSE-015',
    name: 'Bamboo Memory Foam Bed Pillow',
    description: 'Ergonomic contour cooling pillow with breathable washable bamboo cover.',
    price: 39.99,
    stockQuantity: 55,
    isActive: true,
  },
];

async function seed() {
  console.log('Seeding products...');

  let count = 0;
  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        description: product.description,
        price: product.price,
        stockQuantity: product.stockQuantity,
        isActive: product.isActive,
      },
      create: product,
    });
    count += 1;
    console.log(`[${count}/${products.length}] Seeded: ${product.name} (${product.sku})`);
  }

  console.log(`\nSuccessfully seeded ${count} products.`);
}

seed()
  .catch((error) => {
    console.error('Failed to seed database:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
