'use client'

import React, { useState } from 'react'
import { usePos, CartItem } from './pos-provider'
import { Trash2, Minus, Plus, Tag, User, ChevronDown } from 'lucide-react'
import { DiscountType } from '@prisma/client'

function formatMoney(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}

export function CartView() {
  const { state, dispatch, totals } = usePos()
  const [editingItem, setEditingItem] = useState<CartItem | null>(null)

  const handleUpdateItem = (updates: Partial<CartItem>) => {
    if (!editingItem) return
    dispatch({
      type: 'UPDATE_ITEM',
      payload: { id: editingItem.id, updates }
    })
    setEditingItem({ ...editingItem, ...updates })
  }

  const handleRemove = () => {
    if (!editingItem) return
    dispatch({ type: 'REMOVE_ITEM', payload: { id: editingItem.id } })
    setEditingItem(null)
  }

  return (
    <>
      <div className="flex flex-col h-full bg-white dark:bg-neutral-950 border-l border-neutral-200 dark:border-neutral-800">
        {/* Cart Header / Member Info */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-lg">Current Order</h2>
          </div>
          
          {state.member ? (
            <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-lg border border-blue-100 dark:border-blue-800">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                {state.member.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-blue-900 dark:text-blue-100 truncate">{state.member.name}</div>
                <div className="text-xs text-blue-600 dark:text-blue-300">{state.category?.name || 'Unknown Category'}</div>
              </div>
              <button 
                onClick={() => dispatch({ type: 'SET_MEMBER', payload: null })}
                className="text-xs text-blue-500 hover:text-blue-700 min-h-[48px] px-2 flex items-center"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="bg-neutral-100 dark:bg-neutral-800 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-center text-sm text-gray-500">
              Guest / Pasien Umum
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {state.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <div className="mb-2">🛒</div>
              <p className="text-sm">Cart is empty</p>
            </div>
          ) : (
            state.items.map((item) => {
              const originalTotal = item.basePrice * item.qty
              const discountAmount = item.discountType === 'PERCENT' 
                ? originalTotal * ((item.discountValue || 0) / 100)
                : (item.discountValue || 0) * item.qty
              const finalTotal = Math.max(0, originalTotal - discountAmount)

              return (
                <div 
                  key={item.id} 
                  onClick={() => setEditingItem(item)}
                  className="group relative flex flex-col gap-1 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-primary-200 dark:hover:border-primary-900 cursor-pointer transition shadow-sm min-h-[48px]"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{item.name}</div>
                      {item.type === 'TREATMENT' && (
                        <div className="flex items-center gap-1 text-xs text-purple-600 mt-0.5">
                          <User size={10} />
                          <span>{item.therapistName}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end">
                      {originalTotal > finalTotal && (
                        <span className="text-xs text-gray-400 line-through">{formatMoney(originalTotal)}</span>
                      )}
                      <div className={`font-semibold text-sm ${originalTotal > finalTotal ? 'text-red-600' : ''}`}>{formatMoney(finalTotal)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <span className="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-gray-600">x{item.qty}</span>
                      <span>@ {formatMoney(item.basePrice)}</span>
                    </div>
                    {item.discountValue ? (
                      <div className="text-orange-500 flex items-center gap-1">
                        <Tag size={10} />
                        <span>-{item.discountType === 'PERCENT' ? `${item.discountValue}%` : formatMoney(Number(item.discountValue))}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer Totals */}
        <div className="p-4 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="space-y-2 mb-4 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>{formatMoney(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Discount</span>
                <span>-{formatMoney(totals.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg text-gray-900 dark:text-gray-100 pt-2 border-t border-dashed border-gray-200">
              <span>Total</span>
              <span>{formatMoney(totals.total)}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                if (confirm('Are you sure you want to reset the transaction?')) {
                  dispatch({ type: 'CLEAR_CART' })
                }
              }}
              disabled={state.items.length === 0}
              className="w-12 h-12 rounded-xl bg-red-500 text-white font-bold shadow-lg shadow-red-500/20 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center hover:bg-red-600"
              title="Reset Transaction"
            >
              <Trash2 size={20} />
            </button>
            <button
              onClick={() => dispatch({ type: 'TOGGLE_CHECKOUT', payload: true })}
              disabled={state.items.length === 0}
              className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Process Payment
            </button>
          </div>
        </div>
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-200">
            <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="font-semibold">Edit Item</h3>
              <button onClick={() => handleRemove()} className="text-red-500 p-2 hover:bg-red-50 rounded-lg">
                <Trash2 size={18} />
              </button>
            </div>
            
            <div className="p-5 space-y-5">
              {/* Quantity */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Quantity</label>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => handleUpdateItem({ qty: Math.max(1, editingItem.qty - 1) })}
                    className="w-12 h-12 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition"
                  >
                    <Minus size={20} />
                  </button>
                  <div className="flex-1 text-center font-bold text-2xl">{editingItem.qty}</div>
                  <button 
                    onClick={() => handleUpdateItem({ qty: editingItem.qty + 1 })}
                    className="w-12 h-12 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              {/* Discount */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Discount</label>
                <div className="flex gap-2 mb-2">
                  <button 
                    onClick={() => handleUpdateItem({ discountType: 'PERCENT', discountValue: 0 })}
                    className={`flex-1 py-2 text-sm rounded-lg border ${editingItem.discountType === 'PERCENT' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'border-neutral-200 text-gray-600'}`}
                  >
                    % Percent
                  </button>
                  <button 
                    onClick={() => handleUpdateItem({ discountType: 'NOMINAL', discountValue: 0 })}
                    className={`flex-1 py-2 text-sm rounded-lg border ${editingItem.discountType === 'NOMINAL' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'border-neutral-200 text-gray-600'}`}
                  >
                    Rp Nominal
                  </button>
                </div>
                <div className="relative">
                  <input 
                    type="number"
                    value={editingItem.discountValue || ''}
                    onChange={(e) => handleUpdateItem({ discountValue: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full h-12 pl-4 pr-4 rounded-xl border border-neutral-200 outline-none focus:border-primary-500 text-lg font-medium"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    {editingItem.discountType === 'PERCENT' ? '%' : 'IDR'}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-100 dark:border-neutral-800">
              <button 
                onClick={() => setEditingItem(null)}
                className="w-full h-12 rounded-xl bg-black text-white font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
