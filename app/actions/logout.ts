'use server'

import { signOut } from '@/app/lib/auth'

export async function logout() {
  await signOut({ redirectTo: '/login' })
}
