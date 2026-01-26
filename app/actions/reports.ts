'use server'

import { prisma } from '@/app/lib/prisma'
import { Prisma } from '@prisma/client'

// HELPER: Standardize Decimal Rounding (ROUND_HALF_UP, 2 decimal places)
function normalizeDecimal(val: number | Prisma.Decimal | null | undefined): number {
  const num = Number(val || 0)
  return Math.round((num + Number.EPSILON) * 100) / 100
}

export type ReportFilters = {
  from: Date
  to: Date
  categoryCode?: string
  memberId?: string
  therapistId?: string
  paymentMethod?: string
  page?: number
  limit?: number
}

export async function getReportOptions() {
  const [categories, members, therapists, paymentMethods] = await prisma.$transaction([
    prisma.customerCategory.findMany({ orderBy: { name: 'asc' } }),
    prisma.member.findMany({ orderBy: { name: 'asc' } }),
    prisma.therapist.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.transaction.findMany({
      distinct: ['paymentMethod'],
      select: { paymentMethod: true },
      orderBy: { paymentMethod: 'asc' }
    })
  ])

  return {
    categories: categories.map(c => ({ id: c.id, name: c.name, code: c.code })),
    members: members.map(m => ({ id: m.id, name: m.name, memberCode: m.memberCode })),
    therapists: therapists.map(t => ({ id: t.id, name: t.name })),
    paymentMethods: paymentMethods.map(p => p.paymentMethod)
  }
}

export type ProductReportStats = {
  totalQty: number
  totalOmzet: number
  totalProfit: number
}

export type ProductPerformanceItem = {
  productId: string
  productName: string
  qty: number
  omzet: number
  profit: number
  margin: number // Percentage
}

export type ProductReport = {
  stats: ProductReportStats
  top5ByOmzet: ProductPerformanceItem[]
  top5ByQty: ProductPerformanceItem[]
  lowestMargin: ProductPerformanceItem[]
  negativeProfit: ProductPerformanceItem[]
}

export async function getProductReport(filters: ReportFilters): Promise<ProductReport> {
  // REPORTING GUARD — read-only, snapshot-based
  // INVARIANT: Product report hanya membaca snapshot TransactionItem, tidak membaca Product.costPrice live
  // Reports rely on immutable transaction snapshots (audit-safe)
  // Strict separation: This report ignores therapistId to avoid mixing modes

  // Base Transaction Where Clause
  const whereTxBase: Prisma.TransactionWhereInput = {
    createdAt: { gte: filters.from, lte: filters.to },
  }
  if (filters.memberId) whereTxBase.memberId = filters.memberId
  if (filters.paymentMethod) whereTxBase.paymentMethod = filters.paymentMethod
  
  // Category Guard (Same as getFinancialReport)
  const whereTxProduct: Prisma.TransactionWhereInput = { ...whereTxBase }
  
  if (filters.categoryCode) {
    const cat = await prisma.customerCategory.findUnique({ where: { code: filters.categoryCode } })
    if (cat) {
      whereTxProduct.categoryId = cat.id
    }
  }

  // 1. Overall Aggregates (Snapshot Only)
  const overallStats = await prisma.transactionItem.aggregate({
    where: {
      transaction: whereTxProduct,
      type: 'PRODUCT'
    },
    _sum: {
      qty: true,
      lineTotal: true,
      profit: true
    }
  })

  // 2. Group By Product (Snapshot Only)
  const productGroups = await prisma.transactionItem.groupBy({
    by: ['productId'],
    where: {
      transaction: whereTxProduct,
      type: 'PRODUCT',
      productId: { not: null } // Ensure we have a product ID
    },
    _sum: {
      qty: true,
      lineTotal: true,
      profit: true
    }
  })

  // 3. Resolve Product Names (Display Only)
  const productIds = productGroups.map(g => g.productId).filter(Boolean) as string[]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true }
  })
  const productMap = new Map(products.map(p => [p.id, p.name]))

  // 4. Transform to Performance Items
  const performanceItems: ProductPerformanceItem[] = productGroups.map(g => {
    const qty = g._sum.qty || 0
    const omzet = normalizeDecimal(g._sum.lineTotal)
    const profit = normalizeDecimal(g._sum.profit)
    
    // Calculate Margin based on Snapshot data
    // Margin = (Profit / Omzet) * 100
    const marginRaw = omzet !== 0 ? (profit / omzet) * 100 : 0
    const margin = normalizeDecimal(marginRaw)

    return {
      productId: g.productId!,
      productName: productMap.get(g.productId!) || 'Unknown Product',
      qty,
      omzet,
      profit,
      margin
    }
  })

  // 5. Build Result Sets
  
  // Top 5 By Omzet
  const top5ByOmzet = [...performanceItems]
    .sort((a, b) => b.omzet - a.omzet)
    .slice(0, 5)

  // Top 5 By Qty
  const top5ByQty = [...performanceItems]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  // Lowest Margin (Bottom 5)
  const lowestMargin = [...performanceItems]
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 5)

  // Negative Profit (All items with profit < 0)
  const negativeProfit = performanceItems
    .filter(item => item.profit < 0)
    .sort((a, b) => a.profit - b.profit) // Most negative first

  return {
    stats: {
      totalQty: overallStats._sum.qty || 0,
      totalOmzet: normalizeDecimal(overallStats._sum.lineTotal),
      totalProfit: normalizeDecimal(overallStats._sum.profit)
    },
    top5ByOmzet,
    top5ByQty,
    lowestMargin,
    negativeProfit
  }
}


