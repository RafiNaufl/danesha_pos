'use server'

import { prisma } from "@/app/lib/prisma"
import { requireAdmin } from "@/app/lib/admin-auth"
import { startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, subDays, format } from "date-fns"

export async function getDashboardSummary() {
  await requireAdmin()

  const now = new Date()
  const startOfCurrentMonth = startOfMonth(now)
  const endOfCurrentMonth = endOfMonth(now)
  const startOfLastMonth = startOfMonth(subMonths(now, 1))
  const endOfLastMonth = endOfMonth(subMonths(now, 1))

  // 1. Key Metrics
  const [
    totalRevenue,
    lastMonthRevenue,
    totalTransactions,
    lastMonthTransactions,
    totalMembers,
    newMembersThisMonth,
    recentTransactions,
    expiringDiscounts,
    monthlyRevenueGraph
  ] = await Promise.all([
    // Current Month Revenue
    prisma.transaction.aggregate({
      where: {
        createdAt: { gte: startOfCurrentMonth, lte: endOfCurrentMonth }
      },
      _sum: { total: true }
    }),
    // Last Month Revenue
    prisma.transaction.aggregate({
      where: {
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }
      },
      _sum: { total: true }
    }),
    // Current Month Transactions Count
    prisma.transaction.count({
      where: {
        createdAt: { gte: startOfCurrentMonth, lte: endOfCurrentMonth }
      }
    }),
    // Last Month Transactions Count
    prisma.transaction.count({
      where: {
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }
      }
    }),
    // Total Members
    prisma.member.count(),
    // New Members This Month
    prisma.member.count({
      where: {
        joinDate: { gte: startOfCurrentMonth }
      }
    }),
    // Recent Activity (Transactions)
    prisma.transaction.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { name: true } },
        cashier: { select: { name: true } }
      }
    }),
    // Expiring Discounts (next 7 days)
    prisma.discount.findMany({
      where: {
        endDate: {
          gte: now,
          lte: subDays(now, -7) // Next 7 days
        },
        isActive: true
      },
      take: 5
    }),
    // Graph Data (Daily Revenue for current month)
    prisma.transaction.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: subDays(now, 30) } // Last 30 days
      },
      _sum: {
        total: true
      }
    })
  ])

  // Process Graph Data
  // Prisma groupBy on DateTime is precise to the millisecond/second. 
  // We need to aggregate by Day manually or use raw query. 
  // For simplicity with Prisma standard client, fetching all transactions for last 30 days and aggregating in JS is safer for small-medium scale.
  // Or use `prisma.$queryRaw` for date_trunc. Let's stick to simple JS aggregation for now as dataset is likely small.
  
  const last30DaysTransactions = await prisma.transaction.findMany({
    where: { createdAt: { gte: subDays(now, 30) } },
    select: { createdAt: true, total: true }
  })

  const graphData = new Array(30).fill(0).map((_, i) => {
    const d = subDays(now, 29 - i)
    const dateStr = format(d, 'yyyy-MM-dd')
    const dayTotal = last30DaysTransactions
      .filter(t => format(t.createdAt, 'yyyy-MM-dd') === dateStr)
      .reduce((acc, t) => acc + t.total.toNumber(), 0)
    
    return {
      date: format(d, 'dd MMM'),
      revenue: dayTotal
    }
  })

  return {
    metrics: {
      revenue: {
        value: totalRevenue._sum.total?.toNumber() || 0,
        lastMonth: lastMonthRevenue._sum.total?.toNumber() || 0,
        growth: calculateGrowth(totalRevenue._sum.total?.toNumber() || 0, lastMonthRevenue._sum.total?.toNumber() || 0)
      },
      transactions: {
        value: totalTransactions,
        lastMonth: lastMonthTransactions,
        growth: calculateGrowth(totalTransactions, lastMonthTransactions)
      },
      members: {
        value: totalMembers,
        newThisMonth: newMembersThisMonth
      }
    },
    recentActivity: recentTransactions.map(t => ({
      id: t.id,
      description: `Transaction ${t.number}`,
      user: t.member?.name || 'Guest',
      amount: t.total.toNumber(),
      date: t.createdAt,
      status: t.status
    })),
    alerts: expiringDiscounts.map(d => ({
      id: d.id,
      title: `Discount Expiring: ${d.name}`,
      description: `Ends on ${format(d.endDate, 'dd MMM yyyy')}`,
      type: 'warning' as const
    })),
    graph: graphData
  }
}

function calculateGrowth(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}
