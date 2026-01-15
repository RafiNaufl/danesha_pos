import { describe, it, expect } from 'vitest'
import { calculateDiscount, isDiscountActive, DiscountInfo } from './discount-utils'
import { DiscountType } from '@prisma/client'

describe('Discount Utils', () => {
  describe('isDiscountActive', () => {
    it('should return false if discount is null or undefined', () => {
      expect(isDiscountActive(null)).toBe(false)
      expect(isDiscountActive(undefined)).toBe(false)
    })

    it('should return false if discount is inactive', () => {
      const discount: DiscountInfo = {
        type: 'PERCENT',
        value: 10,
        isActive: false,
        startDate: new Date(),
        endDate: new Date()
      }
      expect(isDiscountActive(discount)).toBe(false)
    })

    it('should return false if date is before start date', () => {
      const start = new Date()
      start.setDate(start.getDate() + 1) // Tomorrow
      const end = new Date()
      end.setDate(end.getDate() + 2)
      
      const discount: DiscountInfo = {
        type: 'PERCENT',
        value: 10,
        isActive: true,
        startDate: start,
        endDate: end
      }
      expect(isDiscountActive(discount)).toBe(false)
    })

    it('should return false if date is after end date', () => {
      const start = new Date()
      start.setDate(start.getDate() - 2)
      const end = new Date()
      end.setDate(end.getDate() - 1) // Yesterday
      
      const discount: DiscountInfo = {
        type: 'PERCENT',
        value: 10,
        isActive: true,
        startDate: start,
        endDate: end
      }
      expect(isDiscountActive(discount)).toBe(false)
    })

    it('should return true if date is within range', () => {
      const start = new Date()
      start.setDate(start.getDate() - 1)
      const end = new Date()
      end.setDate(end.getDate() + 1)
      
      const discount: DiscountInfo = {
        type: 'PERCENT',
        value: 10,
        isActive: true,
        startDate: start,
        endDate: end
      }
      expect(isDiscountActive(discount)).toBe(true)
    })
  })

  describe('calculateDiscount', () => {
    it('should return base price if discount is invalid', () => {
      const result = calculateDiscount(10000, null)
      expect(result).toEqual({ finalPrice: 10000, discountAmount: 0 })
    })

    it('should calculate PERCENT discount correctly', () => {
      const discount: DiscountInfo = {
        type: 'PERCENT',
        value: 20, // 20%
        isActive: true,
        startDate: new Date('2000-01-01'),
        endDate: new Date('2099-01-01')
      }
      const result = calculateDiscount(100000, discount)
      expect(result.discountAmount).toBe(20000)
      expect(result.finalPrice).toBe(80000)
    })

    it('should calculate NOMINAL discount correctly', () => {
      const discount: DiscountInfo = {
        type: 'NOMINAL',
        value: 15000,
        isActive: true,
        startDate: new Date('2000-01-01'),
        endDate: new Date('2099-01-01')
      }
      const result = calculateDiscount(100000, discount)
      expect(result.discountAmount).toBe(15000)
      expect(result.finalPrice).toBe(85000)
    })

    it('should cap discount at base price (no negative price)', () => {
      const discount: DiscountInfo = {
        type: 'NOMINAL',
        value: 150000,
        isActive: true,
        startDate: new Date('2000-01-01'),
        endDate: new Date('2099-01-01')
      }
      const result = calculateDiscount(100000, discount)
      expect(result.discountAmount).toBe(100000)
      expect(result.finalPrice).toBe(0)
    })

    it('should return 0 discount if inactive', () => {
      const discount: DiscountInfo = {
        type: 'PERCENT',
        value: 50,
        isActive: false,
        startDate: new Date('2000-01-01'),
        endDate: new Date('2099-01-01')
      }
      const result = calculateDiscount(100000, discount)
      expect(result.discountAmount).toBe(0)
      expect(result.finalPrice).toBe(100000)
    })
  })
})
