'use server'

import { prisma } from '@/app/lib/prisma'
import { requireAdmin } from '@/app/lib/admin-auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const SettingsSchema = z.object({
  storeName: z.string().min(1, "Store Name is required"),
  storeAddress: z.string().optional(),
  storePhone: z.string().optional(),
  footerMessage: z.string().optional(),
  commissionDefaultPercent: z.coerce.number().min(0).max(100),
})

export async function getSettings() {
  await requireAdmin()
  const settings = await prisma.settings.findFirst()
  if (!settings) {
    // Create default if not exists
    const newSettings = await prisma.settings.create({
      data: {
        storeName: "Danesha Clinic",
        footerMessage: "Terima kasih atas kunjungan Anda",
        commissionDefaultPercent: 10
      }
    })
    return {
      ...newSettings,
      commissionDefaultPercent: newSettings.commissionDefaultPercent.toNumber()
    }
  }
  return {
    ...settings,
    commissionDefaultPercent: settings.commissionDefaultPercent.toNumber()
  }
}

export async function updateSettings(data: z.infer<typeof SettingsSchema>) {
  await requireAdmin()
  const val = SettingsSchema.safeParse(data)
  if (!val.success) throw new Error(val.error.errors[0].message)

  const { storeName, storeAddress, storePhone, footerMessage, commissionDefaultPercent } = val.data

  const settings = await prisma.settings.findFirst()
  
  if (settings) {
    await prisma.settings.update({
      where: { id: settings.id },
      data: { storeName, storeAddress, storePhone, footerMessage, commissionDefaultPercent }
    })
  } else {
    await prisma.settings.create({
      data: { storeName, storeAddress, storePhone, footerMessage, commissionDefaultPercent }
    })
  }
  revalidatePath('/settings')
}
