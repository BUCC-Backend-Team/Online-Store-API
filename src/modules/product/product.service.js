const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');

const MAX_PRICE_CENTS = 9999999999;

const toCents = (value) => {
  const text = String(value).trim();
  const match = text.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    throw new ApiError(400, 'Price must be a positive amount with at most 2 decimal places');
  }

  const fraction = (match[2] || '').padEnd(2, '0');
  const cents = Number(match[1]) * 100 + Number(fraction);
  if (cents <= 0 || cents > MAX_PRICE_CENTS) {
    throw new ApiError(400, 'Price must be greater than 0 and at most 99999999.99');
  }

  return cents;
};

const formatCents = (cents) => {
  const whole = Math.trunc(cents / 100);
  const fraction = String(Math.abs(cents % 100)).padStart(2, '0');
  return `${whole}.${fraction}`;
};

const serializeProduct = (product) => ({
  id: product.id,
  sku: product.sku,
  name: product.name,
  description: product.description,
  price: formatCents(toCents(product.price)),
  stockQuantity: product.stockQuantity,
  isActive: product.isActive,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
});

const createProduct = async ({ role, sku, name, description, price, stockQuantity, isActive }) => {
  if (role !== 'admin') {
    throw new ApiError(403, 'Only admins can create products');
  }

  try {
    const product = await prisma.product.create({
      data: {
        sku: sku.trim(),
        name: name.trim(),
        description: description ? description.trim() || null : null,
        price: formatCents(toCents(price)),
        stockQuantity: Number(stockQuantity),
        isActive: isActive ?? true,
      },
    });

    return serializeProduct(product);
  } catch (error) {
    if (error.code === 'P2002') {
      throw new ApiError(409, 'A product with this SKU already exists');
    }
    throw error;
  }
};

const getProducts = async ({ role, page = 1, limit = 20 }) => {
  if (role !== 'customer' && role !== 'admin') {
    throw new ApiError(403, 'Only customers and admins can view products');
  }

  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count(),
  ]);

  return {
    products: products.map(serializeProduct),
    page,
    limit,
    total,
  };
};

module.exports = { createProduct, getProducts };
