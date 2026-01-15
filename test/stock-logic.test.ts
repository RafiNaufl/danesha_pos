
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { getProductStock, getAllProductStocks } from '@/app/actions/stock'
import { checkout } from '@/app/actions/checkout'

// Mock auth to return null so we can pass cashierId manually
vi.mock('@/app/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null)
}))

// Mock next/cache revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}))

const prisma = new PrismaClient()

describe('Stock Logic Integration Test', () => {
  let categoryId: string
  let productId: string
  let cashierId: string
  const categoryCode = 'TEST_CAT_STOCK'

  beforeAll(async () => {
    // 1. Setup Test Data
    const category = await prisma.customerCategory.upsert({
      where: { code: categoryCode },
      update: {},
      create: { code: categoryCode, name: 'Test Stock Category' }
    })
    categoryId = category.id

    const product = await prisma.product.create({
      data: {
        name: 'Test Stock Product Vitest',
        costPrice: 10000,
        unit: 'pcs',
        prices: {
          create: {
            categoryId: category.id,
            price: 15000
          }
        }
      }
    })
    productId = product.id

    const cashier = await prisma.user.upsert({
      where: { email: 'test-cashier-vitest@example.com' },
      update: {},
      create: {
        email: 'test-cashier-vitest@example.com',
        name: 'Test Cashier Vitest',
        role: 'KASIR'
      }
    })
    cashierId = cashier.id
  })

  afterAll(async () => {
    // Cleanup
    if (productId) {
      await prisma.stockMovement.deleteMany({ where: { productId } })
      await prisma.transactionItem.deleteMany({ where: { productId } })
      await prisma.productPrice.deleteMany({ where: { productId } }) // Delete prices first
      await prisma.product.delete({ where: { id: productId } })
    }
    // We leave category and user to avoid complex cleanup dependencies, or clean if needed
    await prisma.$disconnect()
  })

  it('should have 0 initial stock', async () => {
    const stock = await getProductStock(productId)
    expect(stock).toBe(0)
  })

  it('should increase stock on IN/ADJUST', async () => {
    // Manually create movement since adjustStock uses auth checks we might want to bypass or test separately
    // But since we mocked auth, we could try using adjustStock if we exported it. 
    // For now, manual insert is fine to test calculation.
    await prisma.stockMovement.create({
      data: {
        productId,
        type: 'ADJUST',
        quantity: 100,
        unitCost: 10000,
        note: 'Initial Stock Test',
        userId: cashierId
      }
    })

    const stock = await getProductStock(productId)
    expect(stock).toBe(100)
  })

  it('should decrease stock on checkout (SALE) and record movement', async () => {
    const checkoutInput = {
      checkoutSessionId: `test-session-${Date.now()}`,
      categoryCode: categoryCode,
      paymentMethod: 'CASH',
      paidAmount: 100000,
      items: [
        {
          type: 'PRODUCT' as const,
          productId: productId,
          qty: 5
        }
      ]
    }

    // Call checkout (mocked auth will be used inside, or cashierId passed as 2nd arg)
    const tx = await checkout(checkoutInput, cashierId)
    expect(tx).toBeDefined()
    expect(tx.items).toHaveLength(1)

    const stock = await getProductStock(productId)
    expect(stock).toBe(95) // 100 - 5

    // Verify StockMovement
    const movements = await prisma.stockMovement.findMany({
      where: { productId, type: 'SALE' }
    })
    expect(movements).toHaveLength(1)
    expect(movements[0].quantity).toBe(5)
    expect(Number(movements[0].unitCost)).toBe(10000) // Snapshot cost price
  })

  it('should correctly calculate bulk stock with getAllProductStocks', async () => {
    const stockMap = await getAllProductStocks()
    const stock = stockMap.get(productId)
    expect(stock).toBe(95)
  })

  it('should reject checkout if stock is insufficient', async () => {
    const checkoutInput = {
      checkoutSessionId: `test-session-fail-${Date.now()}`,
      categoryCode: categoryCode,
      paymentMethod: 'CASH',
      paidAmount: 100000,
      items: [
        {
          type: 'PRODUCT' as const,
          productId: productId,
          qty: 1000 // Request 1000, have 95
        }
      ]
    }

    await expect(checkout(checkoutInput, cashierId)).rejects.toThrow(/Stock tidak cukup/)
  })

  it('should reject checkout if product is inactive', async () => {
    // 1. Set product to inactive
    await prisma.product.update({
      where: { id: productId },
      data: { active: false }
    })

    const checkoutInput = {
      checkoutSessionId: `test-session-inactive-${Date.now()}`,
      categoryCode: categoryCode,
      paymentMethod: 'CASH',
      paidAmount: 100000,
      items: [
        {
          type: 'PRODUCT' as const,
          productId: productId,
          qty: 1
        }
      ]
    }

    // 2. Expect checkout to fail
    await expect(checkout(checkoutInput, cashierId)).rejects.toThrow(/sudah tidak aktif/)

    // 3. Restore active status (optional, but good practice)
    await prisma.product.update({
      where: { id: productId },
      data: { active: true }
    })
  })
})
