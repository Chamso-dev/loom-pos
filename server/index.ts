import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  barcode: z.string().min(1),
  category: z.string().min(1),
  size: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  costPrice: z.number().positive(),
  sellingPrice: z.number().positive(),
  gst: z.number().min(0),
  stock: z.number().int().min(0),
  supplier: z.string().optional().nullable(),
});

const settingsSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  gstin: z.string().min(1),
  upiId: z.string().min(1),
  phone: z.string().min(1),
});


// Get products with pagination
app.get('/api/products', async (req, res) => {
  try {
    const { page = '1', limit = '50', search = '' } = req.query;
    const p = parseInt(String(page));
    const l = parseInt(String(limit));
    const skip = (p - 1) * l;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { sku: { contains: String(search) } },
        { barcode: { contains: String(search) } },
      ];
    }

    const total = await prisma.product.count({ where });
    const products = await prisma.product.findMany({
      where,
      skip,
      take: l,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      products,
      total,
      page: p,
      limit: l,
      hasMore: skip + products.length < total
    });
  } catch (error) {
    console.error('Fetch products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Create product
app.post('/api/products', async (req, res) => {
  try {
    const validatedData = productSchema.parse(req.body);
    const product = await prisma.product.create({
      data: validatedData as any,
    });
    res.status(201).json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      res.status(500).json({ error: 'Failed to create product' });
    }
  }
});

// Update product
app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const validatedData = productSchema.partial().parse(req.body);
    const product = await prisma.product.update({
      where: { id },
      data: validatedData as any,
    });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.product.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

const orderSchema = z.object({
  totalAmount: z.number().positive(),
  gstAmount: z.number().min(0),
  paymentMethod: z.string().min(1),
  customerName: z.string().optional().nullable(),
  customerMobile: z.string().optional().nullable(),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
  })),
});

// Create Order & Update Stock
app.post('/api/orders', async (req, res) => {
  try {
    const validatedData = orderSchema.parse(req.body);
    const { totalAmount, gstAmount, paymentMethod, customerName, customerMobile, items } = validatedData;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Generate sequential invoice number
      const orderCount = await tx.order.count();
      const invoiceNo = `INV-${(orderCount + 1).toString().padStart(4, '0')}`;

      // 2. Create the order
      const order = await tx.order.create({
        data: {
          invoiceNo,
          totalAmount,
          gstAmount,
          paymentMethod,
          customerName,
          customerMobile,
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // 3. Process each item
      for (const item of items) {
        // Fetch current stock to check availability
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }

        // Create order item
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          },
        });

        // Decrement stock
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      return order;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Order creation error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      res.status(500).json({ error: error.message || 'Failed to process order' });
    }
  }
});

// Get all orders (with advanced filtering & pagination)
app.get('/api/orders', async (req, res) => {
  try {
    const { search, startDate, endDate, methods, page = '1', limit = '50' } = req.query;
    console.log('Incoming Filters:', { search, startDate, endDate, methods, page, limit });
    
    const p = parseInt(String(page));
    const l = parseInt(String(limit));
    const skip = (p - 1) * l;

    const where: any = {};

    // 1. Text Search
    if (search) {
      where.OR = [
        { invoiceNo: { contains: String(search) } },
        { customerMobile: { contains: String(search) } },
        { customerName: { contains: String(search) } },
      ];
    }

    // 2. Date Range
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(String(startDate));
      }
      if (endDate) {
        const end = new Date(String(endDate));
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    // 3. Payment Methods
    if (methods) {
      const methodsArray = Array.isArray(methods) ? (methods as string[]) : [String(methods)];
      const cleanMethods = methodsArray.filter(m => m && m.trim() !== '');
      if (cleanMethods.length > 0) {
        where.paymentMethod = { in: cleanMethods };
      }
    }

    // Get total count for pagination metadata
    const totalCount = await prisma.order.count({ where });

    const orders = await prisma.order.findMany({
      where,
      skip,
      take: l,
      orderBy: { date: 'desc' },
      include: {
        _count: {
          select: { items: true }
        }
      }
    });

    res.json({
      orders,
      total: totalCount,
      page: p,
      limit: l,
      hasMore: skip + orders.length < totalCount
    });
  } catch (error) {
    console.error('Pagination API error:', error);
    res.status(500).json({ error: 'Failed to fetch partitioned orders' });
  }
});

// Get single order with full details
app.get('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

// Settings API
app.get('/api/settings', async (req, res) => {
  try {
    let settings = await prisma.storeSettings.findFirst();
    if (!settings) {
      settings = await prisma.storeSettings.create({
        data: {
          name: 'LOOMPOS',
          address: '123 Trend Avenue, Mumbai',
          gstin: '27AAAAA0000A1Z5',
          upiId: 'store@upi',
          phone: '+91 98765 43210',
        }
      });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const validatedData = settingsSchema.parse(req.body);
    const settings = await prisma.storeSettings.findFirst();
    
    let updated;
    if (settings) {
      updated = await prisma.storeSettings.update({
        where: { id: settings.id },
        data: validatedData,
      });
    } else {
      updated = await prisma.storeSettings.create({
        data: validatedData,
      });
    }
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
});


// Analytics: Today's Summary
app.get('/api/analytics/summary', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await prisma.order.aggregate({
      where: { date: { gte: today } },
      _sum: { totalAmount: true, gstAmount: true },
      _count: { id: true }
    });

    const paymentModes = await prisma.order.groupBy({
      by: ['paymentMethod'],
      where: { date: { gte: today } },
      _sum: { totalAmount: true }
    });

    res.json({
      revenue: stats._sum.totalAmount || 0,
      gst: stats._sum.gstAmount || 0,
      orders: stats._count.id || 0,
      paymentBreakdown: paymentModes
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Analytics: Last 7 Days Sales
app.get('/api/analytics/sales', async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: { date: { gte: sevenDaysAgo } },
      select: { date: true, totalAmount: true },
      orderBy: { date: 'asc' }
    });

    // Grouping by date
    const dailyData: Record<string, number> = {};
    orders.forEach(o => {
      const dateStr = o.date.toISOString().split('T')[0];
      dailyData[dateStr] = (dailyData[dateStr] || 0) + o.totalAmount;
    });

    const result = Object.entries(dailyData).map(([date, amount]) => ({
      date,
      amount
    })).sort((a, b) => a.date.localeCompare(b.date));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
