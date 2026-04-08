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

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(products);
  } catch (error) {
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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
