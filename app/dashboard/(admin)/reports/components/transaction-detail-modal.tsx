'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatMoney, cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Loader2, X, CreditCard, Tag, User } from 'lucide-react'
import { getTransactionDetails } from '@/app/actions/reports'

interface TransactionDetailModalProps {
  isOpen: boolean
  onClose: () => void
  transactionId: string | null
}

export function TransactionDetailModal({ isOpen, onClose, transactionId }: TransactionDetailModalProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    if (isOpen && transactionId) {
      fetchDetails()
    } else {
      setData(null)
    }
  }, [isOpen, transactionId])

  const fetchDetails = async () => {
    if (!transactionId) return
    setLoading(true)
    try {
      const detail = await getTransactionDetails(transactionId)
      setData(detail)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(
        // Mobile: Bottom Sheet style
        "fixed bottom-0 left-0 right-0 top-auto z-50 flex h-[85vh] w-full max-w-none flex-col gap-0 rounded-t-xl rounded-b-none border-b-0 bg-background p-0 shadow-lg outline-none",
        "translate-x-0 translate-y-0", // Override center positioning
        "data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full", // Mobile animation
        
        // Desktop: Restore Centered Modal style
        "sm:fixed sm:left-[50%] sm:top-[50%] sm:z-50 sm:grid sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-2xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:gap-0 sm:rounded-lg sm:border sm:bg-background sm:shadow-lg",
        "sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]" // Restore desktop animation
      )}>
        <div className="p-4 sm:p-6 sticky top-0 bg-white z-10 border-b flex justify-between items-start rounded-t-xl">
          <div className="flex-1">
            {/* Drag handle for mobile visual cue */}
            <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200 mb-4 sm:hidden" />
            
            <DialogTitle className="text-xl font-bold">Detail Transaksi</DialogTitle>
            {data && (
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                #{data.number} • {format(new Date(data.createdAt), 'dd MMMM yyyy, HH:mm')}
              </DialogDescription>
            )}
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="-mt-2 -mr-2 rounded-full">
              <X className="h-5 w-5" />
            </Button>
          </DialogClose>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : data ? (
            <>
              {/* Status & Method */}
              <div className="flex flex-wrap gap-4 justify-between items-center bg-slate-50 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                   <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      data.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                   }`}>
                      {data.status}
                   </div>
                   <div className="text-sm font-medium text-slate-600 flex items-center gap-1">
                      <CreditCard size={14} />
                      {data.paymentMethod}
                   </div>
                </div>
                <div className="text-right">
                   <div className="text-xs text-muted-foreground">Total Pembayaran</div>
                   <div className="text-xl font-bold text-blue-600">{formatMoney(data.total)}</div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                   <Tag size={16} /> Item Transaksi
                </h3>
                <div className="border rounded-lg overflow-x-auto">
                   <table className="w-full text-sm min-w-[500px] sm:min-w-0">
                      <thead className="bg-slate-100 border-b text-xs uppercase text-slate-500 font-medium">
                         <tr>
                            <th className="px-2 sm:px-4 py-2 text-left">Item</th>
                            <th className="px-2 sm:px-4 py-2 text-center">Qty</th>
                            <th className="px-2 sm:px-4 py-2 text-right">Harga</th>
                            <th className="px-2 sm:px-4 py-2 text-right">Diskon</th>
                            <th className="px-2 sm:px-4 py-2 text-right">Total</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y">
                         {data.items.map((item: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                               <td className="px-2 sm:px-4 py-3">
                                  <div className="font-medium">
                                     {item.product?.name || item.treatment?.name || 'Unknown'}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                     {item.therapist ? (
                                        <span className="flex items-center gap-1">
                                           <User size={10} /> {item.therapist.name}
                                           {item.assistant && <span className="text-slate-400">(Asst: {item.assistant.name})</span>}
                                        </span>
                                     ) : item.type}
                                  </div>
                                  {/* Detailed Discounts if any */}
                                  {item.appliedDiscounts && Array.isArray(item.appliedDiscounts) && item.appliedDiscounts.length > 0 && (
                                     <div className="mt-1 space-y-0.5">
                                        {item.appliedDiscounts.map((d: any, i: number) => (
                                           <div key={i} className="text-[10px] text-orange-600 flex items-center gap-1 bg-orange-50 w-fit px-1.5 py-0.5 rounded">
                                              <span>🏷️ {d.label || d.source}</span>
                                              <span>-{formatMoney(d.value)}</span>
                                           </div>
                                        ))}
                                     </div>
                                  )}
                               </td>
                               <td className="px-2 sm:px-4 py-3 text-center">{item.qty}</td>
                               <td className="px-2 sm:px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatMoney(item.unitPrice)}</td>
                               <td className="px-2 sm:px-4 py-3 text-right text-red-600 whitespace-nowrap">
                                  {item.lineDiscount > 0 ? `-${formatMoney(item.lineDiscount)}` : '-'}
                               </td>
                               <td className="px-2 sm:px-4 py-3 text-right font-medium whitespace-nowrap">{formatMoney(item.lineTotal)}</td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
              </div>

              {/* Summary */}
              <div className="flex justify-end">
                 <div className="w-full sm:w-1/2 space-y-2 text-sm">
                    <div className="flex justify-between">
                       <span className="text-muted-foreground">Subtotal</span>
                       <span>{formatMoney(data.subtotal)}</span>
                    </div>
                    {data.discountTotal > 0 && (
                       <div className="flex justify-between text-red-600">
                          <span>Total Diskon</span>
                          <span>-{formatMoney(data.discountTotal)}</span>
                       </div>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2">
                       <span>Total</span>
                       <span>{formatMoney(data.total)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-xs pt-1">
                       <span>Dibayar ({data.paymentMethod})</span>
                       <span>{formatMoney(data.paidAmount)}</span>
                    </div>
                    {data.changeAmount > 0 && (
                       <div className="flex justify-between text-slate-500 text-xs">
                          <span>Kembali</span>
                          <span>{formatMoney(data.changeAmount)}</span>
                       </div>
                    )}
                 </div>
              </div>

              {/* Footer Info */}
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 flex flex-col sm:flex-row justify-between gap-2">
                 <div>
                    <span className="font-semibold">Kasir:</span> {data.cashier?.name || 'Unknown'}
                 </div>
                 <div>
                    <span className="font-semibold">Member:</span> {data.member?.name || '-'}
                 </div>
                 <div>
                    <span className="font-semibold">Kategori:</span> {data.category?.name || '-'}
                 </div>
              </div>

            </>
          ) : (
             <div className="text-center py-8 text-muted-foreground">Gagal memuat detail transaksi</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
