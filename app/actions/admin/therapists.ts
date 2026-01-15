'use server'

import { prisma } from '@/app/lib/prisma'
import { requireAdmin } from '@/app/lib/admin-auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const TherapistSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  active: z.boolean().default(true),
})

export async function getTherapists() {
  await requireAdmin()
  return prisma.therapist.findMany({
    orderBy: { name: 'asc' }
  })
}

export async function upsertTherapist(data: z.infer<typeof TherapistSchema>) {
  await requireAdmin()
  const val = TherapistSchema.safeParse(data)
  if (!val.success) throw new Error(val.error.errors[0].message)

  const { id, name, phone, active } = val.data

  if (id) {
    await prisma.therapist.update({
      where: { id },
      data: { name, phone, active }
    })
  } else {
    await prisma.therapist.create({
      data: { name, phone, active }
    })
  }
  revalidatePath('/therapists')
}

export async function deleteTherapist(id: string) {
  await requireAdmin()
  // Check commissions or items
  const count = await prisma.transactionItem.count({ where: { therapistId: id } })
  if (count > 0) {
    await prisma.therapist.update({
      where: { id },
      data: { active: false }
    })
    revalidatePath('/therapists')
    return { success: true, message: "Therapist deactivated (has history)" }
  } else {
    await prisma.therapist.delete({ where: { id } })
    revalidatePath('/therapists')
    return { success: true, message: "Therapist deleted" }
  }
}

export async function getTherapistCommissions(therapistId: string, startDate?: Date, endDate?: Date) {
  await requireAdmin()
  
  const where: any = { therapistId }
  if (startDate && endDate) {
    where.createdAt = {
      gte: startDate,
      lte: endDate
    }
  }

  const commissions = await prisma.therapistCommission.findMany({
    where,
    include: {
      transactionItem: {
        include: {
          transaction: true,
          treatment: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  const total = commissions.reduce((sum, c) => sum + Number(c.amount), 0)

  const serializedCommissions = commissions.map(c => ({
    ...c,
    amount: c.amount.toNumber(),
    transactionItem: {
      ...c.transactionItem,
      price: c.transactionItem.unitPrice.toNumber(),
      costPrice: c.transactionItem.costPrice.toNumber(),
      subtotal: c.transactionItem.lineSubtotal.toNumber(),
      total: c.transactionItem.lineTotal.toNumber(),
      profit: c.transactionItem.profit.toNumber(),
      transaction: {
        ...c.transactionItem.transaction,
        subtotal: c.transactionItem.transaction.subtotal.toNumber(),
        total: c.transactionItem.transaction.total.toNumber(),
      },
      treatment: c.transactionItem.treatment ? {
         ...c.transactionItem.treatment,
         costPrice: c.transactionItem.treatment.costPrice.toNumber()
      } : null
    }
  }))

  return { commissions: serializedCommissions, total }
}
