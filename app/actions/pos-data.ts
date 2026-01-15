'use server'

import { prisma } from '@/app/lib/prisma'
import { getAllProductStocks } from '@/app/actions/stock'

// Force refresh
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
      orderBy: { name: 'asc' }
    }),
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

  return { 
    products: serializedProducts, 
    treatments: serializedTreatments, 
    therapists, 
    categories 
  }
}
