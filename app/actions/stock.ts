'use server'

import { prisma } from '@/app/lib/prisma'
import { StockMovementType } from '@prisma/client'
import { requireAdmin } from '@/app/lib/admin-auth'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

// --- Stock Calculation Logic ---

/**
 * Calculates stock for a single product.
 * Formula: (IN + ADJUST) - (OUT + SALE)
 */
export async function getProductStock(productId: string) {
  const movements = await prisma.stockMovement.groupBy({
    by: ['type'],
    where: { productId },
    _sum: { quantity: true }
  })

  let stock = 0
  for (const m of movements) {
    const qty = m._sum.quantity || 0
    if (m.type === 'IN' || m.type === 'ADJUST') {
      stock += qty
    } else if (m.type === 'OUT' || m.type === 'SALE') {
      stock -= qty
    }
  }
  return stock
}

/**
 * Calculates stock for all products efficiently.
 * Returns a Map of productId -> stock
 */
export async function getAllProductStocks() {
  const movements = await prisma.stockMovement.groupBy({
    by: ['productId', 'type'],
    _sum: { quantity: true }
  })

  const stockMap = new Map<string, number>()

  for (const m of movements) {
    if (!m.productId) continue
    
    const qty = m._sum.quantity || 0
    const current = stockMap.get(m.productId) || 0
    
    if (m.type === 'IN' || m.type === 'ADJUST') {
      stockMap.set(m.productId, current + qty)
    } else if (m.type === 'OUT' || m.type === 'SALE') {
      stockMap.set(m.productId, current - qty)
    }
  }

  return stockMap
}


// --- Stock Adjustment ---

const AdjustStockSchema = z.object({
  productId: z.string(),
  quantity: z.coerce.number().int(), // Can be positive or negative
  note: z.string().min(1, "Catatan wajib diisi"),
})

export async function adjustStock(data: z.infer<typeof AdjustStockSchema>) {
  const session = await requireAdmin()
  const val = AdjustStockSchema.safeParse(data)
  if (!val.success) throw new Error(val.error.errors[0].message)

  const { productId, quantity, note } = val.data

  if (quantity === 0) throw new Error("Quantity cannot be 0")

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) throw new Error("Product not found")

  await prisma.$transaction(async (tx) => {
    // Create Stock Movement
    await tx.stockMovement.create({
      data: {
        productId,
        type: 'ADJUST',
        quantity: quantity, // Positive or Negative
        unitCost: product.costPrice, // Snapshot current cost price
        note: note,
        userId: session.user.id
      } as any
    })
    
    // Audit Log
    await tx.auditLog.create({
      data: {
        action: "STOCK_ADJUSTMENT",
        details: `Adjusted stock for ${product.name} by ${quantity}. Note: ${note}`,
        userId: session.user.id,
        userName: session.user.name
      }
    })
  })

  revalidatePath('/dashboard/products')
  revalidatePath('/dashboard/reports')
}

// --- Stock Reports ---

export type StockReportFilter = {
  productId?: string
  startDate?: Date
  endDate?: Date
  type?: StockMovementType
}

export async function getStockReportSummary() {
  await requireAdmin()
  
  // 1. Get all stocks
  const stockMap = await getAllProductStocks()
  
  // 2. Get all products with their cost price
  const products = await prisma.product.findMany({
    select: { id: true, name: true, costPrice: true, unit: true }
  })

  let totalSKU = 0
  let totalItems = 0
  let totalValue = 0
  
  const productStocks = products.map(p => {
    const stock = stockMap.get(p.id) || 0
    const value = Number(p.costPrice) * stock
    
    if (stock > 0) {
      totalItems += stock
      totalValue += value
    }
    totalSKU++

    return {
      ...p,
      stock,
      value,
      costPrice: Number(p.costPrice), // Convert Decimal to Number
      status: stock <= 0 ? 'Habis' : stock <= 10 ? 'Menipis' : 'Aman'
    }
  })

  return {
    summary: {
      totalSKU,
      totalItems,
      totalValue
    },
    products: productStocks.sort((a, b) => a.stock - b.stock) // Sort by stock ascending (low stock first)
  }
}

export async function getStockMovements(page: number = 1, limit: number = 20, filters?: StockReportFilter) {
  await requireAdmin()
  
  const where: any = {}
  
  if (filters?.productId && filters.productId !== 'all') {
    where.productId = filters.productId
  }
  
  if (filters?.type && filters.type !== ('all' as any)) {
    where.type = filters.type
  }
  
  if (filters?.startDate && filters?.endDate) {
    where.createdAt = {
      gte: filters.startDate,
      lte: filters.endDate
    }
  }

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { name: true } },
        transaction: { select: { number: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.stockMovement.count({ where })
  ])

  // Fetch users manually if userId exists (since relation might be missing in Prisma Client)
  const userIds = Array.from(new Set(movements.map(m => m.userId).filter(Boolean))) as string[]
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true }
  })
  const userMap = new Map(users.map(u => [u.id, u.name]))

  return {
    data: movements.map(m => ({
        ...m,
        unitCost: Number(m.unitCost),
        user: m.userId ? { name: userMap.get(m.userId) || 'Unknown' } : null
    })),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  }
}