export type TherapistPerformanceStats = {
  totalTreatmentOmzet: number
  totalCommission: number
  totalTreatmentCount: number
  avgOmzetPerTreatment: number
}

export type TherapistPerformanceItem = {
  therapistId: string
  therapistName: string
  treatmentCount: number
  omzet: number
  commission: number
  avgOmzet: number
}

export type TherapistPerformanceReport = {
  stats: TherapistPerformanceStats
  data: TherapistPerformanceItem[]
}

export async function getTherapistPerformanceReport(filters: ReportFilters): Promise<TherapistPerformanceReport> {
  // INVARIANT: Therapist Performance hanya membaca snapshot TransactionItem & TherapistCommission
  // Reports rely on immutable transaction snapshots (audit-safe)
  // STRICT RULE: Type = TREATMENT only. Product is strictly excluded.

  // Base Transaction Where Clause
  const whereTxBase: Prisma.TransactionWhereInput = {
    createdAt: { gte: filters.from, lte: filters.to },
  }
  if (filters.memberId) whereTxBase.memberId = filters.memberId
  if (filters.paymentMethod) whereTxBase.paymentMethod = filters.paymentMethod

  // CLARITY GUARD: Treatment ignores category filter
  const whereTxTreatment: Prisma.TransactionWhereInput = { ...whereTxBase }
  
  // NOTE: We do NOT apply category filter here because Category applies to Product only.
  
  // Therapist Filter (Optional)
  const therapistFilter: Prisma.StringNullableFilter | string | null = filters.therapistId || null
  
  const whereItem: Prisma.TransactionItemWhereInput = {
    transaction: whereTxTreatment,
    type: 'TREATMENT',
    ...(therapistFilter ? { therapistId: therapistFilter } : {})
  }

  // 1. Group By Therapist (Snapshot Data: Qty, LineTotal)
  const itemGroups = await prisma.transactionItem.groupBy({
    by: ['therapistId'],
    where: whereItem,
    _sum: {
      qty: true,
      lineTotal: true
    }
  })

  // 1b. Group By Assistant (Snapshot Data: Qty only)
  // Assistant gets credit for "Treatment Count" but usually Omzet is attributed to Main Therapist.
  // We will count how many times they assisted.
  const assistantGroups = await prisma.transactionItem.groupBy({
    by: ['assistantId'],
    where: {
      transaction: whereTxTreatment,
      type: 'TREATMENT',
      assistantId: { not: null },
      ...(therapistFilter ? { assistantId: therapistFilter } : {})
    },
    _sum: {
      qty: true
    }
  })

  // 2. Commission Aggregates (Snapshot Data: Amount)
  const commissionGroups = await prisma.therapistCommission.groupBy({
    by: ['therapistId'],
    where: {
      transactionItem: {
        transaction: whereTxTreatment,
        type: 'TREATMENT'
      },
      ...(therapistFilter ? { therapistId: therapistFilter } : {})
    },
    _sum: {
      amount: true
    }
  })

  // 3. Resolve Therapist Names (Display Only)
  // Collect all therapist IDs found in items OR commissions OR assistant roles
  const therapistIds = Array.from(new Set([
    ...itemGroups.map(g => g.therapistId).filter(Boolean) as string[],
    ...assistantGroups.map(g => g.assistantId).filter(Boolean) as string[],
    ...commissionGroups.map(g => g.therapistId).filter(Boolean) as string[]
  ]))

  const therapists = await prisma.therapist.findMany({
    where: { id: { in: therapistIds } },
    select: { id: true, name: true }
  })
  const therapistMap = new Map(therapists.map(t => [t.id, t.name]))

  // 4. Build Performance Items
  const performanceItems: TherapistPerformanceItem[] = therapistIds.map(tid => {
    const itemStats = itemGroups.find(g => g.therapistId === tid)
    const assistantStats = assistantGroups.find(g => g.assistantId === tid)
    const commStats = commissionGroups.find(g => g.therapistId === tid)

    const omzet = normalizeDecimal(itemStats?._sum.lineTotal)
    // Treatment Count = Main + Assistant roles
    const mainCount = itemStats?._sum.qty || 0
    const assistantCount = assistantStats?._sum.qty || 0
    const treatmentCount = mainCount + assistantCount
    
    const commission = normalizeDecimal(commStats?._sum.amount)
    
    // Rata-rata omzet per treatment (based on Main Treatment Count only, to avoid diluting with assistant roles which have 0 omzet)
    // Or should it be based on total? Usually Avg Omzet is a metric for "Revenue Generation Efficiency".
    // If I assist, I generate 0 revenue directly (attributed to me).
    // So maybe keep it as omzet / mainCount. 
    // If I only assist, my Avg Omzet is 0. This seems correct.
    const avgOmzet = mainCount > 0 ? normalizeDecimal(omzet / mainCount) : 0

    return {
      therapistId: tid,
      therapistName: therapistMap.get(tid) || 'Unknown Therapist',
      treatmentCount,
      omzet,
      commission,
      avgOmzet
    }
  })

  // Sort by Omzet Descending
  performanceItems.sort((a, b) => b.omzet - a.omzet)

  // 5. Calculate Overall Stats
  const totalTreatmentOmzet = normalizeDecimal(performanceItems.reduce((sum, item) => sum + item.omzet, 0))
  const totalCommission = normalizeDecimal(performanceItems.reduce((sum, item) => sum + item.commission, 0))
  const totalTreatmentCount = performanceItems.reduce((sum, item) => sum + item.treatmentCount, 0)
  const overallAvgOmzet = totalTreatmentCount > 0 ? normalizeDecimal(totalTreatmentOmzet / totalTreatmentCount) : 0

  return {
    stats: {
      totalTreatmentOmzet,
      totalCommission,
      totalTreatmentCount,
      avgOmzetPerTreatment: overallAvgOmzet
    },
    data: performanceItems
  }
}

