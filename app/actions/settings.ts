'use server'

import { prisma } from '@/app/lib/prisma'
import { auth } from '@/app/lib/auth'

export async function getStoreSettings() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const settings = await prisma.settings.findFirst()
  
  // Return default if not set
  if (!settings) {
    return {
      storeName: 'Danesha Clinic',
      storeAddress: '',
      storePhone: '',
      footerMessage: 'Terima kasih atas kunjungan Anda'
    }
  }

  return {
    storeName: settings.storeName,
    storeAddress: settings.storeAddress || '',
    storePhone: settings.storePhone || '',
    footerMessage: settings.footerMessage || 'Terima kasih atas kunjungan Anda'
  }
}
