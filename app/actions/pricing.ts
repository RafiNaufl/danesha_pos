'use server'

import { prisma } from '@/app/lib/prisma'
import { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

export async function getCategoryByCode(code: string, tx?: Tx) {
  const db = tx || prisma
  const cat = await db.customerCategory.findUnique({ where: { code } })
  if (!cat) throw new Error('Category not found')
  return cat
}

export async function getDefaultCommissionPercent(tx?: Tx) {
  const db = tx || prisma
  const s = await db.settings.findUnique({ where: { id: 1 } })
  return new Prisma.Decimal(s?.commissionDefaultPercent ?? 10)
}

export async function getProductUnitPrice(productId: string, categoryId: string, tx?: Tx) {
  const db = tx || prisma
  const p = await db.productPrice.findUnique({ where: { productId_categoryId: { productId, categoryId } } })
  if (!p) throw new Error('Product price not found')
  return p.price
}

export async function getPriceByCategory(productId: string, categoryId: string, tx?: Tx) {
  return getProductUnitPrice(productId, categoryId, tx)
}

export async function getTreatmentPrice(treatmentId: string, tx?: Tx) {
  const db = tx || prisma
  const t = await db.treatment.findUnique({ where: { id: treatmentId } })
  if (!t) throw new Error('Treatment not found')
  return t.sellPrice
}


