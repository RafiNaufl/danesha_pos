
'use server'

import { prisma } from '@/app/lib/prisma'
import { requireAdmin } from '@/app/lib/admin-auth'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const TherapistLevelSchema = z.object({
  id: z.string(),
  defaultCommission: z.coerce.number().min(0).max(100),
  minCommission: z.coerce.number().min(0).max(100),
  maxCommission: z.coerce.number().min(0).max(100),
})

export async function getTherapistLevels() {
  await requireAdmin()
  return prisma.therapistLevel.findMany({
    orderBy: { name: 'desc' } // Senior first usually
  })
}

export async function updateTherapistLevel(data: z.infer<typeof TherapistLevelSchema>) {
  await requireAdmin()
  const val = TherapistLevelSchema.safeParse(data)
  if (!val.success) throw new Error(val.error.errors[0].message)

  const { id, defaultCommission, minCommission, maxCommission } = val.data

  // Validate logical consistency
  if (minCommission > maxCommission) {
    throw new Error("Min commission cannot be greater than Max commission")
  }
  if (defaultCommission < minCommission || defaultCommission > maxCommission) {
    throw new Error("Default commission must be between Min and Max")
  }

  await prisma.therapistLevel.update({
    where: { id },
    data: {
      defaultCommission,
      minCommission,
      maxCommission
    }
  })

  revalidatePath('/settings')
}
