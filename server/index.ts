import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';


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

const userSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'CASHIER']),
  phone: z.string().optional().nullable(),
  password: z.string().min(6),
  isActive: z.boolean().optional(),
});

const loginSchema = z.object({
  employeeId: z.string().min(1),
  password: z.string().min(1),
});


const settingsSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  gstin: z.string().min(1),
  upiId: z.string().min(1),
  phone: z.string().min(1),
  cashierPassword: z.string().optional().nullable(),
});


// Auth & Users API
app.post('/api/auth/login', async (req, res) => {
  try {
    const { employeeId, password } = loginSchema.parse(req.body);
    
    // 1. Try individual password
    let user = await prisma.user.findFirst({
      where: { employeeId, password, isActive: true }
    });

    // 2. If not found, try global cashier password (only for cashiers)
    if (!user) {
      const settings = await prisma.storeSettings.findFirst();
      if (settings?.cashierPassword && password === settings.cashierPassword) {
        user = await prisma.user.findFirst({
          where: { employeeId, isActive: true, role: 'CASHIER' }
        });
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials or account deactivated' });
    }

    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    res.status(400).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { employeeId, currentPassword, newPassword } = z.object({
      employeeId: z.string(),
      currentPassword: z.string(),
      newPassword: z.string().min(4)
    }).parse(req.body);

    const user = await prisma.user.findFirst({
      where: { employeeId, password: currentPassword }
    });

    if (!user) {
      return res.status(401).json({ error: 'Current password verification failed' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: newPassword }
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(400).json({ error: 'Failed to change password' });
  }
});


app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(users.map(({ password, ...u }) => u));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});




app.post('/api/users', async (req, res) => {
  try {
    const validatedData = userSchema.parse(req.body);
    const user = await prisma.user.create({
      data: {
        ...validatedData,
        id: crypto.randomUUID(),
        updatedAt: new Date()
      }
    });

    res.status(201).json(user);

  } catch (error) {
    res.status(400).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const validatedData = userSchema.partial().parse(req.body);
    const user = await prisma.user.update({
      where: { id },
      data: validatedData
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.post('/api/users/:id/reveal-password', async (req, res) => {
  const { id } = req.params;
  try {
    const { adminEmployeeId, adminPassword } = z.object({
      adminEmployeeId: z.string(),
      adminPassword: z.string()
    }).parse(req.body);

    // 1. Authenticate the admin
    const admin = await prisma.user.findFirst({
      where: { 
        employeeId: adminEmployeeId, 
        password: adminPassword,
        role: 'ADMIN',
        isActive: true
      }
    });

    if (!admin) {
      return res.status(401).json({ error: 'Admin verification failed or unauthorized' });
    }

    // 2. Fetch the target user's password
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { password: true }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ password: targetUser.password });
  } catch (error) {
    res.status(400).json({ error: 'Failed to reveal password' });
  }
});

const initializeAdmin = async () => {
  const admin = await prisma.user.findUnique({ where: { employeeId: 'admin' } });
  if (!admin) {
    await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        employeeId: 'admin',
        name: 'System Admin',
        role: 'ADMIN',
        password: 'admin123',
        isActive: true,
        updatedAt: new Date()
      }

    });
    console.log('Default admin created: admin / admin123');
  }

};
initializeAdmin();



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
      data: {
        ...validatedData as any,
        id: crypto.randomUUID()
      },
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

// Low Stock Alerts API
app.get('/api/inventory/low-stock', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        stock: { lte: 10 }
      },
      orderBy: { stock: 'asc' },
      take: 10 // Show top 10 most urgent
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch alert products' });
  }
});


const orderSchema = z.object({
  totalAmount: z.number().positive(),
  gstAmount: z.number().min(0),
  paymentMethod: z.string().min(1),
  customerName: z.string().optional().nullable(),
  customerMobile: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
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
    const { totalAmount, gstAmount, paymentMethod, customerName, customerMobile, items, userId } = validatedData;


    const result = await prisma.$transaction(async (tx) => {
      // 1. Generate sequential invoice number
      const orderCount = await tx.order.count();
      const invoiceNo = `INV-${(orderCount + 1).toString().padStart(4, '0')}`;

      // 2. Create the order
      const order = await tx.order.create({
        data: {
          id: crypto.randomUUID(),
          invoiceNo,
          totalAmount,
          gstAmount,
          paymentMethod,
          customerName,
          customerMobile,
          userId,
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
            id: crypto.randomUUID(),
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

      // 4. Return the full order with its newly created items
      return await tx.order.findUnique({
        where: { id: order.id },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });
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
    // console.log('Incoming Filters:', { search, startDate, endDate, methods, page, limit });
    
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
        processedBy: {
          select: { name: true, employeeId: true, isActive: true }
        },
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
        processedBy: {
          select: { name: true, employeeId: true, isActive: true }
        },
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
          id: '1',
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
        data: { 
          ...validatedData, 
          id: '1',
          updatedAt: new Date()
        },
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
