/**
 * Prepares a fresh LoomPOS database: one admin, one cashier and empty store settings.
 * It adds no products or sales; enter your own catalogue from the Inventory or
 * Purchases screens. Safe to run twice: existing accounts and settings are kept.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const settings = await prisma.storeSettings.findFirst()
  if (!settings) {
    await prisma.storeSettings.create({
      data: {
        id: '1',
        name: 'LoomPOS',
        currency: 'DZD',
        language: 'ar',
        defaultPaymentMethod: 'CASH',
        receiptWidth: 80,
        cashierPassword: await bcrypt.hash('cashier123', 10),
      },
    })
    console.log('Store settings created. Fill in the name, address, phone, NIF and RC under Settings.')
  }

  const accounts = [
    { employeeId: 'admin', name: 'Admin', role: 'ADMIN', password: 'admin123' },
    { employeeId: 'cashier', name: 'Caissier', role: 'CASHIER', password: 'cashier123' },
  ] as const

  for (const a of accounts) {
    const existing = await prisma.user.findUnique({ where: { employeeId: a.employeeId } })
    if (existing) continue
    await prisma.user.create({
      data: { employeeId: a.employeeId, name: a.name, role: a.role, password: await bcrypt.hash(a.password, 10), isActive: true },
    })
    console.log(`Created ${a.role.toLowerCase()} account: ${a.employeeId} / ${a.password}. Change this password after the first login.`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
