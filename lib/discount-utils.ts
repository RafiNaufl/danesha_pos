import type { DiscountType } from '@prisma/client'

export interface DiscountInfo {
  type: DiscountType | 'PERCENT' | 'NOMINAL'
  value: number
  isActive: boolean
  startDate: Date | string
  endDate: Date | string
}

/**
 * Checks if a discount is currently active based on isActive flag and date range.
 */
export const isDiscountActive = (discount: DiscountInfo | null | undefined): boolean => {
  if (!discount || !discount.isActive) return false
  
  const now = new Date()
  const start = new Date(discount.startDate)
  const end = new Date(discount.endDate)
  
  // Reset time to start of day for comparison if needed, but usually exact time is preferred.
  // Assuming start/end dates from DB might include time.
  // If strict date-only is needed, we would strip time. 
  // For now, simple comparison.
  
  return now >= start && now <= end
}

/**
 * Calculates the final price and discount amount.
 * Caps discount at base price (no negative prices).
 */
export const calculateDiscount = (basePrice: number, discount: DiscountInfo | null | undefined) => {
  if (!isDiscountActive(discount)) {
    return { finalPrice: basePrice, discountAmount: 0 }
  }

  // Safe check, though isDiscountActive covers it
  if (!discount) return { finalPrice: basePrice, discountAmount: 0 }

  let discountAmount = 0
  // Handle string or number value (just in case of serialization issues)
  const val = Number(discount.value)
  
  if (discount.type === 'PERCENT') {
    discountAmount = basePrice * (val / 100)
  } else {
    discountAmount = val
  }

  // Ensure discount doesn't exceed price
  if (discountAmount > basePrice) discountAmount = basePrice
  
  const finalPrice = basePrice - discountAmount

  return { finalPrice, discountAmount }
}
