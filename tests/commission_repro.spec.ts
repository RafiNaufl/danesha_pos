
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/app/lib/prisma'
import { checkout } from '@/app/actions/checkout'
import { getFinancialReport, getTherapistPerformanceReport } from '@/app/actions/reports'
import { auth } from '@/app/lib/auth'

// Mock auth
vi.mock('@/app/lib/auth', () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() }
}))

// Mock revalidatePath to avoid Next.js errors
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}))

describe('Commission Reproduction', () => {
  let categoryId: string
  let treatmentId: string
  let levelId: string
  let therapist1Id: string
  let therapist2Id: string
  let cashierId: string

  beforeAll(async () => {
    // Setup Data
    const category = await prisma.customerCategory.create({
      data: {
        code: 'TEST_CAT_' + Date.now(),
        name: 'Test Category'
      }
    })
    categoryId = category.id

    const treatment = await prisma.treatment.create({
      data: {
        name: 'Test Treatment',
        code: 'TR_' + Date.now(),
        duration: 60,
        costPrice: 50000,
        sellPrice: 100000,
        active: true,
        prices: {
          create: {
            categoryId: category.id,
            price: 100000
          }
        }
      }
    })
    treatmentId = treatment.id

    const level = await prisma.therapistLevel.create({
      data: {
        name: 'Test Level ' + Date.now(),
        defaultCommission: 10,
        minCommission: 5,
        maxCommission: 50
      }
    })
    levelId = level.id

    const therapist1 = await prisma.therapist.create({
      data: {
        name: 'Therapist 1 (Senior)',
        levelId: level.id,
        commissionPercent: 10,
        active: true
      }
    })
    therapist1Id = therapist1.id

    const therapist2 = await prisma.therapist.create({
      data: {
        name: 'Therapist 2 (Junior)',
        levelId: level.id,
        commissionPercent: 5,
        active: true
      }
    })
    therapist2Id = therapist2.id

    const cashier = await prisma.user.create({
      data: {
        email: 'test_cashier_' + Date.now() + '@example.com',
        name: 'Test Cashier',
        role: 'KASIR'
      }
    })
    cashierId = cashier.id
    
    // Update mock to return the real cashier
    vi.mocked(auth).mockResolvedValue({ user: { id: cashierId, name: 'Test Cashier' } } as any)
  }, 60000)

  it('should calculate and record commissions for both therapists', async () => {
    const checkoutSessionId = 'sess_' + Date.now()
    const category = await prisma.customerCategory.findUnique({ where: { id: categoryId } })

    const result = await checkout({
      checkoutSessionId,
      paymentMethod: 'CASH',
      paidAmount: 100000,
      categoryCode: category!.code,
      items: [
        {
          type: 'TREATMENT',
          treatmentId: treatmentId,
          therapistId: therapist1Id,
          assistantId: therapist2Id,
          qty: 1
        }
      ]
    }, cashierId)

    expect(result.number).toBeDefined()

    // Verify Database State
    const tx = await prisma.transaction.findFirst({
      where: { checkoutSessionId },
      include: {
        items: {
          include: {
            commission: true
          }
        }
      }
    })

    expect(tx).toBeDefined()
    const item = tx!.items[0]
    expect(item.commission).toHaveLength(2)
    
    // Check amounts
    // Price 100,000.
    // T1: 10% = 10,000
    // T2: 5% = 5,000
    const c1 = item.commission.find(c => c.therapistId === therapist1Id)
    const c2 = item.commission.find(c => c.therapistId === therapist2Id)

    expect(Number(c1?.amount)).toBe(10000)
    expect(Number(c2?.amount)).toBe(5000)

    // Verify Reports
    const filters = {
      from: new Date(new Date().setHours(0, 0, 0, 0)),
      to: new Date(new Date().setHours(23, 59, 59, 999)),
      page: 1,
      limit: 10
    }

    // Financial Report
    const financialReport = await getFinancialReport(filters)
    const reportItem = financialReport.data.find(d => d.number === tx!.number)
    
    expect(reportItem).toBeDefined()
    // Check commission display
    expect(Number(reportItem?.commission)).toBe(15000)

    // Therapist Performance Report
    const perfReport = await getTherapistPerformanceReport(filters)
    const t1Stats = perfReport.data.find(d => d.therapistId === therapist1Id)
    const t2Stats = perfReport.data.find(d => d.therapistId === therapist2Id)

    expect(t1Stats).toBeDefined()
    expect(t2Stats).toBeDefined()
    expect(Number(t1Stats?.commission)).toBe(10000)
    expect(Number(t2Stats?.commission)).toBe(5000)
  }, 60000)
})
