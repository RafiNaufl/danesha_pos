'use client'

import React, { useState, useEffect } from 'react'
import { usePos } from './pos-provider'
import { X, Check, Printer, Loader2, Banknote, ArrowRightLeft, QrCode } from 'lucide-react'
import { checkout } from '@/app/actions/checkout'
import ReceiptPrint from '@/app/components/ReceiptPrint'
import { printerService } from '@/lib/printer/bluetooth'
import { useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { useSession } from 'next-auth/react'

function formatMoney(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}

export function CheckoutDialog() {
  const { data: session } = useSession()
  const { state, dispatch, totals } = usePos()
  const [paymentMethod, setPaymentMethod] = useState('')
  const [selectedBank, setSelectedBank] = useState('')
  const [paidAmount, setPaidAmount] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [successTx, setSuccessTx] = useState<any>(null)
  const [printWidth, setPrintWidth] = useState<58 | 80>(58)
  
  // Calculate change
  const change = Math.max(0, paidAmount - totals.total)
  const canPay = paidAmount >= totals.total && paymentMethod !== '' && (paymentMethod !== 'TRANSFER' || selectedBank !== '')

  // Reset state when opening
  useEffect(() => {
    if (state.isCheckoutOpen) {
      setPaymentMethod('')
      setSelectedBank('')
      setPaidAmount(0)
      setSuccessTx(null)
    }
  }, [state.isCheckoutOpen])

  const handleProcess = async () => {
    if (!canPay) return
    setLoading(true)
    try {
      const finalPaymentMethod = paymentMethod === 'TRANSFER' ? `TRANSFER - ${selectedBank}` : paymentMethod
      const input = {
        memberCode: state.member?.memberCode,
        categoryCode: state.category?.code,
        items: state.items.map(i => ({
            type: i.type,
            productId: i.productId,
            treatmentId: i.treatmentId,
            therapistId: i.therapistId,
            assistantId: i.assistantId,
            qty: i.qty,
            discountType: i.discountType,
            discountValue: i.discountValue
          })),
        paymentMethod: finalPaymentMethod,
        paidAmount,
        checkoutSessionId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36)
      }

      // @ts-ignore
      const res = await checkout(input, 'SYSTEM') // TODO: Pass actual cashier ID
      setSuccessTx(res)
      // Don't close immediately, show success screen
    } catch (error: any) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBluetoothPrint = async (tx: any) => {
    try {
      const receiptData = {
        storeName: 'Danesha Clinic',
        storeAddress: 'Jl. Contoh No. 123', // TODO: Get from settings
        transactionId: tx.number,
        date: new Date(tx.createdAt).toLocaleString('id-ID'),
        cashierName: session?.user?.name || 'Staff',
        subtotal: Number(tx.subtotal),
        tax: 0, // Tax handling if any
        total: Number(tx.total),
        footerMessage: 'Terima kasih atas kunjungan Anda',
        items: (tx.items || []).map((i: any) => ({
          name: i.name,
          quantity: i.qty,
          price: Number(i.unitPrice),
          total: Number(i.lineTotal)
        }))
      };
      
      await printerService.printReceipt(receiptData);
    } catch (e) {
      console.error('Print failed', e);
      alert('Failed to print via Bluetooth');
    }
  };

  const handleClose = () => {
    if (successTx) {
      dispatch({ type: 'CLEAR_CART' })
    }
    dispatch({ type: 'TOGGLE_CHECKOUT', payload: false })
  }

  const [isPrinting, setIsPrinting] = useState(false)

  const handlePrint = async () => {
    setIsPrinting(true)
    try {
      const isConnected = await printerService.isConnected()
      
      if (isConnected) {
        await handleBluetoothPrint(successTx)
      } else {
        if (Capacitor.isNativePlatform()) {
          alert('Printer belum terhubung. Silakan hubungkan printer melalui tombol printer di pojok kanan atas.')
        } else {
          window.print()
        }
      }
    } catch (e) {
      console.error('Print check failed', e)
      alert('Gagal memproses permintaan cetak')
    } finally {
      setIsPrinting(false)
    }
  }

  if (!state.isCheckoutOpen) return null

  if (successTx) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-white dark:bg-black animate-in fade-in duration-300">
        <div className="w-full max-w-md p-6 text-center">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={40} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
          <p className="text-gray-500 mb-8">Transaction {successTx.number}</p>
          
          <div className="bg-neutral-50 dark:bg-neutral-900 p-4 rounded-xl mb-6 space-y-2">
            <div className="flex justify-between text-sm"><span>Total Paid</span><span className="font-semibold">{formatMoney(Number(successTx.total))}</span></div>
            <div className="flex justify-between text-sm"><span>Change</span><span className="font-semibold text-green-600">{formatMoney(Number(successTx.changeAmount))}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={handlePrint} 
              disabled={isPrinting}
              className="flex items-center justify-center gap-2 h-12 rounded-xl border border-neutral-200 hover:bg-neutral-50 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPrinting ? <Loader2 className="animate-spin" size={20} /> : <Printer size={20} />}
              {isPrinting ? 'Mencetak...' : 'Cetak Struk'}
            </button>
            <button 
              onClick={handleClose} 
              className="h-12 rounded-xl bg-black text-white font-bold hover:bg-neutral-800 transition"
            >
              Transaksi Baru
            </button>
          </div>

          <div className="mt-4 flex justify-center gap-2 text-xs">
             <span className="text-gray-500 py-1">Paper Size:</span>
             <button onClick={() => setPrintWidth(58)} className={`px-3 py-1 rounded border ${printWidth===58 ? 'bg-black text-white border-black' : 'text-gray-600 border-gray-200'}`}>58mm</button>
             <button onClick={() => setPrintWidth(80)} className={`px-3 py-1 rounded border ${printWidth===80 ? 'bg-black text-white border-black' : 'text-gray-600 border-gray-200'}`}>80mm</button>
          </div>

          <div className="hidden print:block fixed top-0 left-0">
             <ReceiptPrint
               width={printWidth}
               store={{ name: 'Danesha Clinic', address: 'Jl. Contoh No. 123', phone: '08123456789' }}
               tx={{
                 number: successTx.number,
                 createdAt: new Date(successTx.createdAt),
                 categoryCode: successTx.categoryCode,
                 memberCode: successTx.memberCode,
                 memberName: successTx.memberName
               }}
               items={(successTx.items || []).map((i: any) => ({
                 name: i.name,
                 qty: i.qty,
                 unitPrice: formatMoney(Number(i.unitPrice)),
                 finalLine: formatMoney(Number(i.lineTotal)),
                 discountLabel: i.discountType ? (i.discountType === 'PERCENT' ? `${Number(i.discountValue)}%` : `${formatMoney(Number(i.discountValue))}`) : undefined,
                 therapistName: i.therapistName ? (i.assistantName ? `${i.therapistName} & ${i.assistantName}` : i.therapistName) : undefined
               }))}
               totals={{
                 subtotal: formatMoney(Number(successTx.subtotal)),
                 discount: formatMoney(Number(successTx.discountTotal)),
                 total: formatMoney(Number(successTx.total))
               }}
             />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900">
          <h2 className="font-bold text-lg">Payment</h2>
          <button onClick={handleClose} className="p-2 hover:bg-neutral-200 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Amount Display */}
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-1">Total Amount</div>
            <div className="text-4xl font-bold text-gray-900 dark:text-gray-100">{formatMoney(totals.total)}</div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-3 block">Payment Method</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'CASH', label: 'Cash', icon: Banknote },
                { id: 'TRANSFER', label: 'Transfer', icon: ArrowRightLeft },
                { id: 'QRIS', label: 'QRIS', icon: QrCode }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    setPaymentMethod(m.id)
                    if (m.id !== 'TRANSFER') setSelectedBank('')
                  }}
                  className={`h-20 rounded-xl border-2 font-semibold transition flex flex-col items-center justify-center gap-2 ${
                    paymentMethod === m.id
                      ? 'border-primary bg-primary/10 text-primary' 
                      : 'border-neutral-100 bg-white hover:border-neutral-200 text-gray-600'
                  }`}
                >
                  <m.icon size={24} />
                  <span className="text-sm">{m.label}</span>
                </button>
              ))}
            </div>

            {/* Bank Selection */}
            {paymentMethod === 'TRANSFER' && (
              <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="text-xs font-bold text-gray-500 uppercase mb-3 block">Select Bank</label>
                <div className="grid grid-cols-2 gap-3">
                  {['BCA', 'Mandiri', 'BRI', 'Shopee'].map(bank => (
                    <button
                      key={bank}
                      onClick={() => setSelectedBank(bank)}
                      className={`h-12 rounded-xl border-2 font-medium transition ${
                        selectedBank === bank
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-neutral-100 bg-white text-gray-600 hover:border-neutral-200'
                      }`}
                    >
                      {bank}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Paid Amount */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-3 block">Cash Received</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">Rp</span>
              <input
                type="number"
                autoFocus
                value={paidAmount || ''}
                onChange={(e) => setPaidAmount(parseFloat(e.target.value))}
                placeholder="0"
                className="w-full h-16 pl-12 pr-4 rounded-xl border-2 border-neutral-200 outline-none focus:border-primary text-2xl font-bold bg-neutral-50 focus:bg-white transition"
              />
            </div>
            
            {/* Quick Suggestions */}
            <div className="flex gap-2 mt-3 overflow-x-auto pb-2 scrollbar-hide">
              {[totals.total, 50000, 100000, 200000].map((amt) => {
                 if (amt < totals.total && amt !== totals.total) return null
                 return (
                  <button
                    key={amt}
                    onClick={() => setPaidAmount(amt)}
                    className="px-4 py-2 rounded-lg bg-neutral-100 text-sm font-medium hover:bg-neutral-200 whitespace-nowrap min-h-[48px]"
                  >
                    {formatMoney(amt)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Change Display */}
          <div className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-xl flex justify-between items-center">
            <span className="font-medium text-gray-600">Change / Kembali</span>
            <span className={`text-xl font-bold ${change < 0 ? 'text-red-500' : 'text-green-600'}`}>
              {formatMoney(change)}
            </span>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <button
            onClick={handleProcess}
            disabled={!canPay || loading}
            className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-lg shadow-primary/20 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
