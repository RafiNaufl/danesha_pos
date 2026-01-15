import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { checkout } from '../app/actions/checkout'

// In-memory store to simulate DB
const mem: any = {
  transactions: new Map<string, any>(),
  products: new Map<string, any>(),
}

vi.mock('@/app/lib/auth', () => ({
  auth: async () => ({ user: { id: 'CASHIER' } })
}))

vi.mock('@/app/actions/pricing', () => ({
  getCategoryByCode: async (code: string) => ({ id: 'CAT', code }),
  getDefaultCommissionPercent: async () => new Prisma.Decimal(10),
  getProductUnitPrice: async (productId: string, categoryId: string) => new Prisma.Decimal(mem.products.get(productId)?.unitPrice ?? 0),
  getTreatmentPrice: async (treatmentId: string) => new Prisma.Decimal(0)
}))

vi.mock('@/app/lib/prisma', () => {
  const findTxBySession = (sid: string) => mem.transactions.get(sid) || null
  const prismaMock = {
    member: { findUnique: async ({ where: { memberCode } }: any) => null },
    customerCategory: { findUnique: async ({ where: { id } }: any) => ({ id, code: 'PASIEN' }) },
    transaction: {
      findUnique: async ({ where: { checkoutSessionId } }: any) => findTxBySession(checkoutSessionId),
      create: async ({ data, include }: any) => {
        if (mem.transactions.has(data.checkoutSessionId)) {
          const e: any = new Error('Unique constraint failed')
          e.code = 'P2002'
          throw e
        }
        const tx = {
          id: 'TX1',
          number: data.number,
          checkoutSessionId: data.checkoutSessionId,
          createdAt: new Date(),
          subtotal: data.subtotal,
          discountTotal: data.discountTotal,
          total: data.total,
          costTotal: data.costTotal,
          profitTotal: data.profitTotal,
          commissionTotal: data.commissionTotal,
          category: { id: data.categoryId, code: 'PASIEN' },
          member: null,
          paymentMethod: data.paymentMethod, // CAPTURE PAYMENT METHOD
          paidAmount: data.paidAmount,
          changeAmount: data.changeAmount,
          items: [],
        }
        mem.transactions.set(data.checkoutSessionId, tx)
        return tx
      }
    },
    product: {
      findUnique: async ({ where: { id } }: any) => mem.products.get(id) || null
    },
    treatment: {
      findUnique: async ({ where: { id } }: any) => null
    },
    therapist: {
      findUnique: async ({ where: { id } }: any) => null
    },
    stockMovement: {
      findMany: async ({ where: { productId: { in: ids } } }: any) => {
        const res: any[] = []
        for (const id of ids) {
          // Assume always enough stock for this test
          res.push({ productId: id, type: 'IN', quantity: 100 })
        }
        return res
      },
      create: async () => {}
    },
    $transaction: async (fn: any) => fn({
      ...prismaMock,
      $executeRaw: async () => {}
    }),
    checkoutFailure: { create: async () => {} },
  }
  return { prisma: prismaMock }
})

vi.mock('@/app/lib/calculations', () => {
  return {
    calcLineTotals: (unitPrice: Prisma.Decimal, qty: number, discountType: any, discountValue: Prisma.Decimal, costPrice: Prisma.Decimal) => {
      const q = new Prisma.Decimal(qty)
      const up = unitPrice.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      const subtotal = up.mul(q).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      return {
        subtotal: subtotal,
        lineDiscount: new Prisma.Decimal(0),
        lineTotal: subtotal,
        costTotal: new Prisma.Decimal(0),
        profit: new Prisma.Decimal(0),
      }
    },
    calcTransactionTotals: (items: any[]) => {
      const total = items.reduce((acc, i) => acc.add(i.lineTotal), new Prisma.Decimal(0))
      return {
        subtotal: total,
        discountTotal: new Prisma.Decimal(0),
        total: total,
        costTotal: new Prisma.Decimal(0),
        profitTotal: new Prisma.Decimal(0),
        commissionTotal: new Prisma.Decimal(0),
      }
    }
  }
})

describe('QRIS Payment Integration', () => {
  beforeEach(() => {
    mem.transactions.clear()
    mem.products.clear()
    // Setup a product
    mem.products.set('P1', { id: 'P1', name: 'Product 1', unitPrice: 10000, costPrice: 5000 })
  })

  it('should accept QRIS as a valid payment method', async () => {
    const sid = 'SID-QRIS-1'
    const input = {
      categoryCode: 'PASIEN',
      paymentMethod: 'QRIS',
      paidAmount: 10000,
      checkoutSessionId: sid,
      items: [
        { type: 'PRODUCT', productId: 'P1', qty: 1 }
      ]
    }

    const result = await checkout(input as any, 'CASHIER')
    
    expect(result.id).toBeDefined()
    expect(result.number).toBeDefined()
  })

  it('should persist QRIS payment method in the database', async () => {
    const sid = 'SID-QRIS-2'
    const input = {
      categoryCode: 'PASIEN',
      paymentMethod: 'QRIS',
      paidAmount: 10000,
      checkoutSessionId: sid,
      items: [
        { type: 'PRODUCT', productId: 'P1', qty: 1 }
      ]
    }

    await checkout(input as any, 'CASHIER')
    
    // Check "database"
    const tx = mem.transactions.get(sid)
    expect(tx).toBeDefined()
    expect(tx.paymentMethod).toBe('QRIS')
  })
})
