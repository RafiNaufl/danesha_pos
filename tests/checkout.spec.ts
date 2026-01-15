import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'

// In-memory store to simulate DB
const mem: any = {
  transactions: new Map<string, any>(),
  products: new Map<string, any>(),
  treatments: new Map<string, any>(),
  therapists: new Map<string, any>(),
  stockMovements: new Map<string, { qty: number }>(),
}

vi.mock('@/app/lib/auth', () => ({
  auth: async () => ({ user: { id: 'CASHIER' } })
}))

vi.mock('@/app/actions/pricing', () => ({
  getCategoryByCode: async (code: string) => ({ id: 'CAT', code }),
  getDefaultCommissionPercent: async () => new Prisma.Decimal(10),
  getProductUnitPrice: async (productId: string, categoryId: string) => new Prisma.Decimal(mem.products.get(productId)?.unitPrice ?? 0),
  getTreatmentPrice: async (treatmentId: string) => new Prisma.Decimal(mem.treatments.get(treatmentId)?.sellPrice ?? 0)
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
        const items = (data.items.create || []).map((i: any, idx: number) => ({
          id: `ITEM-${idx}`,
          ...i,
          product: i.productId ? { id: i.productId, name: mem.products.get(i.productId)?.name } : undefined,
          treatment: i.treatmentId ? { id: i.treatmentId, name: mem.treatments.get(i.treatmentId)?.name } : undefined,
          therapist: i.therapistId ? { id: i.therapistId, name: mem.therapists.get(i.therapistId)?.name } : undefined,
        }))
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
          items,
          changeAmount: data.changeAmount,
        }
        mem.transactions.set(data.checkoutSessionId, tx)
        return tx
      }
    },
    product: {
      findUnique: async ({ where: { id } }: any) => mem.products.get(id) || null
    },
    treatment: {
      findUnique: async ({ where: { id } }: any) => mem.treatments.get(id) || null
    },
    therapist: {
      findUnique: async ({ where: { id } }: any) => mem.therapists.get(id) || null
    },
    stockMovement: {
      findMany: async ({ where: { productId: { in: ids } } }: any) => {
        const res: any[] = []
        for (const id of ids) {
          const s = mem.stockMovements.get(id)?.qty || 0
          if (s > 0) res.push({ productId: id, type: 'IN', quantity: s })
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
      const cp = costPrice.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      const dv = discountValue.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      const subtotal = up.mul(q).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      let lineDiscount = new Prisma.Decimal(0)
      if (discountType === 'PERCENT') lineDiscount = subtotal.mul(dv).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      else if (discountType === 'NOMINAL') lineDiscount = dv
      if (lineDiscount.greaterThan(subtotal)) lineDiscount = subtotal
      const lineTotal = subtotal.sub(lineDiscount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      const costTotal = cp.mul(q).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      const profit = lineTotal.sub(costTotal).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      return { subtotal, lineDiscount, lineTotal, costTotal, profit }
    }
  }
})

import { checkout } from '../app/actions/checkout'

beforeEach(() => {
  mem.transactions.clear()
  mem.products.clear()
  mem.treatments.clear()
  mem.therapists.clear()
  mem.stockMovements.clear()
  mem.products.set('P1', { id: 'P1', name: 'Prod', costPrice: new Prisma.Decimal(50), unitPrice: 100 })
  mem.treatments.set('T1', { id: 'T1', name: 'Treat', costPrice: new Prisma.Decimal(80), sellPrice: 200 })
  mem.therapists.set('TH1', { id: 'TH1', name: 'Thera', active: true })
  mem.stockMovements.set('P1', { qty: 100 })
})

describe('Checkout idempotency', () => {
  it('returns same transaction for same checkoutSessionId', async () => {
    const sid = 'SID-1'
    const input = { categoryCode: 'PASIEN', paymentMethod: 'CASH', paidAmount: 1000, checkoutSessionId: sid, items: [{ type: 'PRODUCT', productId: 'P1', qty: 1 }] }
    const r1 = await checkout(input as any, 'CASHIER')
    const r2 = await checkout(input as any, 'CASHIER')
    expect(r1.id).toEqual(r2.id)
    expect(r1.number).toEqual(r2.number)
  })
})

describe('Discount validation', () => {
  it('rejects discount >= price', async () => {
    const sid = 'SID-2'
    const input = { categoryCode: 'PASIEN', paymentMethod: 'CASH', paidAmount: 1000, checkoutSessionId: sid, items: [{ type: 'PRODUCT', productId: 'P1', qty: 1, discountType: 'NOMINAL', discountValue: 100 }] }
    await expect(() => checkout(input as any, 'CASHIER')).rejects.toThrow('Invalid discount: exceeds or equals item price')
  })
})

describe('Therapist validation', () => {
  it('requires therapist for treatment', async () => {
    const sid = 'SID-3'
    const input = { categoryCode: 'PASIEN', paymentMethod: 'CASH', paidAmount: 1000, checkoutSessionId: sid, items: [{ type: 'TREATMENT', treatmentId: 'T1', qty: 1 }] }
    await expect(() => checkout(input as any, 'CASHIER')).rejects.toThrow('Therapist required for treatment')
  })

  it('rejects inactive therapist', async () => {
    mem.therapists.set('TH2', { id: 'TH2', name: 'Inactive', active: false })
    const sid = 'SID-4'
    const input = { categoryCode: 'PASIEN', paymentMethod: 'CASH', paidAmount: 1000, checkoutSessionId: sid, items: [{ type: 'TREATMENT', treatmentId: 'T1', therapistId: 'TH2', qty: 1 }] }
    await expect(() => checkout(input as any, 'CASHIER')).rejects.toThrow('Therapist sudah tidak aktif, silakan pilih ulang')
  })
})

describe('Commission computation', () => {
  it('commission is based on lineTotal after discount', async () => {
    const sid = 'SID-5'
    const input = { categoryCode: 'PASIEN', paymentMethod: 'CASH', paidAmount: 1000, checkoutSessionId: sid, items: [{ type: 'TREATMENT', treatmentId: 'T1', therapistId: 'TH1', qty: 1, discountType: 'NOMINAL', discountValue: 50 }] }
    const r = await checkout(input as any, 'CASHIER')
    // unit 200, discount 50 -> lineTotal 150; 10% commission => 15
    expect(Number(r.commissionTotal)).toBe(15)
  })
})

describe('Stock validation', () => {
  it('rejects if stock insufficient', async () => {
    mem.stockMovements.set('P1', { qty: 1 })
    const sid = 'SID-6'
    const input = { categoryCode: 'PASIEN', paymentMethod: 'CASH', paidAmount: 1000, checkoutSessionId: sid, items: [{ type: 'PRODUCT', productId: 'P1', qty: 2 }] }
    await expect(() => checkout(input as any, 'CASHIER')).rejects.toThrow('Stock tidak cukup')
  })

  it('rejects negative quantity', async () => {
    const sid = 'SID-7'
    const input = { categoryCode: 'PASIEN', paymentMethod: 'CASH', paidAmount: 1000, checkoutSessionId: sid, items: [{ type: 'PRODUCT', productId: 'P1', qty: -1 }] }
    await expect(() => checkout(input as any, 'CASHIER')).rejects.toThrow('Quantity must be positive')
  })
})
