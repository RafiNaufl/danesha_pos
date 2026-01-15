'use client'

import React, { useState } from 'react'
import { Product, Treatment, Therapist, ProductPrice } from '@prisma/client'
import { usePos } from './pos-provider'
import { Plus, User } from 'lucide-react'
import { cn } from "@/lib/utils"
import { calculateDiscount } from '@/lib/discount-utils'

type SerializedProductPrice = Omit<ProductPrice, 'price'> & { price: number }
type SerializedProduct = Omit<Product, 'costPrice'> & { 
  costPrice: number
  stock: number
  prices: SerializedProductPrice[] 
  discount?: {
    type: 'PERCENT' | 'NOMINAL'
    value: number
    isActive: boolean
    startDate: Date | string
    endDate: Date | string
  } | null
}

type SerializedTreatment = Omit<Treatment, 'costPrice' | 'sellPrice'> & { 
  costPrice: number
  sellPrice: number
  discount?: {
    type: 'PERCENT' | 'NOMINAL'
    value: number
    isActive: boolean
    startDate: Date | string
    endDate: Date | string
  } | null
}

type Props = {
  products: SerializedProduct[]
  treatments: SerializedTreatment[]
  therapists: Therapist[]
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}

export function ProductGrid({ products, treatments, therapists }: Props) {
  const { state, dispatch } = usePos()
  const [selectedTreatment, setSelectedTreatment] = useState<SerializedTreatment | null>(null)

  // Filter items
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(state.searchQuery.toLowerCase())
  )
  const filteredTreatments = treatments.filter(t => 
    t.name.toLowerCase().includes(state.searchQuery.toLowerCase())
  )

  const getPrice = (prices: SerializedProductPrice[]) => {
    const catId = state.category?.id
    if (!catId) return 0
    const p = prices.find(pr => pr.categoryId === catId)
    return p ? p.price : 0
  }

  const handleProductClick = (product: SerializedProduct) => {
    const basePrice = getPrice(product.prices)
    const { finalPrice, discountAmount } = calculateDiscount(basePrice, product.discount)
    const hasValidDiscount = discountAmount > 0
    
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        item: {
          id: Date.now().toString() + Math.random().toString(),
          type: 'PRODUCT',
          productId: product.id,
          name: product.name,
          basePrice: basePrice,
          price: basePrice, // Store base price, discount is calculated in provider
          qty: 1,
          product,
          discountType: hasValidDiscount ? product.discount?.type : undefined,
          discountValue: hasValidDiscount ? product.discount?.value : undefined
        }
      }
    })
  }

  const handleTreatmentClick = (treatment: SerializedTreatment) => {
    setSelectedTreatment(treatment)
  }

  const confirmTherapist = (therapist: Therapist) => {
    if (!selectedTreatment) return
    const basePrice = selectedTreatment.sellPrice
    const { finalPrice, discountAmount } = calculateDiscount(basePrice, selectedTreatment.discount)
    const hasValidDiscount = discountAmount > 0
    
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        item: {
          id: Date.now().toString() + Math.random().toString(),
          type: 'TREATMENT',
          treatmentId: selectedTreatment.id,
          name: selectedTreatment.name,
          basePrice: basePrice,
          price: basePrice,
          qty: 1,
          therapistId: therapist.id,
          therapistName: therapist.name,
          treatment: selectedTreatment,
          discountType: hasValidDiscount ? selectedTreatment.discount?.type : undefined,
          discountValue: hasValidDiscount ? selectedTreatment.discount?.value : undefined
        }
      }
    })
    setSelectedTreatment(null)
  }

  return (
    <>
      <div className="grid grid-cols-2 min-[769px]:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-20 min-[769px]:pb-0">
        {state.activeTab === 'PRODUCT' ? (
          filteredProducts.map(product => {
            const basePrice = getPrice(product.prices)
            const { finalPrice, discountAmount } = calculateDiscount(basePrice, product.discount)
            const hasDiscount = discountAmount > 0
            const isOutOfStock = product.stock <= 0

            return (
              <button
                key={product.id}
                onClick={() => !isOutOfStock && handleProductClick(product)}
                disabled={isOutOfStock}
                className={cn(
                  "relative flex flex-col text-left rounded-xl bg-white dark:bg-neutral-900 shadow-sm transition p-3 border border-neutral-100 dark:border-neutral-800 overflow-hidden",
                  isOutOfStock ? "opacity-60 cursor-not-allowed" : "active:scale-[0.98] hover:border-primary/50"
                )}
              >
                {hasDiscount && !isOutOfStock && (
                   <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-xl z-10">
                     {product.discount?.type === 'PERCENT' ? `${product.discount.value}% OFF` : 'DISKON'}
                   </div>
                )}
                {isOutOfStock && (
                   <div className="absolute top-0 right-0 bg-neutral-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-xl z-10">
                     HABIS
                   </div>
                )}
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-2 min-h-[2.5em]">{product.name}</div>
                <div className="text-[10px] font-medium text-neutral-500 mt-1">Stok: {product.stock}</div>
                <div className="mt-auto flex items-end justify-between w-full">
                  <div className="flex flex-col">
                    {hasDiscount && (
                      <span className="text-xs text-gray-400 line-through">{formatMoney(basePrice)}</span>
                    )}
                    <div className={cn("text-sm font-bold", hasDiscount ? "text-red-600" : "text-primary")}>
                      {formatMoney(finalPrice)}
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1">
                    <Plus size={14} />
                  </div>
                </div>
              </button>
            )
          })
        ) : (
          filteredTreatments.map(treatment => {
            const basePrice = treatment.sellPrice
            const { finalPrice, discountAmount } = calculateDiscount(basePrice, treatment.discount)
            const hasDiscount = discountAmount > 0

            return (
              <button
                key={treatment.id}
                onClick={() => handleTreatmentClick(treatment)}
                className="relative flex flex-col text-left rounded-xl bg-white dark:bg-neutral-900 shadow-sm active:scale-[0.98] transition p-3 border border-neutral-100 dark:border-neutral-800 hover:border-purple-500/50 overflow-hidden"
              >
                {hasDiscount && (
                   <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-xl z-10">
                     {treatment.discount?.type === 'PERCENT' ? `${treatment.discount.value}% OFF` : 'DISKON'}
                   </div>
                )}
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-2 min-h-[2.5em]">{treatment.name}</div>
                <div className="text-xs text-purple-600 mt-1 mb-2 bg-purple-50 w-fit px-2 py-0.5 rounded-full">{treatment.duration} min</div>
                <div className="mt-auto flex items-end justify-between w-full">
                  <div className="flex flex-col">
                    {hasDiscount && (
                      <span className="text-xs text-gray-400 line-through">{formatMoney(basePrice)}</span>
                    )}
                    <div className={cn("text-sm font-bold", hasDiscount ? "text-red-600" : "text-gray-900 dark:text-gray-100")}>
                      {formatMoney(finalPrice)}
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mb-1">
                    <User size={14} />
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Therapist Selection Modal */}
      {selectedTreatment && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl md:rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-200">
            <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="font-semibold text-lg">Pilih Therapist</h3>
              <p className="text-sm text-gray-500">Untuk {selectedTreatment.name}</p>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              {therapists.map(therapist => (
                <button
                  key={therapist.id}
                  onClick={() => confirmTherapist(therapist)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 active:bg-neutral-100 transition text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-lg font-bold text-gray-600">
                    {therapist.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium">{therapist.name}</div>
                    <div className="text-xs text-green-600">Available</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-neutral-100 dark:border-neutral-800">
              <button 
                onClick={() => setSelectedTreatment(null)}
                className="w-full py-3 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
