'use client'

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { DiscountType, ItemType, Product, Treatment, Therapist, CustomerCategory, ProductPrice, Member } from '@prisma/client'

// --- Types ---

export type CartItem = {
  // Unique ID for the cart entry (e.g. timestamp + random)
  id: string
  type: ItemType
  // Source data
  productId?: string
  treatmentId?: string
  name: string
  // Price details
  basePrice: number // The original unit price for the category
  price: number // The effective unit price (usually same as basePrice unless manually overridden, but we usually stick to basePrice)
  // Quantity
  qty: number
  // Discount
  discountType?: DiscountType
  discountValue?: number
  // Treatment specific
  therapistId?: string
  therapistName?: string // For display
  assistantId?: string
  assistantName?: string
  // Metadata for re-calculation
  product?: any
  treatment?: any
}

export type PosState = {
  items: CartItem[]
  member: (Member & { category: CustomerCategory | null }) | null
  category: CustomerCategory | null
  defaultCategory: CustomerCategory | null
  searchQuery: string
  activeTab: 'PRODUCT' | 'TREATMENT'
  isCheckoutOpen: boolean
}

type Action =
  | { type: 'SET_DATA'; payload: { defaultCategory: CustomerCategory } }
  | { type: 'ADD_ITEM'; payload: { item: CartItem } }
  | { type: 'UPDATE_ITEM'; payload: { id: string; updates: Partial<CartItem> } }
  | { type: 'REMOVE_ITEM'; payload: { id: string } }
  | { type: 'SET_MEMBER'; payload: (Member & { category: CustomerCategory | null }) | null }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_TAB'; payload: 'PRODUCT' | 'TREATMENT' }
  | { type: 'TOGGLE_CHECKOUT'; payload: boolean }
  | { type: 'CLEAR_CART' }

// --- Helper: Calculate Price ---
function getPrice(
  prices: ProductPrice[],
  categoryId: string
): number {
  const p = prices.find(p => p.categoryId === categoryId)
  return p ? Number(p.price) : 0
}

// --- Reducer ---

function posReducer(state: PosState, action: Action): PosState {
  switch (action.type) {
    case 'SET_DATA':
      return {
        ...state,
        defaultCategory: action.payload.defaultCategory,
        category: state.member?.category || action.payload.defaultCategory
      }

    case 'ADD_ITEM': {
      // Check if same item exists (same product/treatment AND same therapist if treatment)
      // Actually, for simplicity, let's just add new rows for treatments to allow different therapists.
      // For products, we can merge if no custom discounts yet.
      // For now, simple append is safer for "one-hand" quick usage, or maybe merge products.
      
      const newItem = action.payload.item
      const existingIdx = state.items.findIndex(i => 
        i.type === newItem.type && 
        ((i.type === 'PRODUCT' && i.productId === newItem.productId) || 
         (i.type === 'TREATMENT' && i.treatmentId === newItem.treatmentId && i.therapistId === newItem.therapistId && i.assistantId === newItem.assistantId))
      )

      if (existingIdx >= 0 && newItem.type === 'PRODUCT') {
        // Merge products
        const items = [...state.items]
        items[existingIdx].qty += newItem.qty
        return { ...state, items }
      }

      return { ...state, items: [...state.items, newItem] }
    }

    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map(i => i.id === action.payload.id ? { ...i, ...action.payload.updates } : i)
      }

    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(i => i.id !== action.payload.id) }

    case 'SET_MEMBER': {
      const member = action.payload
      // If member has category, use it. Else use default 'PASIEN' category.
      // We need to know the default category (passed in state or we assume it's set).
      const newCategory = member?.category || state.defaultCategory
      
      if (!newCategory) return { ...state, member } // Should not happen if data loaded

      // Re-calculate prices for all items in cart based on new category
      const updatedItems = state.items.map(item => {
        let newPrice = item.basePrice
        if (item.type === 'PRODUCT' && item.product) {
          newPrice = getPrice(item.product.prices, newCategory.id)
        }
        return { ...item, basePrice: newPrice, price: newPrice }
      })

      return {
        ...state,
        member,
        category: newCategory,
        items: updatedItems
      }
    }

    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload }

    case 'SET_TAB':
      return { ...state, activeTab: action.payload }

    case 'TOGGLE_CHECKOUT':
      return { ...state, isCheckoutOpen: action.payload }

    case 'CLEAR_CART':
      return { ...state, items: [], member: null, category: state.defaultCategory } // Reset category to default

    default:
      return state
  }
}

// --- Context ---

const PosContext = createContext<{
  state: PosState
  dispatch: React.Dispatch<Action>
  totals: { subtotal: number; discount: number; total: number }
} | null>(null)

export function PosProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(posReducer, {
    items: [],
    member: null,
    category: null,
    defaultCategory: null,
    searchQuery: '',
    activeTab: 'PRODUCT',
    isCheckoutOpen: false
  })

  // Calculate totals
  const totals = state.items.reduce((acc, item) => {
    const lineSubtotal = item.price * item.qty
    let lineDiscount = 0
    
    if (item.discountType === 'PERCENT') {
      lineDiscount = lineSubtotal * ((item.discountValue || 0) / 100)
    } else if (item.discountType === 'NOMINAL') {
      lineDiscount = (item.discountValue || 0) * item.qty // Assuming nominal is per item
    }

    const lineTotal = Math.max(0, lineSubtotal - lineDiscount)

    return {
      subtotal: acc.subtotal + lineSubtotal,
      discount: acc.discount + lineDiscount,
      total: acc.total + lineTotal
    }
  }, { subtotal: 0, discount: 0, total: 0 })

  return (
    <PosContext.Provider value={{ state, dispatch, totals }}>
      {children}
    </PosContext.Provider>
  )
}

export function usePos() {
  const ctx = useContext(PosContext)
  if (!ctx) throw new Error('usePos must be used within PosProvider')
  return ctx
}
