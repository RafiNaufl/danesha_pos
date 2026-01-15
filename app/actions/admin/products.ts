'use server'

import { prisma } from "@/app/lib/prisma"
import { requireAdmin } from "@/app/lib/admin-auth"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { getAllProductStocks } from "@/app/actions/stock"

const ProductSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  costPrice: z.coerce.number().min(0),
  active: z.boolean().default(true),
  prices: z.array(z.object({
    categoryId: z.string(),
    price: z.coerce.number().min(0)
  }))
})

export async function getProducts(query?: string) {
  await requireAdmin()
  const where: Prisma.ProductWhereInput = query ? {
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
    ]
  } : {}

  const products = await prisma.product.findMany({
    where,
    include: { prices: true },
    orderBy: { name: 'asc' }
  })

  const stocks = await getAllProductStocks()

  return products.map(p => ({
    ...p,
    costPrice: p.costPrice.toNumber(),
    prices: p.prices.map(pr => ({ ...pr, price: pr.price.toNumber() })),
    stock: stocks.get(p.id) || 0
  }))
}

export async function upsertProduct(data: z.infer<typeof ProductSchema>) {
  await requireAdmin()
  const val = ProductSchema.safeParse(data)
  if (!val.success) throw new Error(val.error.errors[0].message)
  
  const { id, name, costPrice, active, prices } = val.data

  if (id) {
    // Update
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          name,
          costPrice,
          active,
        }
      })

      // Upsert prices
      for (const p of prices) {
        await tx.productPrice.upsert({
          where: { productId_categoryId: { productId: id, categoryId: p.categoryId } },
          create: { productId: id, categoryId: p.categoryId, price: p.price },
          update: { price: p.price }
        })
      }
    })
  } else {
    // Create
    await prisma.product.create({
      data: {
        name,
        costPrice,
        active,
        prices: {
          create: prices.map(p => ({
            categoryId: p.categoryId,
            price: p.price
          }))
        }
      }
    })
  }

  revalidatePath('/products')
  revalidatePath('/dashboard') // Update POS cache too
}

export async function deleteProduct(id: string) {
  await requireAdmin()
  // Check if used in transactions? 
  // "perubahan tak ubah transaksi lama" - Transactions reference product details or just ID?
  // TransactionItem references Product (optional relation). If we delete, it might set null or fail depending on FK.
  // Ideally soft delete. Schema has `active` field. The prompt says CRUD.
  // I'll implement soft delete by setting active = false, but if the user explicitly asks for delete...
  // Usually for POS, we just deactivate. But let's see.
  // Schema: `items TransactionItem[]`. If there are items, we can't delete physically easily without cascade or set null.
  // I'll use active = false as "Delete" in UI, or actually delete if no relations.
  
  try {
    await prisma.product.delete({ where: { id } })
  } catch (e) {
    // If failed (likely due to foreign key), set active false
    await prisma.product.update({ where: { id }, data: { active: false } })
  }
  revalidatePath('/products')
  revalidatePath('/dashboard')
}