export async function getFinancialReport(filters: ReportFilters) {
  // REPORTING GUARD — read-only, snapshot-based
  // INVARIANT: Report hanya membaca snapshot (TransactionItem, TherapistCommission), tidak hitung ulang harga/komisi.
  // Reports must rely on immutable transaction snapshots (audit-safe)
  // DILARANG: Join ke Product, Treatment, ProductPrice, Settings untuk kalkulasi.
  
  const page = filters.page || 1
  const limit = filters.limit || 20
  const skip = (page - 1) * limit

  // Base Transaction Where Clause
  const whereTxBase: Prisma.TransactionWhereInput = {
    createdAt: { gte: filters.from, lte: filters.to },
  }
  if (filters.memberId) whereTxBase.memberId = filters.memberId
  if (filters.paymentMethod) whereTxBase.paymentMethod = filters.paymentMethod
  
  // CLARITY GUARD: Category hanya relevan untuk PRODUCT. Treatment HARUS ignore category.
  const whereTxProduct: Prisma.TransactionWhereInput = { ...whereTxBase }
  const whereTxTreatment: Prisma.TransactionWhereInput = { ...whereTxBase }
  
  if (filters.categoryCode) {
    // Resolve category ID separately - never join in the main query
    // Category applies to Product only; Treatment ignores category filter
    const cat = await prisma.customerCategory.findUnique({ where: { code: filters.categoryCode } })
    if (cat) {
      whereTxProduct.categoryId = cat.id
      // Note: whereTxTreatment remains untouched (ignores category filter)
    }
  }

  // --- PREPARE STATS HOLDERS ---
  let stats = { omzet: 0, modal: 0, diskon: 0, diskonProduct: 0, diskonTreatment: 0, laba: 0, komisi: 0 }
  
  // Define a comprehensive type for productStats to avoid "Object literal may only specify known properties" error
  type FinancialProductStats = {
    totalOmzet: number
    byCategory: { categoryId: string, categoryName: string, categoryCode: string, omzet: number }[]
    totalQty?: number
    totalProfit?: number
    top5ByOmzet?: ProductPerformanceItem[]
    top5ByQty?: ProductPerformanceItem[]
    lowestMargin?: ProductPerformanceItem[]
    negativeProfit?: ProductPerformanceItem[]
  }

  type PaymentMethodStats = {
    method: string
    count: number
    total: number
  }

  let productStats: FinancialProductStats = { 
    totalOmzet: 0, 
    byCategory: [] 
  }
  let paymentMethodStats: PaymentMethodStats[] = []
  let therapistStats = {
    totalTreatmentOmzet: 0,
    totalCommission: 0,
    totalTreatmentProfit: 0,
    byTherapist: [] as { 
      therapistId: string, 
      therapistName: string, 
      omzet: number, 
      commission: number, 
      treatmentCount: number, 
      mainCount: number,
      assistantCount: number,
      avgOmzet: number 
    }[]
  }
  let data: any[] = []
  let totalCount = 0

  // --- LOGIC SPLIT: THERAPIST FILTER vs GENERAL ---
  
  if (filters.therapistId) {
    // === THERAPIST MODE ===
    // Therapist mode = Item-level (no invoice bias)
    // Aktif jika therapistId dipilih
    // We strictly calculate stats based on items handled by this therapist
    
    // 1. Aggregates from TransactionItem (SNAPSHOT ONLY)
    // MAIN ROLE: Omzet + Qty
    const mainGroups = await prisma.transactionItem.groupBy({
      by: ['type'],
      where: {
        transaction: whereTxProduct,
        therapistId: filters.therapistId
      },
      _sum: {
        lineTotal: true,    // Omzet from snapshot
        lineDiscount: true, // Diskon from snapshot
        profit: true,       // Laba from snapshot
        qty: true           // Treatment Count
      }
    })

    // ASSISTANT ROLE: Qty Only (Omzet attributed to Main)
    const assistantGroups = await prisma.transactionItem.groupBy({
      by: ['type'],
      where: {
        transaction: whereTxProduct,
        assistantId: filters.therapistId,
        type: 'TREATMENT' // Assistant only relevant for treatment
      },
      _sum: {
        qty: true
      }
    })

    const productGroup = mainGroups.find(g => g.type === 'PRODUCT')
    const treatmentGroup = mainGroups.find(g => g.type === 'TREATMENT')
    const assistantTreatmentGroup = assistantGroups.find(g => g.type === 'TREATMENT')

    const omzet = normalizeDecimal(mainGroups.reduce((sum, g) => sum + Number(g._sum.lineTotal || 0), 0))
    const diskonProduct = normalizeDecimal(productGroup?._sum.lineDiscount)
    const diskonTreatment = normalizeDecimal(treatmentGroup?._sum.lineDiscount)
    const diskon = normalizeDecimal(diskonProduct + diskonTreatment)
    
    const laba = normalizeDecimal(mainGroups.reduce((sum, g) => sum + Number(g._sum.profit || 0), 0))
    const modal = normalizeDecimal(omzet - laba) // Derived Cost
    
    const mainCount = mainGroups.reduce((sum, g) => sum + (g._sum.qty || 0), 0)
    const assistantCount = assistantTreatmentGroup?._sum.qty || 0
    const treatmentCount = mainCount + assistantCount
    const avgOmzet = mainCount > 0 ? normalizeDecimal(omzet / mainCount) : 0 // Avg based on Main only

    // 2. Commission from TherapistCommission (SNAPSHOT ONLY)
    const commissionStats = await prisma.therapistCommission.aggregate({
      where: {
        therapistId: filters.therapistId,
        transactionItem: {
          transaction: whereTxProduct
        }
      },
      _sum: {
        amount: true
      }
    })
    const komisi = normalizeDecimal(commissionStats._sum.amount)

    stats = { omzet, modal, diskon, diskonProduct, diskonTreatment, laba, komisi }

    // Therapist Mode: Therapist Stats (Single Therapist)
    // We can populate this for consistency
    const therapist = await prisma.therapist.findUnique({ where: { id: filters.therapistId }, select: { name: true } })
    therapistStats = {
      totalTreatmentOmzet: omzet, // In therapist mode, practically all is treatment (or product assigned to them)
      totalCommission: komisi,
      totalTreatmentProfit: laba, // In therapist mode, laba is derived from the filtered items
      byTherapist: [{
        therapistId: filters.therapistId,
        therapistName: therapist?.name || 'Unknown',
        omzet: omzet,
        treatmentCount,
        mainCount,
        assistantCount,
        commission: komisi,
        avgOmzet
      }]
    }

    // 3. Paginated Data (Items) - NO JOINS TO MASTER DATA
    const [items, count] = await prisma.$transaction([
       prisma.transactionItem.findMany({
         where: {
           transaction: whereTxProduct,
           OR: [
             { therapistId: filters.therapistId },
             { assistantId: filters.therapistId }
           ]
         },
         include: {
           transaction: true, // Allowed: Transaction is a snapshot container
           commission: {
             where: { therapistId: filters.therapistId }
           }
         },
         orderBy: { transaction: { createdAt: 'desc' } },
         skip,
         take: limit
       }),
       prisma.transactionItem.count({
         where: {
           transaction: whereTxProduct,
           OR: [
             { therapistId: filters.therapistId },
             { assistantId: filters.therapistId }
           ]
         }
       })
    ])
    totalCount = count

    // 4. Manual Resolution of Names (Display Only)
    const productIds = items.map(i => i.productId).filter(Boolean) as string[]
    const treatmentIds = items.map(i => i.treatmentId).filter(Boolean) as string[]
    const memberIds = items.map(i => i.transaction.memberId).filter(Boolean) as string[]
    const categoryIds = items.map(i => i.transaction.categoryId).filter(Boolean) as string[]
    const therapistIds = Array.from(new Set([
      ...items.map(i => i.therapistId).filter(Boolean) as string[],
      ...items.map(i => i.assistantId).filter(Boolean) as string[]
    ]))

    const [products, treatments, members, categories, therapists] = await prisma.$transaction([
      prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } }),
      prisma.treatment.findMany({ where: { id: { in: treatmentIds } }, select: { id: true, name: true } }),
      prisma.member.findMany({ where: { id: { in: memberIds } }, select: { id: true, name: true } }),
      prisma.customerCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } }),
      prisma.therapist.findMany({ where: { id: { in: therapistIds } }, select: { id: true, name: true } })
    ])

    const productMap = new Map(products.map(p => [p.id, p.name]))
    const treatmentMap = new Map(treatments.map(t => [t.id, t.name]))
    const memberMap = new Map(members.map(m => [m.id, m.name]))
    const categoryMap = new Map(categories.map(c => [c.id, c.name]))
    const therapistMap = new Map(therapists.map(t => [t.id, t.name]))

    data = items.map(item => ({
      id: item.id,
      transactionId: item.transactionId,
      date: item.transaction.createdAt,
      number: item.transaction.number,
      type: item.type, // 'PRODUCT' or 'TREATMENT'
      itemName: (item.productId ? productMap.get(item.productId) : null) || 
                (item.treatmentId ? treatmentMap.get(item.treatmentId) : null) || 
                'Unknown Item',
      qty: item.qty,
      price: normalizeDecimal(item.lineTotal), 
      commission: normalizeDecimal(item.commission?.[0]?.amount), 
      member: (item.transaction.memberId ? memberMap.get(item.transaction.memberId) : null) || '-',
      category: categoryMap.get(item.transaction.categoryId) || 'Unknown',
      therapists: [
        item.therapistId ? therapistMap.get(item.therapistId) : null,
        item.assistantId ? `(Asst: ${therapistMap.get(item.assistantId)})` : null
      ].filter(Boolean).join(' ') || '-',
      paymentMethod: item.transaction.paymentMethod
    }))

  } else {
    // === GENERAL MODE ===
    // General mode = Transaction-level
    // Aktif jika therapist filter = "Semua"
    // Use TransactionItem and TherapistCommission snapshots for audit-safe totals
    const productAgg = await prisma.transactionItem.aggregate({
      where: { transaction: whereTxProduct, type: 'PRODUCT' },
      _sum: { lineTotal: true, lineDiscount: true, profit: true }
    })
    
    const treatmentAgg = await prisma.transactionItem.aggregate({
      where: { transaction: whereTxTreatment, type: 'TREATMENT' },
      _sum: { lineTotal: true, lineDiscount: true, profit: true }
    })

    const omzetProduct = productAgg._sum.lineTotal || new Prisma.Decimal(0)
    const omzetTreatment = treatmentAgg._sum.lineTotal || new Prisma.Decimal(0)
    const diskonDec = (productAgg._sum.lineDiscount || new Prisma.Decimal(0)).add(treatmentAgg._sum.lineDiscount || new Prisma.Decimal(0))
    const labaDec = (productAgg._sum.profit || new Prisma.Decimal(0)).add(treatmentAgg._sum.profit || new Prisma.Decimal(0))
    
    const omzetDec = omzetProduct.add(omzetTreatment)
    const modalDec = omzetDec.sub(labaDec)

    const omzet = normalizeDecimal(omzetDec)
    const modal = normalizeDecimal(modalDec)
    const diskon = normalizeDecimal(diskonDec)
    const diskonProduct = normalizeDecimal(productAgg._sum.lineDiscount)
    const diskonTreatment = normalizeDecimal(treatmentAgg._sum.lineDiscount)
    const laba = normalizeDecimal(labaDec)

    // Commission from snapshot table
    // Must use whereTxTreatment to ignore category filter (commissions are treatment-based)
    const commissions = await prisma.therapistCommission.findMany({
      where: { transactionItem: { transaction: whereTxTreatment } },
      select: { amount: true }
    })
    const komisiNumber = normalizeDecimal(commissions.reduce((sum, c) => sum + Number(c.amount || 0), 0))
    
    stats = { 
      omzet, 
      modal, 
      diskon,
      diskonProduct,
      diskonTreatment, 
      laba, 
      komisi: komisiNumber 
    }

    // --- PAYMENT METHOD BREAKDOWN ---
    const paymentGroups = await prisma.transaction.groupBy({
      by: ['paymentMethod'],
      where: whereTxBase,
      _sum: { total: true },
      _count: { id: true }
    })

    paymentMethodStats = paymentGroups.map(g => ({
      method: g.paymentMethod,
      count: g._count.id,
      total: normalizeDecimal(g._sum.total)
    })).sort((a, b) => b.total - a.total)

    // --- POPULATE PRODUCT STATS (BREAKDOWN) ---
    // Note: Reusing logic from previous getSalesBreakdown but inline
    
    // 1. Product Breakdown by Category
    // Heavy operation: fetching all product items to group by category (since category is on Transaction)
    // Optimization: We could use raw query, but stick to Prisma for safety as requested "tanpa refactor besar"
    const productItems = await prisma.transactionItem.findMany({
      where: { type: 'PRODUCT', transaction: whereTxProduct },
      select: { lineTotal: true, transaction: { select: { categoryId: true } } }
    })
    
    const categoryTotals: Record<string, number> = {}
    for (const it of productItems) {
      const catId = it.transaction.categoryId
      if (!catId) continue
      categoryTotals[catId] = (categoryTotals[catId] || 0) + Number(it.lineTotal)
    }
    
    const categoryIds = Object.keys(categoryTotals)
    const categories = categoryIds.length ? await prisma.customerCategory.findMany({
      where: { id: { in: categoryIds } }
    }) : []
    
    // 2. Product Performance (Top 5, etc.) - Snapshot Only
    const productGroups = await prisma.transactionItem.groupBy({
      by: ['productId'],
      where: {
        transaction: whereTxProduct,
        type: 'PRODUCT',
        productId: { not: null }
      },
      _sum: { qty: true, lineTotal: true, profit: true }
    })

    const productIds = productGroups.map(g => g.productId).filter(Boolean) as string[]
    const products = productIds.length ? await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true }
    }) : []
    const productMap = new Map(products.map(p => [p.id, p.name]))

    const performanceItems = productGroups.map(g => {
      const qty = g._sum.qty || 0
      const omzet = normalizeDecimal(g._sum.lineTotal)
      const profit = normalizeDecimal(g._sum.profit)
      // Margin = (Profit / Omzet) * 100
      const marginRaw = omzet !== 0 ? (profit / omzet) * 100 : 0
      return {
        productId: g.productId!,
        productName: productMap.get(g.productId!) || 'Unknown Product',
        qty,
        omzet,
        profit,
        margin: normalizeDecimal(marginRaw)
      }
    })

    const top5ByOmzet = [...performanceItems].sort((a, b) => b.omzet - a.omzet).slice(0, 5)
    const top5ByQty = [...performanceItems].sort((a, b) => b.qty - a.qty).slice(0, 5)
    const lowestMargin = [...performanceItems].sort((a, b) => a.margin - b.margin).slice(0, 5)
    const negativeProfit = performanceItems.filter(item => item.profit < 0).sort((a, b) => a.profit - b.profit)

    productStats = {
      totalOmzet: normalizeDecimal(omzetProduct),
      byCategory: Object.entries(categoryTotals).map(([categoryId, omzet]) => {
        const cat = categories.find(c => c.id === categoryId)
        return {
          categoryId,
          categoryName: cat?.name || '-',
          categoryCode: cat?.code || '-',
          omzet: normalizeDecimal(omzet)
        }
      }),
      // Enhanced Stats
      totalQty: performanceItems.reduce((sum, item) => sum + item.qty, 0),
      totalProfit: performanceItems.reduce((sum, item) => sum + item.profit, 0),
      top5ByOmzet,
      top5ByQty,
      lowestMargin,
      negativeProfit
    }

    // 3. Therapist Breakdown (Treatment Only)
    const treatmentGroup = await prisma.transactionItem.groupBy({
      by: ['therapistId'],
      where: { type: 'TREATMENT', transaction: whereTxTreatment },
      _sum: { lineTotal: true, qty: true }
    })

    // 3a. Assistant Breakdown (Qty Only)
    const assistantGroup = await prisma.transactionItem.groupBy({
      by: ['assistantId'],
      where: { type: 'TREATMENT', transaction: whereTxTreatment, assistantId: { not: null } },
      _sum: { qty: true }
    })

    // 3b. Commission Breakdown (Snapshot)
    const commissionGroup = await prisma.therapistCommission.groupBy({
      by: ['therapistId'],
      where: {
        transactionItem: {
          transaction: whereTxTreatment
        }
      },
      _sum: { amount: true }
    })
    
    // Combine IDs from both groups to ensure full coverage
    const txTherapistIds = new Set([
      ...treatmentGroup.map(tg => tg.therapistId),
      ...assistantGroup.map(ag => ag.assistantId),
      ...commissionGroup.map(cg => cg.therapistId)
    ].filter(Boolean) as string[])

    // Fetch all ACTIVE therapists to ensure they appear even with 0 transactions
    const activeTherapists = await prisma.therapist.findMany({
      where: { active: true },
      select: { id: true, name: true }
    })
    
    // Prepare a Map of all therapists to display (Active + InactiveWithData)
    const displayTherapistsMap = new Map<string, { id: string, name: string }>()
    
    // 1. Add all active therapists
    activeTherapists.forEach(t => displayTherapistsMap.set(t.id, t))
    
    // 2. Check for any inactive therapists that have data in this period
    const missingIds = Array.from(txTherapistIds).filter(id => !displayTherapistsMap.has(id))
    
    if (missingIds.length > 0) {
      const inactiveTherapistsWithData = await prisma.therapist.findMany({
        where: { id: { in: missingIds } },
        select: { id: true, name: true }
      })
      inactiveTherapistsWithData.forEach(t => displayTherapistsMap.set(t.id, t))
    }
    
    const mergedTherapistStats = Array.from(displayTherapistsMap.values()).map(th => {
      const tid = th.id
      const tg = treatmentGroup.find(g => g.therapistId === tid)
      const ag = assistantGroup.find(g => g.assistantId === tid)
      const cg = commissionGroup.find(g => g.therapistId === tid)

      const mainCount = tg?._sum.qty || 0
      const asstCount = ag?._sum.qty || 0
      const treatmentCount = mainCount + asstCount

      const omzet = normalizeDecimal(tg?._sum.lineTotal)
      const commission = normalizeDecimal(cg?._sum.amount)

      return {
        therapistId: tid,
        therapistName: th.name,
        omzet,
        commission, 
        treatmentCount,
        mainCount,
        assistantCount: asstCount,
        avgOmzet: mainCount > 0 ? normalizeDecimal(omzet / mainCount) : 0
      }
    }).sort((a, b) => b.omzet - a.omzet)

    therapistStats = {
      totalTreatmentOmzet: normalizeDecimal(omzetTreatment),
      totalCommission: komisiNumber,
      totalTreatmentProfit: normalizeDecimal(treatmentAgg._sum.profit), // Added for Modal calculation
      byTherapist: mergedTherapistStats
    }

    // 3. Paginated Data (Transactions)
    const [transactions, count] = await prisma.$transaction([
      prisma.transaction.findMany({
        where: whereTxProduct,
        include: {
          items: {
            include: {
              commission: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.transaction.count({ where: whereTxProduct })
    ])
    totalCount = count

    // 4. Manual Resolution of Names (Display Only)
    const memberIds = transactions.map(t => t.memberId).filter(Boolean) as string[]
    const txCategoryIds = transactions.map(t => t.categoryId).filter(Boolean) as string[]
    const allItems = transactions.flatMap(t => t.items)
    const paginatedTxTherapistIds = Array.from(new Set([
      ...allItems.map(i => i.therapistId).filter(Boolean) as string[],
      ...allItems.map(i => i.assistantId).filter(Boolean) as string[]
    ]))
    const txProductIds = allItems.map(i => i.productId).filter(Boolean) as string[]
    const txTreatmentIds = allItems.map(i => i.treatmentId).filter(Boolean) as string[]

    const [members, txCategories, txTherapists, txProducts, txTreatments] = await prisma.$transaction([
      prisma.member.findMany({ where: { id: { in: memberIds } }, select: { id: true, name: true } }),
      prisma.customerCategory.findMany({ where: { id: { in: txCategoryIds } }, select: { id: true, name: true } }),
      prisma.therapist.findMany({ where: { id: { in: paginatedTxTherapistIds } }, select: { id: true, name: true } }),
      prisma.product.findMany({ where: { id: { in: txProductIds } }, select: { id: true, name: true } }),
      prisma.treatment.findMany({ where: { id: { in: txTreatmentIds } }, select: { id: true, name: true } })
    ])

    const memberMap = new Map(members.map(m => [m.id, m.name]))
    const categoryMap = new Map(txCategories.map(c => [c.id, c.name]))
    const therapistMap = new Map(txTherapists.map(t => [t.id, t.name]))
    const txProductMap = new Map(txProducts.map(p => [p.id, p.name]))
    const txTreatmentMap = new Map(txTreatments.map(t => [t.id, t.name]))

    data = transactions.map(tx => {
      // Helper to format therapist string for an item
      const getItemTherapists = (i: any) => {
        const main = i.therapistId ? therapistMap.get(i.therapistId) : null
        const asstName = i.assistantId ? (therapistMap.get(i.assistantId) || 'Unknown') : null
        const asst = asstName ? `(Asst: ${asstName})` : null
        return [main, asst].filter(Boolean).join(' ')
      }

      const txCommission = tx.items.reduce((sum, item) => {
        const itemComm = item.commission ? item.commission.reduce((cSum, c) => cSum + Number(c.amount), 0) : 0
        return sum + itemComm
      }, 0)

      return {
      id: tx.id,
      transactionId: tx.id,
      date: tx.createdAt,
      number: tx.number,
      type: 'TRANSACTION',
      itemName: `${tx.items.length} Items`, // Legacy fallback
      itemsDetail: tx.items.map(i => ({
        name: (i.productId ? txProductMap.get(i.productId) : null) || 
              (i.treatmentId ? txTreatmentMap.get(i.treatmentId) : null) || 
              'Unknown Item',
        qty: i.qty,
        type: i.type,
        // Add therapist info to detail for potential future use
        therapists: getItemTherapists(i)
      })),
      qty: tx.items.reduce((a,b) => a + b.qty, 0),
      price: normalizeDecimal(tx.total),
      commission: normalizeDecimal(txCommission),
      member: (tx.memberId ? memberMap.get(tx.memberId) : null) || '-',
      category: categoryMap.get(tx.categoryId) || 'Unknown',
      therapists: Array.from(new Set(
        tx.items.map(i => getItemTherapists(i)).filter(Boolean)
      )).join(', '),
      paymentMethod: tx.paymentMethod
    }
  })
  }

  return {
    stats,
    productStats,
    therapistStats,
    paymentMethodStats,
    data,
    pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) }
  }
}


export async function getSalesBreakdown(filters: ReportFilters) {
  const whereTxBase: Prisma.TransactionWhereInput = {
    createdAt: { gte: filters.from, lte: filters.to },
  }
  if (filters.memberId) whereTxBase.memberId = filters.memberId
  if (filters.paymentMethod) whereTxBase.paymentMethod = filters.paymentMethod
  const whereTxProduct: Prisma.TransactionWhereInput = { ...whereTxBase }
  const whereTxTreatment: Prisma.TransactionWhereInput = { ...whereTxBase }
  if (filters.categoryCode) {
    const cat = await prisma.customerCategory.findUnique({ where: { code: filters.categoryCode } })
    if (cat) {
      whereTxProduct.categoryId = cat.id
      // Category applies to Product only; Treatment ignores category filter
    }
  }

  const productGroup = await prisma.transactionItem.groupBy({
    by: ['transactionId'],
    where: { type: 'PRODUCT', transaction: whereTxProduct },
    _sum: { lineTotal: true, lineDiscount: true, profit: true }
  })

  const treatmentGroup = await prisma.transactionItem.groupBy({
    by: ['therapistId'],
    // CLARITY GUARD: Treatment breakdown HARUS ignore category
    where: { type: 'TREATMENT', transaction: whereTxTreatment },
    _sum: { lineTotal: true, lineDiscount: true, profit: true }
  })

  const productOmzet = normalizeDecimal(productGroup.reduce((sum, g) => sum + Number(g._sum.lineTotal || 0), 0))
  const treatmentOmzet = normalizeDecimal(treatmentGroup.reduce((sum, g) => sum + Number(g._sum.lineTotal || 0), 0))

  const productItems = await prisma.transactionItem.findMany({
    where: { type: 'PRODUCT', transaction: whereTxProduct },
    include: { transaction: true }
  })
  const categoryTotals: Record<string, number> = {}
  for (const it of productItems) {
    const catId = it.transaction.categoryId
    if (!catId) continue
    categoryTotals[catId] = (categoryTotals[catId] || 0) + Number(it.lineTotal)
  }
  const categories = await prisma.customerCategory.findMany({
    where: { id: { in: Object.keys(categoryTotals) } }
  })
  const productCategoryBreakdown = Object.entries(categoryTotals).map(([categoryId, omzet]) => {
    const cat = categories.find(c => c.id === categoryId)
    return {
      categoryId,
      categoryName: cat?.name || '-',
      categoryCode: cat?.code || '-',
      omzet: normalizeDecimal(omzet)
    }
  })

  const therapistIds = treatmentGroup.map(tg => tg.therapistId).filter(Boolean) as string[]
  const therapists = therapistIds.length ? await prisma.therapist.findMany({ where: { id: { in: therapistIds } } }) : []

  const treatmentTherapistBreakdown = treatmentGroup.map(tg => {
    const th = therapists.find(t => t.id === tg.therapistId)
    return {
      therapistId: tg.therapistId,
      therapistName: th?.name || '-',
      omzet: normalizeDecimal(tg._sum.lineTotal)
    }
  })

  const commissionTotalAgg = await prisma.therapistCommission.aggregate({
    where: { transactionItem: { transaction: whereTxProduct } },
    _sum: { amount: true }
  })

  return {
    productOmzet,
    treatmentOmzet,
    productByCategory: productCategoryBreakdown,
    treatmentByTherapist: treatmentTherapistBreakdown,
    commissionTotal: normalizeDecimal(commissionTotalAgg._sum.amount)
  }
}

export type CategoryInsightStats = {
  categoryId: string
  omzet: number
  modal: number
  profit: number
  margin: number
  qty: number
  contribution: number
  top3Qty: ProductPerformanceItem[]
  top3Omzet: ProductPerformanceItem[]
  lowestMargin: ProductPerformanceItem[]
  lossIndication: ProductPerformanceItem[]
}

export async function getProductCategoryDetails(
  categoryId: string, 
  totalProductOmzet: number,
  filters: ReportFilters
): Promise<CategoryInsightStats> {
  // 1. Build Where Clauses (Audit-Safe Snapshot)
  const whereTxBase: Prisma.TransactionWhereInput = {
    createdAt: { gte: filters.from, lte: filters.to },
  }
  // Apply Global Filters
  if (filters.memberId) whereTxBase.memberId = filters.memberId
  if (filters.paymentMethod) whereTxBase.paymentMethod = filters.paymentMethod
  
  // Force Category Filter
  const whereTxProduct: Prisma.TransactionWhereInput = { 
    ...whereTxBase,
    categoryId: categoryId 
  }

  const whereItem: Prisma.TransactionItemWhereInput = {
      transaction: whereTxProduct,
      type: 'PRODUCT',
      ...(filters.therapistId ? { therapistId: filters.therapistId } : {})
  }

  // 2. Aggregate Stats
  const stats = await prisma.transactionItem.aggregate({
    where: whereItem,
    _sum: {
      lineTotal: true,
      profit: true,
      qty: true
    }
  })

  const omzet = normalizeDecimal(stats._sum.lineTotal)
  const profit = normalizeDecimal(stats._sum.profit)
  const qty = stats._sum.qty || 0
  const modal = normalizeDecimal(omzet - profit)
  const margin = omzet !== 0 ? normalizeDecimal((profit / omzet) * 100) : 0
  const contribution = totalProductOmzet > 0 ? normalizeDecimal((omzet / totalProductOmzet) * 100) : 0

  // 3. Product Performance Breakdown
  const productGroups = await prisma.transactionItem.groupBy({
    by: ['productId'],
    where: {
      ...whereItem,
      productId: { not: null }
    },
    _sum: {
      qty: true,
      lineTotal: true,
      profit: true
    }
  })

  // Resolve Product Names
  const productIds = productGroups.map(g => g.productId).filter(Boolean) as string[]
  const products = productIds.length ? await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true }
  }) : []
  const productMap = new Map(products.map(p => [p.id, p.name]))

  const performanceItems: ProductPerformanceItem[] = productGroups.map(g => {
    const pOmzet = normalizeDecimal(g._sum.lineTotal)
    const pProfit = normalizeDecimal(g._sum.profit)
    const pQty = g._sum.qty || 0
    const pMargin = pOmzet !== 0 ? normalizeDecimal((pProfit / pOmzet) * 100) : 0
    
    return {
      productId: g.productId!,
      productName: productMap.get(g.productId!) || 'Unknown Product',
      qty: pQty,
      omzet: pOmzet,
      profit: pProfit,
      margin: pMargin
    }
  })

  // 4. Sort and Slice
  const top3Omzet = [...performanceItems].sort((a, b) => b.omzet - a.omzet).slice(0, 3)
  const top3Qty = [...performanceItems].sort((a, b) => b.qty - a.qty).slice(0, 3)
  
  // Lowest Margin (threshold e.g. < 20% or just bottom 3)
  // Req says "Produk Margin Terendah (alert jika < threshold)".
  // We return bottom 3 regardless, UI can decide to alert.
  const lowestMargin = [...performanceItems].sort((a, b) => a.margin - b.margin).slice(0, 3)
  
  // Loss Indication
  const lossIndication = performanceItems.filter(p => p.profit < 0).sort((a, b) => a.profit - b.profit)

  return {
    categoryId,
    omzet,
    modal,
    profit,
    margin,
    qty,
    contribution,
    top3Qty,
    top3Omzet,
    lowestMargin,
    lossIndication
  }
}

export async function getTransactionDetails(transactionId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      items: {
        include: {
          product: true,
          treatment: true,
          therapist: true,
          assistant: true,
          commission: true
        }
      },
      member: true,
      category: true,
      cashier: true
    }
  })

  if (!transaction) return null

  // Normalize Decimals
  return {
    ...transaction,
    subtotal: normalizeDecimal(transaction.subtotal),
    discountTotal: normalizeDecimal(transaction.discountTotal),
    total: normalizeDecimal(transaction.total),
    paidAmount: normalizeDecimal(transaction.paidAmount),
    changeAmount: normalizeDecimal(transaction.changeAmount),
    items: transaction.items.map(item => ({
      ...item,
      unitPrice: normalizeDecimal(item.unitPrice),
      lineSubtotal: normalizeDecimal(item.lineSubtotal),
      lineDiscount: normalizeDecimal(item.lineDiscount),
      lineTotal: normalizeDecimal(item.lineTotal),
      profit: normalizeDecimal(item.profit),
      appliedDiscounts: (item as any).appliedDiscounts // Pass through JSON
    }))
  }
}
