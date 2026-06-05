import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database with realistic demo data...')

  // 1. Clear existing data
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.product.deleteMany()
  await prisma.user.deleteMany()
  await prisma.storeSettings.deleteMany()

  // 2. Create Store Settings
  await prisma.storeSettings.create({
    data: {
      id: '1',
      name: 'LOOMPOS Retail',
      address: 'Shop 42, Galleria Mall, Hiranandani, Mumbai - 400076',
      gstin: '27AAAAA0000A1Z5',
      upiId: 'loompos@pay',
      phone: '+91 98765 43210',
      cashierPassword: await bcrypt.hash('cashier123', 10)
    }
  })
  console.log('Store settings initialized.')

  // 3. Create Users
  const adminPassword = await bcrypt.hash('admin123', 10)
  const cashierPassword = await bcrypt.hash('cashier123', 10)

  const admin = await prisma.user.create({
    data: {
      employeeId: 'admin',
      name: 'Manish Patil',
      role: 'ADMIN',
      phone: '+91 99999 88888',
      password: adminPassword,
      isActive: true
    }
  })

  const cashier = await prisma.user.create({
    data: {
      employeeId: 'cashier',
      name: 'Rahul Verma',
      role: 'CASHIER',
      phone: '+91 88888 77777',
      password: cashierPassword,
      isActive: true
    }
  })
  console.log('Users created: Admin (admin / admin123), Cashier (cashier / cashier123)')

  // 4. Create Products
  const productsData = [
    { name: 'Slim Fit Indigo Jeans', sku: 'SKU-JEANS-01', barcode: '8901234001', category: 'Denim', size: '32', color: 'Indigo', costPrice: 999.0, sellingPrice: 2499.0, gst: 12.0, stock: 45, supplier: 'BlueStar Denim' },
    { name: 'Linen Casual Shirt White', sku: 'SKU-SHIRT-02', barcode: '8901234002', category: 'Apparel', size: 'M', color: 'White', costPrice: 650.0, sellingPrice: 1599.0, gst: 5.0, stock: 60, supplier: 'Classic Linen Co.' },
    { name: 'Cotton Chino Trousers Beige', sku: 'SKU-PANT-03', barcode: '8901234003', category: 'Trousers', size: '34', color: 'Beige', costPrice: 800.0, sellingPrice: 1899.0, gst: 12.0, stock: 35, supplier: 'TrendWear Ind.' },
    { name: 'Floral Summer Dress Pink', sku: 'SKU-DRESS-04', barcode: '8901234004', category: 'Dresses', size: 'S', color: 'Pink', costPrice: 1200.0, sellingPrice: 2999.0, gst: 12.0, stock: 25, supplier: 'Rose Garments' },
    { name: 'Oversized Cotton Tee Black', sku: 'SKU-TEE-05', barcode: '8901234005', category: 'T-Shirts', size: 'L', color: 'Black', costPrice: 350.0, sellingPrice: 999.0, gst: 5.0, stock: 80, supplier: 'TeeCorp India' },
    { name: 'Leather Dress Belt Brown', sku: 'SKU-ACC-06', barcode: '8901234006', category: 'Accessories', size: '34', color: 'Brown', costPrice: 450.0, sellingPrice: 1299.0, gst: 18.0, stock: 15, supplier: 'Apex Leather' },
    { name: 'Merino Wool Sweater Navy', sku: 'SKU-KNIT-07', barcode: '8901234007', category: 'Knitwear', size: 'XL', color: 'Navy', costPrice: 1500.0, sellingPrice: 3499.0, gst: 12.0, stock: 8, supplier: 'Himalayan Woollens' },
    { name: 'Athletic Running Shorts Grey', sku: 'SKU-SPORT-08', barcode: '8901234008', category: 'Activewear', size: 'M', color: 'Grey', costPrice: 400.0, sellingPrice: 999.0, gst: 5.0, stock: 50, supplier: 'Sportex Ltd' }
  ]

  const products = []
  for (const item of productsData) {
    const p = await prisma.product.create({ data: item })
    products.push(p)
  }
  console.log(`Created ${products.length} catalog products.`)

  // 5. Create Historical Orders for the last 7 days
  const paymentMethods = ['UPI', 'CASH', 'CARD']
  const customers = [
    { name: 'Amit Patel', mobile: '9876543210' },
    { name: 'Priya Sen', mobile: '9123456789' },
    { name: 'Vikram Singh', mobile: '9345678901' },
    { name: 'Neha Nair', mobile: '9456789012' },
    { name: 'Rohit Kulkarni', mobile: '9567890123' },
    { name: null, mobile: null }
  ]

  let orderCounter = 1

  // Loop over last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    // 2-4 orders per day
    const numOrders = Math.floor(Math.random() * 3) + 2

    for (let o = 0; o < numOrders; o++) {
      const orderDate = new Date(date)
      orderDate.setHours(Math.floor(Math.random() * 10) + 10, Math.floor(Math.random() * 60)) // Random daytime hour

      const cust = customers[Math.floor(Math.random() * customers.length)]
      const pm = paymentMethods[Math.floor(Math.random() * paymentMethods.length)]
      const processedUser = Math.random() > 0.3 ? cashier : admin

      // Select 1 to 3 random products
      const numProducts = Math.floor(Math.random() * 3) + 1
      const shuffledProducts = [...products].sort(() => 0.5 - Math.random())

      let subTotal = 0
      let gstTotal = 0

      const invoiceNo = `INV-${orderCounter.toString().padStart(4, '0')}`
      orderCounter++

      const orderItemsToCreate = []

      for (let pIdx = 0; pIdx < numProducts; pIdx++) {
        const prod = shuffledProducts[pIdx]
        const qty = Math.floor(Math.random() * 2) + 1
        const price = prod.sellingPrice

        const itemSub = price * qty
        const itemGst = (itemSub * prod.gst) / 100

        subTotal += itemSub
        gstTotal += itemGst

        orderItemsToCreate.push({
          productId: prod.id,
          quantity: qty,
          price: price
        })
      }

      await prisma.order.create({
        data: {
          id: `order-demo-${date.getTime()}-${orderCounter}`,
          invoiceNo,
          date: orderDate,
          totalAmount: subTotal + gstTotal,
          gstAmount: gstTotal,
          paymentMethod: pm,
          customerName: cust.name,
          customerMobile: cust.mobile,
          userId: processedUser.id,
          items: {
            create: orderItemsToCreate
          }
        }
      })
    }
  }

  console.log(`Seeded ${orderCounter - 1} sales invoices successfully.`)
  console.log('Database seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
