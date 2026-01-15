import { prisma } from '@/app/lib/prisma'

/**
 * 1. Riwayat Transaksi Member
 * Mengambil semua transaksi untuk member tertentu, diurutkan dari terbaru.
 */
export async function getMemberHistory(memberId: string) {
  const transactions = await prisma.transaction.findMany({
    where: {
      memberId: memberId
    },
    include: {
      items: {
        include: {
          product: true,
          treatment: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  // Hitung total belanja member
  const totalSpent = transactions.reduce((sum, t) => sum + Number(t.total), 0)
  
  return { transactions, totalSpent }
}

/**
 * 2. Laporan Komisi Therapist
 * Mengambil komisi therapist dalam periode tertentu (misal: bulan ini).
 */
export async function getTherapistCommissionReport(therapistId: string, startDate: Date, endDate: Date) {
  const commissions = await prisma.therapistCommission.findMany({
    where: {
      therapistId: therapistId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      transactionItem: {
        include: {
          treatment: true,
          transaction: {
            select: {
              number: true,
              createdAt: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  // Total komisi
  const totalCommission = commissions.reduce((sum, c) => sum + Number(c.amount), 0)

  return { commissions, totalCommission }
}

/**
 * 3. Top 10 Member (Spending Terbanyak)
 * Query agregasi untuk mencari member dengan total belanja tertinggi.
 */
export async function getTopMembers() {
  const topMembers = await prisma.transaction.groupBy({
    by: ['memberId'],
    where: {
      memberId: { not: null }
    },
    _sum: {
      total: true
    },
    orderBy: {
      _sum: {
        total: 'desc'
      }
    },
    take: 10
  })

  // Fetch nama member
  // Karena groupBy tidak bisa include relation, kita fetch manual atau gunakan raw query jika butuh performa tinggi.
  const result = await Promise.all(topMembers.map(async (tm) => {
    if (!tm.memberId) return null
    const member = await prisma.member.findUnique({ where: { id: tm.memberId } })
    return {
      member,
      totalSpent: tm._sum.total
    }
  }))

  return result
}
