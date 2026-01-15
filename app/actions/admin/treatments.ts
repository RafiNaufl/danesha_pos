'use server'

import { prisma } from "@/app/lib/prisma"
import { requireAdmin } from "@/app/lib/admin-auth"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"

const TreatmentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  duration: z.coerce.number().default(60),
  costPrice: z.coerce.number().min(0),
  active: z.boolean().default(true),
  sellPrice: z.coerce.number().min(0)
})

export async function getTreatments(query?: string) {
  await requireAdmin()
  const where: Prisma.TreatmentWhereInput = query ? {
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { code: { contains: query, mode: 'insensitive' } }
    ]
  } : {}

  const treatments = await prisma.treatment.findMany({
    where,
    orderBy: { name: 'asc' }
  })

  return treatments.map(t => ({
    ...t,
    costPrice: t.costPrice.toNumber(),
    sellPrice: t.sellPrice.toNumber()
  }))
}

export async function upsertTreatment(data: z.infer<typeof TreatmentSchema>) {
  await requireAdmin()
  const val = TreatmentSchema.safeParse(data)
  if (!val.success) throw new Error(val.error.errors[0].message)
  
  const { id, name, code, duration, costPrice, active, sellPrice } = val.data

  if (code) {
      const existing = await prisma.treatment.findUnique({ where: { code } })
      if (existing && existing.id !== id) throw new Error("Code already exists")
  }

  if (id) {
    await prisma.treatment.update({
      where: { id },
      data: { name, code, duration, costPrice, active, sellPrice }
    })
  } else {
    await prisma.treatment.create({
      data: { name, code, duration, costPrice, active, sellPrice }
    })
  }

  revalidatePath('/treatments')
  revalidatePath('/dashboard')
}

export async function deleteTreatment(id: string) {
  await requireAdmin()
  try {
    await prisma.treatment.delete({ where: { id } })
  } catch (e) {
    await prisma.treatment.update({ where: { id }, data: { active: false } })
  }
  revalidatePath('/treatments')
  revalidatePath('/dashboard')
}
