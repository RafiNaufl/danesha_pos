
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { upsertTherapist } from '../app/actions/admin/therapists'
import { Prisma } from '@prisma/client'

// Mocks
const mockLevels = new Map<string, any>()

vi.mock('@/app/lib/prisma', () => ({
  prisma: {
    therapistLevel: {
      findUnique: async ({ where: { id } }: any) => mockLevels.get(id) || null
    },
    therapist: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    }
  }
}))

vi.mock('@/app/lib/admin-auth', () => ({
  requireAdmin: async () => true
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}))

describe('Therapist Validation', () => {
  beforeEach(() => {
    mockLevels.clear()
    // Setup levels
    mockLevels.set('SENIOR', {
      id: 'SENIOR',
      name: 'Senior',
      minCommission: new Prisma.Decimal(5),
      maxCommission: new Prisma.Decimal(50)
    })
    mockLevels.set('JUNIOR', {
      id: 'JUNIOR',
      name: 'Junior',
      minCommission: new Prisma.Decimal(3),
      maxCommission: new Prisma.Decimal(30)
    })
  })

  it('allows valid commission for Senior', async () => {
    await expect(upsertTherapist({
      name: 'Test Senior',
      levelId: 'SENIOR',
      commissionPercent: 10
    })).resolves.not.toThrow()
  })

  it('rejects commission below min for Senior', async () => {
    await expect(upsertTherapist({
      name: 'Test Senior Low',
      levelId: 'SENIOR',
      commissionPercent: 4
    })).rejects.toThrow('Komisi untuk level Senior harus antara 5% - 50%')
  })

  it('rejects commission above max for Senior', async () => {
    await expect(upsertTherapist({
      name: 'Test Senior High',
      levelId: 'SENIOR',
      commissionPercent: 51
    })).rejects.toThrow('Komisi untuk level Senior harus antara 5% - 50%')
  })

  it('allows valid commission for Junior', async () => {
    await expect(upsertTherapist({
      name: 'Test Junior',
      levelId: 'JUNIOR',
      commissionPercent: 5
    })).resolves.not.toThrow()
  })

  it('rejects commission below min for Junior', async () => {
    await expect(upsertTherapist({
      name: 'Test Junior Low',
      levelId: 'JUNIOR',
      commissionPercent: 2
    })).rejects.toThrow('Komisi untuk level Junior harus antara 3% - 30%')
  })

  it('rejects commission above max for Junior', async () => {
    await expect(upsertTherapist({
      name: 'Test Junior High',
      levelId: 'JUNIOR',
      commissionPercent: 31
    })).rejects.toThrow('Komisi untuk level Junior harus antara 3% - 30%')
  })

  it('allows therapist without level', async () => {
    await expect(upsertTherapist({
      name: 'Test No Level',
      commissionPercent: 10
    })).resolves.not.toThrow()
  })
})
