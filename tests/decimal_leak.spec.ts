
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

// Mock dependencies
vi.mock('next/navigation', () => ({
  redirect: vi.fn()
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}))

vi.mock('@/app/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'admin-id', name: 'Admin', role: 'ADMIN' }
  })
}))

// Mock Prisma using vi.hoisted to avoid reference errors
const prismaMock = vi.hoisted(() => ({
  customerCategory: { findMany: vi.fn(), findUnique: vi.fn() },
  member: { findMany: vi.fn() },
  therapist: { findMany: vi.fn(), findUnique: vi.fn() },
  transaction: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  transactionItem: { aggregate: vi.fn(), groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  therapistCommission: { 
        aggregate: vi.fn(() => Promise.resolve({ _sum: { amount: new Prisma.Decimal(0) } })), 
        findMany: vi.fn(() => Promise.resolve([])), 
        groupBy: vi.fn(() => Promise.resolve([])) 
      },
      product: { findMany: vi.fn(() => Promise.resolve([])), findUnique: vi.fn() },
      treatment: { findMany: vi.fn(() => Promise.resolve([])) },
      stockMovement: { 
        groupBy: vi.fn(() => Promise.resolve([])), 
        findMany: vi.fn(() => Promise.resolve([])), 
        count: vi.fn(() => Promise.resolve(0)) 
      },
  user: { findMany: vi.fn() },
  $transaction: vi.fn(async (args) => {
    if (Array.isArray(args)) return Promise.all(args)
    return Promise.resolve([])
  })
}))

vi.mock('@/app/lib/prisma', () => ({
  prisma: prismaMock
}))

// Mock getAllProductStocks
vi.mock('@/app/actions/stock', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    getAllProductStocks: vi.fn().mockResolvedValue(new Map([['p1', 10]]))
  }
})

// Import actions AFTER mocking
import { getReportOptions, getFinancialReport } from '@/app/actions/reports'
import { getStockReportSummary, getStockMovements } from '@/app/actions/stock'
import { getPosData } from '@/app/actions/pos-data'

function isDecimal(val: any): boolean {
  return val instanceof Prisma.Decimal || (typeof val === 'object' && val !== null && val.constructor?.name === 'Decimal')
}

function checkObjectForDecimals(obj: any, path: string = ''): string[] {
  const leaks: string[] = []
  
  if (!obj) return leaks
  
  if (isDecimal(obj)) {
    leaks.push(path)
    return leaks
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      leaks.push(...checkObjectForDecimals(item, `${path}[${index}]`))
    })
  } else if (typeof obj === 'object') {
    if (obj instanceof Date) return leaks
    
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        leaks.push(...checkObjectForDecimals(obj[key], `${path}.${key}`))
      }
    }
  }

  return leaks
}

describe('Decimal Leak Check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getReportOptions should not return Decimals', async () => {
    prismaMock.customerCategory.findMany.mockResolvedValue([{ id: 'c1', name: 'Cat1', code: 'C1' }])
    prismaMock.member.findMany.mockResolvedValue([{ id: 'm1', name: 'Mem1', memberCode: 'M1' }])
    prismaMock.therapist.findMany.mockResolvedValue([{ id: 't1', name: 'Ther1' }])
    prismaMock.transaction.findMany.mockResolvedValue([{ paymentMethod: 'CASH' }])

    const options = await getReportOptions()
    const leaks = checkObjectForDecimals(options, 'options')
    expect(leaks).toEqual([])
  })

  it('getFinancialReport should not return Decimals', async () => {
    // Mock aggregations returning Decimals
    prismaMock.transactionItem.aggregate.mockResolvedValue({
      _sum: {
        lineTotal: new Prisma.Decimal(100.50),
        lineDiscount: new Prisma.Decimal(10.00),
        profit: new Prisma.Decimal(50.25),
        qty: 5
      }
    })
    
    prismaMock.therapistCommission.findMany.mockResolvedValue([
      { amount: new Prisma.Decimal(5.50) }
    ])
    
    prismaMock.transaction.groupBy.mockResolvedValue([
      { paymentMethod: 'CASH', _count: { id: 10 }, _sum: { total: new Prisma.Decimal(1000.00) } }
    ])
    
    prismaMock.transactionItem.groupBy.mockResolvedValue([]) // simplify for now

    // Mock paginated data
    prismaMock.transactionItem.findMany.mockResolvedValue([]) // empty for now to focus on stats
    prismaMock.transactionItem.count.mockResolvedValue(0)
    
    // For getFinancialReport general mode
    prismaMock.transaction.findMany.mockResolvedValue([])
    prismaMock.transaction.count.mockResolvedValue(0)

    const report = await getFinancialReport({
      from: new Date(),
      to: new Date(),
      page: 1,
      limit: 10
    })
    
    const leaks = checkObjectForDecimals(report, 'report')
    expect(leaks).toEqual([])
  })

  it('getStockReportSummary should not return Decimals', async () => {
    prismaMock.product.findMany.mockResolvedValue([
      { 
        id: 'p1', 
        name: 'Prod1', 
        costPrice: new Prisma.Decimal(5000.00), 
        unit: 'pcs' 
      }
    ])

    const stockSummary = await getStockReportSummary()
    const leaks = checkObjectForDecimals(stockSummary, 'stockSummary')
    expect(leaks).toEqual([])
  })

  it('getStockMovements should not return Decimals', async () => {
    prismaMock.stockMovement.findMany.mockResolvedValue([
      {
        id: 'sm1',
        productId: 'p1',
        type: 'IN',
        quantity: 10,
        unitCost: new Prisma.Decimal(5000.00),
        createdAt: new Date(),
        product: { name: 'Prod1' },
        transaction: null,
        userId: 'u1'
      }
    ])
    prismaMock.stockMovement.count.mockResolvedValue(1)
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u1', name: 'User1' }])

    const stockMovements = await getStockMovements()
    const leaks = checkObjectForDecimals(stockMovements, 'stockMovements')
    expect(leaks).toEqual([])
  })

  it('getPosData should not return Decimals', async () => {
    prismaMock.product.findMany.mockResolvedValue([
      { 
        id: 'p1', 
        name: 'Prod1', 
        costPrice: new Prisma.Decimal(5000.00),
        active: true,
        prices: [{ id: 'pp1', price: new Prisma.Decimal(6000.00) }],
        discount: { 
          id: 'd1', 
          value: new Prisma.Decimal(10.00), 
          type: 'PERCENT',
          startDate: new Date(),
          endDate: new Date(),
          isActive: true,
          name: 'Disc1'
        }
      }
    ])
    prismaMock.treatment.findMany.mockResolvedValue([
      {
        id: 't1',
        name: 'Treat1',
        costPrice: new Prisma.Decimal(2000.00),
        sellPrice: new Prisma.Decimal(10000.00),
        active: true,
        discount: null
      }
    ])
    prismaMock.therapist.findMany.mockResolvedValue([
      {
        id: 'th1',
        name: 'Ther1',
        active: true,
        commissionPercent: new Prisma.Decimal(5.00),
        level: {
          id: 'l1',
          name: 'Level1',
          defaultCommission: new Prisma.Decimal(10.00),
          minCommission: new Prisma.Decimal(5.00),
          maxCommission: new Prisma.Decimal(20.00),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }
    ])
    prismaMock.customerCategory.findMany.mockResolvedValue([])

    const data = await getPosData()
    const leaks = checkObjectForDecimals(data, 'posData')
    expect(leaks).toEqual([])
  })
})
