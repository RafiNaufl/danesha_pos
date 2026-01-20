
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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
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
  mem.treatments.set('T1', { id: 'T1', name: 'Treat', costPrice: new Prisma.Decimal(80), sellPrice: 200 })
})

describe('Commission Calculation Priorities', () => {
  it('uses therapist specific commission percent if present', async () => {
    // 20% commission
    mem.therapists.set('TH_CUSTOM', { 
      id: 'TH_CUSTOM', 
      name: 'Custom', 
      active: true, 
      commissionPercent: new Prisma.Decimal(20) 
    })
    
    const sid = 'SID-CUSTOM'
    const input = { 
      categoryCode: 'PASIEN', 
      paymentMethod: 'CASH', 
      paidAmount: 1000, 
      checkoutSessionId: sid, 
      items: [{ type: 'TREATMENT', treatmentId: 'T1', therapistId: 'TH_CUSTOM', qty: 1 }] 
    }
    const r = await checkout(input as any, 'CASHIER')
    // Price 200. Commission 20% = 40.
    expect(Number(r.commissionTotal)).toBe(40)
  })

  it('uses therapist level default commission if specific commission is missing', async () => {
    // Level commission 15%
    mem.therapists.set('TH_LEVEL', { 
      id: 'TH_LEVEL', 
      name: 'Level', 
      active: true, 
      level: { defaultCommission: new Prisma.Decimal(15) } 
    })
    
    const sid = 'SID-LEVEL'
    const input = { 
      categoryCode: 'PASIEN', 
      paymentMethod: 'CASH', 
      paidAmount: 1000, 
      checkoutSessionId: sid, 
      items: [{ type: 'TREATMENT', treatmentId: 'T1', therapistId: 'TH_LEVEL', qty: 1 }] 
    }
    const r = await checkout(input as any, 'CASHIER')
    // Price 200. Commission 15% = 30.
    expect(Number(r.commissionTotal)).toBe(30)
  })

  it('falls back to global default commission if neither therapist nor level commission is set', async () => {
    // Global default is mocked as 10%
    mem.therapists.set('TH_DEFAULT', { 
      id: 'TH_DEFAULT', 
      name: 'Default', 
      active: true 
    })
    
    const sid = 'SID-DEFAULT'
    const input = { 
      categoryCode: 'PASIEN', 
      paymentMethod: 'CASH', 
      paidAmount: 1000, 
      checkoutSessionId: sid, 
      items: [{ type: 'TREATMENT', treatmentId: 'T1', therapistId: 'TH_DEFAULT', qty: 1 }] 
    }
    const r = await checkout(input as any, 'CASHIER')
    // Price 200. Commission 10% = 20.
    expect(Number(r.commissionTotal)).toBe(20)
  })

  it('calculates commission correctly with mixed commission settings in one transaction', async () => {
    mem.therapists.set('TH_CUSTOM', { 
      id: 'TH_CUSTOM', 
      name: 'Custom', 
      active: true, 
      commissionPercent: new Prisma.Decimal(20) 
    })
    mem.therapists.set('TH_LEVEL', { 
      id: 'TH_LEVEL', 
      name: 'Level', 
      active: true, 
      level: { defaultCommission: new Prisma.Decimal(15) } 
    })

    const sid = 'SID-MIXED'
    const input = { 
      categoryCode: 'PASIEN', 
      paymentMethod: 'CASH', 
      paidAmount: 1000, 
      checkoutSessionId: sid, 
      items: [
        { type: 'TREATMENT', treatmentId: 'T1', therapistId: 'TH_CUSTOM', qty: 1 }, // 200 * 20% = 40
        { type: 'TREATMENT', treatmentId: 'T1', therapistId: 'TH_LEVEL', qty: 1 }   // 200 * 15% = 30
      ] 
    }
    const r = await checkout(input as any, 'CASHIER')
    // Total commission = 40 + 30 = 70
    expect(Number(r.commissionTotal)).toBe(70)
  })
})
