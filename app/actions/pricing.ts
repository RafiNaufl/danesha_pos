'use server'

import { prisma } from '@/app/lib/prisma'
import { Prisma } from '@prisma/client'

export async function getCategoryByCode(code: string) {
  const cat = await prisma.customerCategory.findUnique({ where: { code } })
  if (!cat) throw new Error('Category not found')
  return cat
}

export async function getDefaultCommissionPercent() {
  const s = await prisma.settings.findUnique({ where: { id: 1 } })
  return new Prisma.Decimal(s?.commissionDefaultPercent ?? 10)
}

export async function getProductUnitPrice(productId: string, categoryId: string) {
  const p = await prisma.productPrice.findUnique({ where: { productId_categoryId: { productId, categoryId } } })
  if (!p) throw new Error('Product price not found')
  return p.price
}

export async function getPriceByCategory(productId: string, categoryId: string) {
  return getProductUnitPrice(productId, categoryId)
}

export async function getTreatmentPrice(treatmentId: string) {
  const t = await prisma.treatment.findUnique({ where: { id: treatmentId } })
  if (!t) throw new Error('Treatment not found')
  return t.sellPrice
}


