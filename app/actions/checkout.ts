'use server'

import { prisma } from '@/app/lib/prisma'
import { Prisma, DiscountType, ItemType } from '@prisma/client'
import { getCategoryByCode, getDefaultCommissionPercent, getProductUnitPrice, getTreatmentPrice } from '@/app/actions/pricing'
import { calcLineTotals } from '@/app/lib/calculations'
import { revalidatePath } from 'next/cache'

type CheckoutItemInput = {
  type: 'PRODUCT' | 'TREATMENT'
  productId?: string
  treatmentId?: string
  therapistId?: string
  qty: number
  discountType?: DiscountType
  discountValue?: string | number
}

type CheckoutInput = {
  memberCode?: string
  categoryCode?: string
  items: CheckoutItemInput[]
  paymentMethod: string
  paidAmount: number
  checkoutSessionId: string
}

function genTxNumber() {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

import { auth } from '@/app/lib/auth'

export async function checkout(input: CheckoutInput, cashierId: string) {
  // INVARIANT: Harga tidak pernah diambil dari client. Semua harga dihitung server-side.
  // INVARIANT: Diskon tidak otomatis dari tabel Discount; hanya dari input checkout.
  // PRICE SOURCE OF TRUTH: server-side pricing only (anti tampering)
  const AUTO_DISCOUNT_ENABLED = false as const
  if (AUTO_DISCOUNT_ENABLED) throw new Error('Auto discount is disabled by design')

  // Idempotent checkout — safe for retry, refresh, double click
  // ENUM GUARD: Status transaksi yang diizinkan (tanpa ubah schema)
  const ALLOWED_STATUS = ['PAID'] as const
  const session = await auth()
  const finalCashierId = session?.user?.id || cashierId
  if (!input.items?.length) throw new Error('Cart empty')
  if (!input.checkoutSessionId) throw new Error('Session required')
  const member = input.memberCode ? await prisma.member.findUnique({ where: { memberCode: input.memberCode } }) : null
  const category = member ? await prisma.customerCategory.findUnique({ where: { id: member.categoryId } }) : await getCategoryByCode(input.categoryCode || 'PASIEN')
  if (!category) throw new Error('Category required')
  // Invariant: transaction.categoryId === member.categoryId (if member exists)
  if (member && category.id !== member.categoryId) throw new Error('Invariant violated: Member category mismatch')
  const settingsPercent = await getDefaultCommissionPercent()

  const existing = await prisma.transaction.findUnique({
    where: ({ checkoutSessionId: input.checkoutSessionId } as any),
    include: {
      items: { include: { product: true, treatment: true, therapist: true } },
      member: true,
      category: true
    }
  }) as any
  if (existing) {
    return {
      id: existing.id,
      number: existing.number,
      subtotal: existing.subtotal,
      discountTotal: existing.discountTotal,
      total: existing.total,
      costTotal: existing.costTotal,
      profitTotal: existing.profitTotal,
      commissionTotal: existing.commissionTotal,
      changeAmount: existing.changeAmount,
      createdAt: existing.createdAt,
      categoryCode: existing.category.code,
      memberCode: existing.member?.memberCode,
      memberName: existing.member?.name,
      items: existing.items.map((i: any) => ({
        id: i.id,
        type: i.type,
        name: i.product?.name || i.treatment?.name || 'Unknown',
        qty: i.qty,
        unitPrice: i.unitPrice,
        discountType: i.discountType,
        discountValue: i.discountValue,
        lineSubtotal: i.lineSubtotal,
        lineDiscount: i.lineDiscount,
        lineTotal: i.lineTotal,
        therapistName: i.therapist?.name || null
      })),
      info: { discountAppliedToTotalQty: true, message: 'Diskon diterapkan ke TOTAL qty, bukan per item' }
    }
  }

  try {
  const result = await prisma.$transaction(async tx => {
    const number = genTxNumber()
    let subtotal = new Prisma.Decimal(0)
    let discountTotal = new Prisma.Decimal(0)
    let total = new Prisma.Decimal(0)
    let costTotal = new Prisma.Decimal(0)
    let profitTotal = new Prisma.Decimal(0)
    let commissionTotal = new Prisma.Decimal(0)

    // Prepare transaction items data first to calculate totals before creating transaction
    const txItemsData = []

    const productQuantities: Record<string, number> = {}
    for (const it of input.items) {
      if (it.type === 'PRODUCT' && it.productId) {
        productQuantities[it.productId] = (productQuantities[it.productId] || 0) + it.qty
      }
    }
    // OPTIMIZED STOCK VALIDATION: Use groupBy to avoid fetching thousands of movement rows
    const productIds = Object.keys(productQuantities)
    if (productIds.length) {
      // Lock rows to prevent race conditions
      await tx.$executeRaw(Prisma.sql`SELECT id FROM "Product" WHERE id IN (${Prisma.join(productIds)}) FOR UPDATE`)

      // Calculate stock using aggregation (faster than fetching all rows)
      const stockAggregations = await tx.stockMovement.groupBy({
        by: ['productId', 'type'],
        where: { productId: { in: productIds } },
        _sum: { quantity: true }
      })

      const stockMap = new Map<string, number>()
      for (const agg of stockAggregations) {
        const qty = agg._sum.quantity || 0
        const pid = agg.productId
        const currentStock = stockMap.get(pid) || 0
        
        // Formula: (IN + ADJUST) - (OUT + SALE)
        if (agg.type === 'IN' || agg.type === 'ADJUST') {
          stockMap.set(pid, currentStock + qty)
        } else {
          stockMap.set(pid, currentStock - qty)
        }
      }

      for (const pid of productIds) {
        const available = stockMap.get(pid) || 0
        const required = productQuantities[pid]
        if (required > available) {
            // Fetch product name for better error message
            const p = await tx.product.findUnique({ where: { id: pid }, select: { name: true } })
            throw new Error(`Stock tidak cukup untuk produk ${p?.name || pid}. Tersedia: ${available}, Diminta: ${required}`)
        }
      }
    }

    for (const it of input.items) {
      // Guard: Quantity must be positive
      if (it.qty <= 0) throw new Error('Quantity must be positive')
      if (it.type === 'TREATMENT' && !it.therapistId) throw new Error('Therapist required for treatment')
      if (it.type === 'PRODUCT' && !it.productId) throw new Error('Product required')
      if (it.type === 'TREATMENT' && !it.treatmentId) throw new Error('Treatment required')

      if (it.type === 'PRODUCT') {
        const product = await tx.product.findUnique({ where: { id: it.productId! } })
        if (!product) throw new Error('Product not found')
        // GUARD: Product inactive → tidak bisa dijual
        if (!product.active) throw new Error(`Produk ${product.name} sudah tidak aktif`)
        const unitPrice = await getProductUnitPrice(product.id, category.id)
        const discountType = it.discountType ?? null
        const discountValue = new Prisma.Decimal(it.discountValue ?? 0)
        if (discountValue.lessThan(0)) throw new Error('Invalid discount: negative')
        const { subtotal: ls, lineDiscount: ld, lineTotal: lt, costTotal: lc, profit: lp } = calcLineTotals(unitPrice, it.qty, discountType, discountValue, product.costPrice)
        if (ld.greaterThanOrEqualTo(ls)) throw new Error('Invalid discount: exceeds or equals item price')
        if (lt.lessThanOrEqualTo(0)) throw new Error('Invalid final price: must be greater than 0')
        subtotal = subtotal.add(ls)
        discountTotal = discountTotal.add(ld)
        total = total.add(lt)
        costTotal = costTotal.add(lc)
        profitTotal = profitTotal.add(lp)

        txItemsData.push({
            type: ItemType.PRODUCT,
            productId: product.id,
            qty: it.qty,
            unitPrice,
            discountType,
            discountValue,
            lineSubtotal: ls,
            lineDiscount: ld,
            lineTotal: lt,
            costPrice: product.costPrice,
            profit: lp,
        })
      } else {
        // CLARITY: Treatment tidak menggunakan kategori untuk harga.
        // Category is stored for audit only; treatment pricing ignores category
        // categoryId tetap disimpan di Transaction untuk konsistensi audit, namun tidak mempengaruhi harga treatment.
        const treatment = await tx.treatment.findUnique({ where: { id: it.treatmentId! } })
        if (!treatment) throw new Error('Treatment not found')
        const therapist = await tx.therapist.findUnique({ where: { id: it.therapistId! } })
        if (!therapist || !therapist.active) throw new Error('Therapist sudah tidak aktif, silakan pilih ulang')
        const unitPrice = await getTreatmentPrice(treatment.id)
        const discountType = it.discountType ?? null
        const discountValue = new Prisma.Decimal(it.discountValue ?? 0)
        if (discountValue.lessThan(0)) throw new Error('Invalid discount: negative')
        const { subtotal: ls, lineDiscount: ld, lineTotal: lt, costTotal: lc, profit: lp } = calcLineTotals(unitPrice, it.qty, discountType, discountValue, treatment.costPrice)
        if (ld.greaterThanOrEqualTo(ls)) throw new Error('Invalid discount: exceeds or equals item price')
        if (lt.lessThanOrEqualTo(0)) throw new Error('Invalid final price: must be greater than 0')
        subtotal = subtotal.add(ls)
        discountTotal = discountTotal.add(ld)
        total = total.add(lt)
        costTotal = costTotal.add(lc)
        profitTotal = profitTotal.add(lp)

        const percent = settingsPercent
        // Commission calculated from discounted lineTotal (snapshot, audit-safe)
        const amount = lt.mul(percent).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        if (amount.lessThan(0)) throw new Error('Invalid commission: negative')
        commissionTotal = commissionTotal.add(amount)

        txItemsData.push({
            type: ItemType.TREATMENT,
            treatmentId: treatment.id,
            therapistId: it.therapistId!,
            qty: it.qty,
            unitPrice,
            discountType,
            discountValue,
            lineSubtotal: ls,
            lineDiscount: ld,
            lineTotal: lt,
            costPrice: treatment.costPrice,
            profit: lp,
            commission: {
                create: {
                    therapistId: it.therapistId!,
                    percent,
                    amount,
                    commissionBaseAmount: lt,
                    commissionPercent: percent,
                    commissionAmount: amount,
                }
            }
        })
      }
    }

    const paidAmount = new Prisma.Decimal(input.paidAmount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    const changeAmount = paidAmount.sub(total).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)

    subtotal = subtotal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    discountTotal = discountTotal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    total = total.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    costTotal = costTotal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    profitTotal = profitTotal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    commissionTotal = commissionTotal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)

    let t: any
    try {
      t = await tx.transaction.create({
      data: ({
        number,
        checkoutSessionId: input.checkoutSessionId,
        cashierId: finalCashierId,
        memberId: member?.id || null,
        categoryId: category.id,
        // ENUM GUARD: set status eksplisit untuk mencegah typo dan future-refactor
        status: 'PAID',
        subtotal,
        discountTotal,
        total,
        costTotal,
        profitTotal,
        commissionTotal,
        paymentMethod: input.paymentMethod,
        paidAmount,
        changeAmount,
        items: {
            create: txItemsData
        }
      } as any),
      include: {
        items: {
          include: { product: true, treatment: true, therapist: true }
        }
      }
    })
    } catch (e: any) {
      if (e?.code === 'P2002') {
        const dupe = await tx.transaction.findUnique({
          where: ({ checkoutSessionId: input.checkoutSessionId } as any),
          include: { items: { include: { product: true, treatment: true, therapist: true } }, member: true, category: true }
        }) as any
        if (dupe) {
          return {
            id: dupe.id,
            number: dupe.number,
            subtotal: Number(dupe.subtotal),
            discountTotal: Number(dupe.discountTotal),
            total: Number(dupe.total),
            costTotal: Number(dupe.costTotal),
            profitTotal: Number(dupe.profitTotal),
            commissionTotal: Number(dupe.commissionTotal),
            changeAmount: Number(dupe.changeAmount),
            createdAt: dupe.createdAt,
            categoryCode: dupe.category.code,
            memberCode: dupe.member?.memberCode,
            memberName: dupe.member?.name,
            items: dupe.items.map((i: any) => ({
              id: i.id,
              type: i.type,
              name: i.product?.name || i.treatment?.name || 'Unknown',
              qty: i.qty,
              unitPrice: Number(i.unitPrice),
              discountType: i.discountType,
              discountValue: Number(i.discountValue),
              lineSubtotal: Number(i.lineSubtotal),
              lineDiscount: Number(i.lineDiscount),
              lineTotal: Number(i.lineTotal),
              therapistName: i.therapist?.name || null
            })),
            info: { discountAppliedToTotalQty: true, message: 'Diskon diterapkan ke TOTAL qty, bukan per item' }
          }
        }
      }
      // Handle Foreign Key Constraint Violation (e.g., Invalid Cashier ID)
      if (e?.code === 'P2003') {
        // P2003: Foreign key constraint failed on the field: `...`
        const msg = e.message || ''
        const meta = e.meta || {}
        if (msg.includes('Transaction_cashierId_fkey') || meta.field_name === 'Transaction_cashierId_fkey' || msg.includes('cashierId')) {
           throw new Error('Session invalid: Cashier account not found. Please logout and login again.')
        }
      }
      throw e
    }

    // Handle Stock Movements after transaction creation
    for (const item of t.items as any[]) {
        if (item.type === ItemType.PRODUCT && item.productId) {
            // SNAPSHOT SAFETY: unitCost harus dari snapshot TransactionItem.costPrice, bukan Product.costPrice live.
            if (item.costPrice === null || item.costPrice === undefined) throw new Error('Invariant failed: missing snapshot costPrice')
            
            await tx.stockMovement.create({
                data: {
                    productId: item.productId,
                    transactionId: t.id,
                    type: 'SALE',
                    quantity: item.qty,
                    unitCost: item.costPrice,
                    note: number,
                    userId: finalCashierId, // Audit: Track which cashier made the sale
                } as any,
            })
        }
    }

    // ENUM GUARD: Pastikan status transaksi valid
    const statusVal = (t as any).status
    if (typeof statusVal === 'string' && !(ALLOWED_STATUS as readonly string[]).includes(statusVal)) {
      throw new Error('Invalid transaction status')
    }

    if (total.lessThanOrEqualTo(0)) throw new Error('Invalid transaction: total must be greater than 0')

    return {
      id: t.id,
      number,
      subtotal: subtotal.toNumber(),
      discountTotal: discountTotal.toNumber(),
      total: total.toNumber(),
      costTotal: costTotal.toNumber(),
      profitTotal: profitTotal.toNumber(),
      commissionTotal: commissionTotal.toNumber(),
      changeAmount: changeAmount.toNumber(),
      createdAt: t.createdAt,
      categoryCode: category.code,
      memberCode: member?.memberCode,
      memberName: member?.name,
      items: (t.items as any[]).map((i: any) => ({
        id: i.id,
        type: i.type,
        name: i.product?.name || i.treatment?.name || 'Unknown',
        qty: i.qty,
        unitPrice: Number(i.unitPrice),
        discountType: i.discountType,
        discountValue: Number(i.discountValue),
        lineSubtotal: Number(i.lineSubtotal),
        lineDiscount: Number(i.lineDiscount),
        lineTotal: Number(i.lineTotal),
        therapistName: i.therapist?.name || null
      })),
      info: { discountAppliedToTotalQty: true, message: 'Diskon diterapkan ke TOTAL qty, bukan per item' }
    }
  })
  
  // Revalidate POS and Dashboard to update stock and reports
  revalidatePath('/dashboard/pos')
  revalidatePath('/dashboard') 
  revalidatePath('/products')

  return result
  } catch (error: any) {
    try {
      await (prisma as any).checkoutFailure.create({
        data: {
          reason: String(error?.message || 'Unknown error'),
          payload: {
            memberCode: input.memberCode || null,
            categoryCode: input.categoryCode || null,
            itemsCount: input.items?.length || 0,
            paymentMethod: input.paymentMethod,
            paidAmount: input.paidAmount,
            checkoutSessionId: input.checkoutSessionId
          }
        }
      })
    } catch {}
    throw error
  }
}
