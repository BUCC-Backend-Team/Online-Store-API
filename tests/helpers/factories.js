const { randomUUID } = require('crypto');

const makeUser = (overrides = {}) => ({
  id: randomUUID(),
  name: 'Test User',
  email: 'customer@example.com',
  password: '$2b$10$abcdefghijklmnopqrstuuHashedPasswordHere',
  role: 'customer',
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

const makeAdmin = (overrides = {}) =>
  makeUser({ name: 'Admin User', email: 'admin@example.com', role: 'admin', ...overrides });

const makeProduct = (overrides = {}) => ({
  id: randomUUID(),
  sku: 'TEST-SKU-001',
  name: 'Test Product',
  description: 'A test product description',
  price: '9.99',
  stockQuantity: 100,
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

const makeOrderItem = (overrides = {}) => ({
  id: randomUUID(),
  orderId: randomUUID(),
  productId: randomUUID(),
  quantity: 2,
  unitPrice: '9.99',
  ...overrides,
});

const makeOrder = (overrides = {}) => {
  const item = makeOrderItem();
  return {
    id: randomUUID(),
    userId: randomUUID(),
    status: 'pending',
    totalAmount: '19.98',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    orderItems: [item],
    ...overrides,
  };
};

// Raw DB row shape returned by $queryRaw (snake_case, matching Postgres column names)
const makeProductRow = (overrides = {}) => ({
  product_id: randomUUID(),
  sku: 'TEST-SKU-001',
  name: 'Test Product',
  price: '9.99',
  stock_quantity: 100,
  is_active: true,
  ...overrides,
});

const makeOrderRow = (userId, overrides = {}) => ({
  order_id: randomUUID(),
  user_id: userId,
  status: 'pending',
  ...overrides,
});

module.exports = { makeUser, makeAdmin, makeProduct, makeOrderItem, makeOrder, makeProductRow, makeOrderRow };
