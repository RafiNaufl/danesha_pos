'use client'

import React, { useEffect, useRef } from 'react'

type ReceiptItem = {
  name: string
  qty: number
  unitPrice: string
  lineSubtotal?: string
  discountLabel?: string
  lineDiscount?: string
  appliedDiscounts?: { label: string; value: string }[]
  finalLine: string
  therapistName?: string
}

type Props = {
  width: 58 | 80
  store: { name: string; address?: string | null; phone?: string | null; footerMessage?: string | null }
  tx: { number: string; createdAt: Date; categoryCode: string; categoryName?: string; memberCode?: string | null; memberName?: string | null; paymentMethod?: string }
  items: ReceiptItem[]
  totals: { subtotal: string; discount: string; total: string }
  autoPrint?: boolean
}

export default function ReceiptPrint({ width, store, tx, items, totals, autoPrint }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  
  const baseSize = width === 58 ? 'text-[10px]' : 'text-[12px]'
  const smallSize = width === 58 ? 'text-[9px]' : 'text-[10px]'
  const headerSize = width === 58 ? 'text-xs' : 'text-sm'

  useEffect(() => {
    if (autoPrint) setTimeout(() => window.print(), 300)
  }, [autoPrint])

  return (
    <div className="p-4 flex justify-center">
      <style>{`
        @media print { 
          body { background: white; margin: 0; padding: 0; }
          @page { margin: 0; size: auto; }
          .no-print { display: none !important; }
          .print-container { width: 100% !important; display: block !important; }
        }
        .ticket { width: ${width}mm; margin: 0 auto; }
        .ticket pre { white-space: pre-wrap }
      `}</style>
      <div ref={ref} className={`ticket ${baseSize} leading-[1.2] text-black font-mono`}>
        <div className="text-center mb-2">
          <div className={`font-bold ${headerSize} uppercase`}>{store.name}</div>
          {store.address && <div className={smallSize}>{store.address}</div>}
          {store.phone && <div className={smallSize}>Tel: {store.phone}</div>}
        </div>
        
        <div className="border-b border-black border-dashed my-2" />
        
        <div className={`grid grid-cols-2 gap-1 ${smallSize}`}>
          <div>No: {tx.number}</div>
          <div className="text-right">{new Date(tx.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</div>
          <div>Kat: {tx.categoryName || tx.categoryCode}</div>
          {tx.paymentMethod && <div>Metode: {tx.paymentMethod}</div>}
          {tx.memberCode && <div className="col-span-2">{tx.memberCode} {tx.memberName ? `- ${tx.memberName}` : ''}</div>}
        </div>

        <div className="border-b border-black border-dashed my-2" />

        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i}>
              <div className="flex justify-between font-semibold">
                <span>{it.name}</span>
              </div>
              <div className={`flex justify-between ${smallSize}`}>
                 <span>{it.qty} x {it.unitPrice}</span>
                 <span>{it.lineSubtotal || it.finalLine}</span>
              </div>
              
              {it.appliedDiscounts && it.appliedDiscounts.length > 0 ? (
                <>
                  {it.appliedDiscounts.map((d, idx) => (
                    <div key={idx} className={`flex justify-between ${smallSize} italic`}>
                       <span>{d.label}</span>
                       <span>-{d.value}</span>
                    </div>
                  ))}
                  <div className={`flex justify-between ${smallSize} font-bold`}>
                     <span>Total</span>
                     <span>{it.finalLine}</span>
                  </div>
                </>
              ) : it.discountLabel ? (
                <>
                  <div className={`flex justify-between ${smallSize} italic`}>
                     <span>{it.discountLabel}</span>
                     <span>-{it.lineDiscount}</span>
                  </div>
                  <div className={`flex justify-between ${smallSize} font-bold`}>
                     <span>Total</span>
                     <span>{it.finalLine}</span>
                  </div>
                </>
              ) : null}

              {it.therapistName && <div className={`${smallSize} text-gray-600`}>Th: {it.therapistName}</div>}
            </div>
          ))}
        </div>

        <div className="border-b border-black border-dashed my-2" />

        <div className={`space-y-1 ${smallSize}`}>
          <div className="flex justify-between"><span>Subtotal</span><span>{totals.subtotal}</span></div>
          {totals.discount !== 'Rp 0' && (
             <div className="flex justify-between"><span>Diskon Total</span><span>{totals.discount}</span></div>
          )}
          <div className={`flex justify-between font-bold ${headerSize} mt-1`}><span>Total Akhir</span><span>{totals.total}</span></div>
        </div>

        <div className={`mt-4 text-center ${smallSize}`}>
          <div>{store.footerMessage || 'Terima kasih atas kunjungan Anda'}</div>
          <div>Barang yang sudah dibeli tidak dapat ditukar/dikembalikan</div>
        </div>
      </div>
    </div>
  )
}
