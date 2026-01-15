'use server'

import { prisma } from '@/app/lib/prisma'
import { requireAdmin } from '@/app/lib/admin-auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { Role } from '@prisma/client'

const UserSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().optional(),
  role: z.nativeEnum(Role).default(Role.KASIR),
})

export async function getUsers() {
  await requireAdmin()
  return prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    }
  })
}

export async function upsertUser(data: z.infer<typeof UserSchema>) {
  await requireAdmin()
  const val = UserSchema.safeParse(data)
  if (!val.success) throw new Error(val.error.errors[0].message)

  const { id, name, email, password, role } = val.data

  if (id) {
    // Check if email is taken by another user
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing && existing.id !== id) {
      throw new Error("Email already registered")
    }

    const updateData: any = { name, email, role }
    if (password && password.length > 0) {
      updateData.password = password
    }
    
    await prisma.user.update({
      where: { id },
      data: updateData
    })
  } else {
    // Create
    if (!password) throw new Error("Password is required for new users")
    
    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      throw new Error("Email already registered")
    }

    await prisma.user.create({
      data: {
        name,
        email,
        password,
        role
      }
    })
  }

  revalidatePath('/dashboard/users')
}

export async function deleteUser(id: string) {
  await requireAdmin()
  // Check if user has transactions
  const hasTransactions = await prisma.transaction.findFirst({ where: { cashierId: id } })
  if (hasTransactions) {
    throw new Error("Cannot delete user with transaction history")
  }

  await prisma.user.delete({ where: { id } })
  revalidatePath('/dashboard/users')
}
