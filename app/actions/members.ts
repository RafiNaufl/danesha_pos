'use server'

import { prisma } from '@/app/lib/prisma'
import { auth } from '@/app/lib/auth'
import { MemberStatus } from '@prisma/client'
import { z } from 'zod'

const RegisterMemberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
})

export async function searchMember(term: string) {
  const t = term.trim()
  if (!t) return []
  return prisma.member.findMany({
    where: {
      OR: [
        { memberCode: { equals: t, mode: 'insensitive' } },
        { phone: { contains: t, mode: 'insensitive' } },
        { name: { contains: t, mode: 'insensitive' } },
      ],
    },
    include: { category: true },
    take: 20,
    orderBy: { name: 'asc' },
  })
}

export async function getMemberByCode(code: string) {
  return prisma.member.findUnique({ where: { memberCode: code }, include: { category: true } })
}

export async function registerMember(data: z.infer<typeof RegisterMemberSchema>) {
  const val = RegisterMemberSchema.safeParse(data)
  if (!val.success) throw new Error(val.error.errors[0].message)
  
  const { name, phone, categoryId } = val.data
  
  // Generate member code
  const count = await prisma.member.count()
  // Simple generation strategy
  let code = `M${(count + 1).toString().padStart(5, '0')}`
  
  // Check collision once
  const existing = await prisma.member.findUnique({ where: { memberCode: code } })
  if (existing) {
     code = `M${(count + 2).toString().padStart(5, '0')}`
  }

  return prisma.member.create({
    data: {
      memberCode: code,
      name,
      phone,
      categoryId,
      status: MemberStatus.ACTIVE,
    },
    include: { category: true }
  })
}

