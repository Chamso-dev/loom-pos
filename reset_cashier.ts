import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const prisma = new PrismaClient()
async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10)
  await prisma.user.update({
    where: { employeeId: 'cash001' },
    data: { password: hashedPassword }
  })
  console.log('Cashier password reset to admin123')
}
main()
