'use server'

import { prisma } from "@/app/lib/prisma"
import { requireAdmin } from "@/app/lib/admin-auth"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { DiscountType } from "@prisma/client"
import { auth } from "@/app/lib/auth"

const DiscountSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.nativeEnum(DiscountType),
  value: z.coerce.number().min(0, "Value must be positive"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isActive: z.boolean().default(true),
  productIds: z.array(z.string()).default([]),
  treatmentIds: z.array(z.string()).default([]),
})

export async function getDiscounts() {
  await requireAdmin()
  const discounts = await prisma.discount.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { products: true, treatments: true }
      }
    }
  })
  return discounts.map(d => ({
    ...d,
    value: d.value.toNumber()
  }))
}

export async function getDiscount(id: string) {
  await requireAdmin()
  const discount = await prisma.discount.findUnique({
    where: { id },
    include: {
      products: { select: { id: true, name: true } },
      treatments: { select: { id: true, name: true } }
    }
  })
  if (!discount) return null
  return {
    ...discount,
    value: discount.value.toNumber()
  }
}

export async function upsertDiscount(data: z.infer<typeof DiscountSchema>) {
  const session = await requireAdmin()
  
  const val = DiscountSchema.safeParse(data)
  if (!val.success) throw new Error(val.error.errors[0].message)

  const { id, name, description, type, value, startDate, endDate, isActive, productIds, treatmentIds } = val.data

  // Validate dates
  if (endDate < startDate) {
    throw new Error("End date cannot be before start date")
  }

  // Validate overlapping discounts
  const overlappingDiscounts = await prisma.discount.findMany({
    where: {
      isActive: true,
      ...(id ? { id: { not: id } } : {}),
      AND: [
        {
          OR: [
            { products: { some: { id: { in: productIds } } } },
            { treatments: { some: { id: { in: treatmentIds } } } }
          ]
        },
        {
          startDate: { lte: endDate },
          endDate: { gte: startDate }
        }
      ]
    },
    select: { name: true }
  })

  if (overlappingDiscounts.length > 0) {
    const names = overlappingDiscounts.map(d => d.name).join(", ")
    throw new Error(`Periode diskon bertabrakan dengan diskon aktif lain: ${names}`)
  }

  // Transaction to update discount and relations
  await prisma.$transaction(async (tx) => {
    let discountId = id

    if (discountId) {
      // Update existing
      await tx.discount.update({
        where: { id: discountId },
        data: {
          name,
          description,
          type,
          value,
          startDate,
          endDate,
          isActive,
          // Reset relations first (disconnect all) - simple strategy: set them
          products: {
            set: productIds.map(pid => ({ id: pid }))
          },
          treatments: {
            set: treatmentIds.map(tid => ({ id: tid }))
          }
        }
      })

      // Audit Log
      await tx.auditLog.create({
        data: {
          action: "UPDATE_DISCOUNT",
          details: `Updated discount ${name}`,
          userId: session.user.id,
          userName: session.user.name
        }
      })

    } else {
      // Create new
      const newDiscount = await tx.discount.create({
        data: {
          name,
          description,
          type,
          value,
          startDate,
          endDate,
          isActive,
          products: {
            connect: productIds.map(pid => ({ id: pid }))
          },
          treatments: {
            connect: treatmentIds.map(tid => ({ id: tid }))
          }
        }
      })
      discountId = newDiscount.id

      // Audit Log
      await tx.auditLog.create({
        data: {
          action: "CREATE_DISCOUNT",
          details: `Created discount ${name}`,
          userId: session.user.id,
          userName: session.user.name
        }
      })
    }
  })

  revalidatePath('/dashboard/discounts')
}

export async function deleteDiscount(id: string) {
  const session = await requireAdmin()
  
  await prisma.$transaction(async (tx) => {
     const discount = await tx.discount.findUnique({ where: { id } })
     if (!discount) throw new Error("Discount not found")

     await tx.discount.delete({ where: { id } })

     // Audit Log
     await tx.auditLog.create({
        data: {
          action: "DELETE_DISCOUNT",
          details: `Deleted discount ${discount.name}`,
          userId: session.user.id,
          userName: session.user.name
        }
      })
  })
  
  revalidatePath('/dashboard/discounts')
}

export async function toggleDiscountStatus(id: string, isActive: boolean) {
  const session = await requireAdmin()
  
  await prisma.discount.update({
    where: { id },
    data: { isActive }
  })
  
  await prisma.auditLog.create({
    data: {
      action: "TOGGLE_DISCOUNT",
      details: `Set discount ${id} status to ${isActive}`,
      userId: session.user.id,
      userName: session.user.name
    }
  })

  revalidatePath('/dashboard/discounts')
}
