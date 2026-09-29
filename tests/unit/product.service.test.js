jest.mock('../../src/config/prisma', () => ({
  product: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
}));

const prisma = require('../../src/config/prisma');
const productService = require('../../src/modules/product/product.service');
const { makeProduct, makeProductRow } = require('../helpers/factories');

describe('productService', () => {
  describe('createProduct', () => {
    it('admin creates product and returns serialized result', async () => {
      const product = makeProduct();
      prisma.product.create.mockResolvedValue(product);

      const result = await productService.createProduct({
        role: 'admin',
        sku: 'NEW-001',
        name: 'New Product',
        price: '9.99',
        stockQuantity: 50,
      });

      expect(prisma.product.create).toHaveBeenCalledTimes(1);
      expect(result.sku).toBeDefined();
      expect(result.price).toMatch(/^\d+\.\d{2}$/); // formatted decimal
    });

    it('throws 403 if caller is not admin', async () => {
      await expect(
        productService.createProduct({ role: 'customer', sku: 'A', name: 'B', price: '1', stockQuantity: 0 })
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('throws 409 on duplicate SKU (Prisma P2002)', async () => {
      const err = new Error('Unique constraint');
      err.code = 'P2002';
      prisma.product.create.mockRejectedValue(err);

      await expect(
        productService.createProduct({ role: 'admin', sku: 'DUP-SKU', name: 'Dup', price: '5', stockQuantity: 10 })
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('validates price has at most 2 decimal places', async () => {
      await expect(
        productService.createProduct({ role: 'admin', sku: 'X', name: 'X', price: '9.999', stockQuantity: 1 })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('rejects price of zero', async () => {
      await expect(
        productService.createProduct({ role: 'admin', sku: 'X', name: 'X', price: '0', stockQuantity: 1 })
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('getProducts', () => {
    it('customer sees only active products', async () => {
      const products = [makeProduct(), makeProduct({ isActive: false })];
      prisma.product.findMany.mockResolvedValue([products[0]]);
      prisma.product.count.mockResolvedValue(1);

      const result = await productService.getProducts({ role: 'customer' });

      const findManyCall = prisma.product.findMany.mock.calls[0][0];
      expect(findManyCall.where).toEqual({ isActive: true });
      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('admin sees all products including inactive', async () => {
      const products = [makeProduct(), makeProduct({ isActive: false })];
      prisma.product.findMany.mockResolvedValue(products);
      prisma.product.count.mockResolvedValue(2);

      const result = await productService.getProducts({ role: 'admin' });

      const findManyCall = prisma.product.findMany.mock.calls[0][0];
      expect(findManyCall.where).toEqual({});
      expect(result.products).toHaveLength(2);
    });

    it('paginates results correctly', async () => {
      prisma.product.findMany.mockResolvedValue([makeProduct()]);
      prisma.product.count.mockResolvedValue(50);

      const result = await productService.getProducts({ role: 'admin', page: 3, limit: 10 });

      const findManyCall = prisma.product.findMany.mock.calls[0][0];
      expect(findManyCall.skip).toBe(20);
      expect(findManyCall.take).toBe(10);
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
    });

    it('throws 403 for unknown role', async () => {
      await expect(
        productService.getProducts({ role: 'superuser' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('getProductBySku', () => {
    it('customer can see active product', async () => {
      const product = makeProduct({ isActive: true });
      prisma.product.findUnique.mockResolvedValue(product);

      const result = await productService.getProductBySku({ role: 'customer', sku: product.sku });

      expect(result.sku).toBe(product.sku);
    });

    it('customer cannot see inactive product (404)', async () => {
      const product = makeProduct({ isActive: false });
      prisma.product.findUnique.mockResolvedValue(product);

      await expect(
        productService.getProductBySku({ role: 'customer', sku: product.sku })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('admin can see inactive product', async () => {
      const product = makeProduct({ isActive: false });
      prisma.product.findUnique.mockResolvedValue(product);

      const result = await productService.getProductBySku({ role: 'admin', sku: product.sku });

      expect(result.isActive).toBe(false);
    });

    it('throws 404 if product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        productService.getProductBySku({ role: 'admin', sku: 'MISSING-SKU' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('updateProduct', () => {
    it('admin updates product successfully', async () => {
      const product = makeProduct({ name: 'Updated Name' });
      const row = makeProductRow({ product_id: product.id });
      prisma.$transaction.mockImplementation((fn) => fn(prisma));
      prisma.$queryRaw.mockResolvedValue([row]);
      prisma.product.update.mockResolvedValue(product);

      const result = await productService.updateProduct({
        role: 'admin',
        sku: product.sku,
        updates: { name: 'Updated Name' },
      });

      expect(result.name).toBe('Updated Name');
    });

    it('throws 403 if caller is not admin', async () => {
      await expect(
        productService.updateProduct({ role: 'customer', sku: 'X', updates: { name: 'Y' } })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws 404 if product not found (empty lock result)', async () => {
      prisma.$transaction.mockImplementation((fn) => fn(prisma));
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        productService.updateProduct({ role: 'admin', sku: 'MISSING', updates: { name: 'X' } })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 409 on SKU conflict during update', async () => {
      const row = makeProductRow();
      prisma.$transaction.mockImplementation((fn) => fn(prisma));
      prisma.$queryRaw.mockResolvedValue([row]);
      const err = new Error('Unique constraint');
      err.code = 'P2002';
      prisma.product.update.mockRejectedValue(err);

      await expect(
        productService.updateProduct({ role: 'admin', sku: 'EXISTING', updates: { sku: 'TAKEN' } })
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('deactivateProduct', () => {
    it('admin deactivates product', async () => {
      const product = makeProduct({ isActive: false });
      const row = makeProductRow({ product_id: product.id });
      prisma.$transaction.mockImplementation((fn) => fn(prisma));
      prisma.$queryRaw.mockResolvedValue([row]);
      prisma.product.update.mockResolvedValue(product);

      const result = await productService.deactivateProduct({ role: 'admin', sku: product.sku });

      expect(result.isActive).toBe(false);
    });

    it('throws 403 if caller is not admin', async () => {
      await expect(
        productService.deactivateProduct({ role: 'customer', sku: 'X' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws 404 if product not found', async () => {
      prisma.$transaction.mockImplementation((fn) => fn(prisma));
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        productService.deactivateProduct({ role: 'admin', sku: 'MISSING' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
