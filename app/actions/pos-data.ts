'use server'

import { prisma } from '@/app/lib/prisma'
import { getAllProductStocks } from '@/app/actions/stock'
import { Prisma } from '@prisma/client'

// Explicitly define the Therapist type to avoid linter resolution issues
interface RawTherapist {
  id: string
  name: string
  phone: string | null
  active: boolean
  levelId: string | null
  level: { 
    id: string
    name: string
    defaultCommission: Prisma.Decimal
    minCommission: Prisma.Decimal
    maxCommission: Prisma.Decimal
    createdAt: Date
    updatedAt: Date
  } | null
  commissionPercent: Prisma.Decimal | null
  createdAt: Date
  updatedAt: Date
}

// Force refresh
export async function getPosData() {
  const [products, treatments, therapists, categories, stockMap] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      include: { prices: true, discount: true },
      orderBy: { name: 'asc' }
    }),
    prisma.treatment.findMany({
      where: { active: true },
      include: { discount: true },
      orderBy: { name: 'asc' }
    }),
    prisma.therapist.findMany({
      where: { active: true },
      // @ts-ignore: Prisma client type generation issue with relation
      include: { level: true },
      orderBy: { name: 'asc' }
    }) as unknown as RawTherapist[],
    prisma.customerCategory.findMany({
      orderBy: { name: 'asc' }
    }),
    getAllProductStocks()
  ])

  const serializedProducts = products.map(p => ({
    ...p,
    costPrice: p.costPrice.toNumber(),
    stock: stockMap.get(p.id) || 0,
    prices: p.prices.map(pr => ({ ...pr, price: pr.price.toNumber() })),
    discount: p.discount ? {
      id: p.discount.id,
      name: p.discount.name,
      type: p.discount.type,
      value: p.discount.value.toNumber(),
      startDate: p.discount.startDate,
      endDate: p.discount.endDate,
      isActive: p.discount.isActive
    } : null
  }))

  const serializedTreatments = treatments.map(t => ({
    ...t,
    costPrice: t.costPrice.toNumber(),
    sellPrice: t.sellPrice.toNumber(),
    discount: t.discount ? {
      id: t.discount.id,
      name: t.discount.name,
      type: t.discount.type,
      value: t.discount.value.toNumber(),
      startDate: t.discount.startDate,
      endDate: t.discount.endDate,
      isActive: t.discount.isActive
    } : null
  }))

  const serializedTherapists = therapists.map(t => ({
    ...t,
    commissionPercent: t.commissionPercent ? t.commissionPercent.toNumber() : null,
    level: t.level ? {
      id: t.level.id,
      name: t.level.name,
      defaultCommission: t.level.defaultCommission.toNumber(),
      minCommission: t.level.minCommission.toNumber(),
      maxCommission: t.level.maxCommission.toNumber(),
      createdAt: t.level.createdAt,
      updatedAt: t.level.updatedAt
    } : null
  }))

  return { 
    products: serializedProducts, 
    treatments: serializedTreatments, 
    therapists: serializedTherapists, 
    categories 
  }
}
