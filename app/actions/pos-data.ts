'use server'

import { prisma } from '@/app/lib/prisma'
import { getAllProductStocks } from '@/app/actions/stock'

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
      ...p.discount,
      value: p.discount.value.toNumber()
    } : null
  }))

  const serializedTreatments = treatments.map(t => ({
    ...t,
    costPrice: t.costPrice.toNumber(),
    sellPrice: t.sellPrice.toNumber(),
    discount: t.discount ? {
      ...t.discount,
      value: t.discount.value.toNumber()
    } : null
  }))

  return { 
    products: serializedProducts, 
    treatments: serializedTreatments, 
    therapists, 
    categories 
  }
}
