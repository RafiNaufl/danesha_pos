'use client'

import React, { useEffect, useState } from 'react'
import { PosProvider, usePos } from './components/pos-provider'
import { ProductGrid } from './components/product-grid'
import { CartView } from './components/cart-view'
import { MemberSearch } from './components/member-search'
import { CheckoutDialog } from './components/checkout-dialog'
import { Product, Treatment, Therapist, CustomerCategory, ProductPrice } from '@prisma/client'
import { Search, ShoppingBag, User, X, Settings, LogOut, Home, Menu, LayoutGrid, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { logout } from '@/app/actions/logout'
import { cn } from '@/lib/utils'

import { Session } from 'next-auth'

type SerializedProductPrice = Omit<ProductPrice, 'price'> & { price: number }
type SerializedProduct = Omit<Product, 'costPrice'> & { 
  costPrice: number
  stock: number
  prices: SerializedProductPrice[] 
}

type SerializedTreatment = Omit<Treatment, 'costPrice' | 'sellPrice'> & { 
  costPrice: number
  sellPrice: number
}

type Props = {
  data: {
    products: SerializedProduct[]
    treatments: SerializedTreatment[]
    therapists: Therapist[]
    categories: CustomerCategory[]
  }
  session: Session | null
}

function PosLayout({ data, session }: Props) {
  const { state, dispatch, totals } = usePos()
  const [showMemberSearch, setShowMemberSearch] = useState(false)
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  // Use passed session, no need for useSession here as we pass it from server
  const isAdmin = session?.user?.role === 'ADMIN'

  // Initialize Data
  useEffect(() => {
    const defaultCat = data.categories.find(c => c.code === 'PASIEN') || data.categories[0]
    if (defaultCat) {
      dispatch({ type: 'SET_DATA', payload: { defaultCategory: defaultCat } })
    }
  }, [data.categories, dispatch])

  return (
    <div className="flex flex-col h-screen bg-neutral-50 dark:bg-neutral-950 overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans">
      {/* --- Desktop Header --- */}
      <header className="hidden min-[769px]:flex shrink-0 h-16 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 items-center px-6 gap-6 z-30 sticky top-0">
        <div className="font-bold text-xl tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          POS Danesha
        </div>
        
        {/* Search Bar */}
        <div className="flex-1 max-w-xl relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input 
            placeholder="Search products or treatments..." 
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 border-none outline-none focus:ring-2 focus:ring-blue-500/20 transition text-sm placeholder:text-neutral-400"
            value={state.searchQuery}
            onChange={(e) => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {/* Member Trigger */}
          <button 
            onClick={() => setShowMemberSearch(true)}
            className="flex items-center gap-2 px-4 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition group min-h-[48px]"
          >
            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <User size={14} strokeWidth={2.5} />
            </div>
            <span className="text-sm font-medium">
              {state.member ? state.member.name : 'Select Member'}
            </span>
          </button>

          <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800 mx-2" />

          {/* User Profile */}
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold">
              {session?.user?.name || 'User'}
            </span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
              isAdmin 
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
                : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
            )}>
              {session?.user?.role || 'KASIR'}
            </span>
          </div>

          {/* Admin Link */}
          {isAdmin && (
            <Link
              href="/dashboard"
              className="p-2.5 rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition min-w-[48px] min-h-[48px] flex items-center justify-center"
              title="Backoffice"
            >
              <Settings size={20} />
            </Link>
          )}

          {/* Logout */}
          <button
            onClick={() => logout()}
            className="p-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition min-w-[48px] min-h-[48px] flex items-center justify-center"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* --- Mobile Top Bar --- */}
      <header className="min-[769px]:hidden shrink-0 h-14 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 flex items-center px-4 gap-3 z-30 sticky top-0">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-blue-600/20">
          PD
        </div>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
          <input 
            placeholder="Search..." 
            className="w-full h-9 pl-9 pr-4 rounded-full bg-neutral-100 dark:bg-neutral-800 border-none outline-none focus:ring-2 focus:ring-blue-500/20 transition text-sm"
            value={state.searchQuery}
            onChange={(e) => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
          />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden pb-20 min-[769px]:pb-0">
          {/* Mobile Segmented Control */}
          <div className="shrink-0 p-4 pb-0 min-[769px]:hidden">
             <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
               {(['PRODUCT', 'TREATMENT'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => dispatch({ type: 'SET_TAB', payload: tab })}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all min-h-[48px]",
                      state.activeTab === tab 
                        ? "bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-white" 
                        : "text-neutral-500"
                    )}
                  >
                    {tab === 'PRODUCT' ? 'Products' : 'Treatments'}
                  </button>
               ))}
             </div>
          </div>

          {/* Desktop Tabs */}
          <div className="hidden min-[769px]:block shrink-0 px-6 pt-6 pb-2">
            <div className="flex gap-4 border-b border-neutral-200 dark:border-neutral-800">
              {(['PRODUCT', 'TREATMENT'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => dispatch({ type: 'SET_TAB', payload: tab })}
                  className={cn(
                    "px-4 py-3 text-sm font-semibold border-b-2 transition-colors",
                    state.activeTab === tab 
                      ? "border-blue-600 text-blue-600 dark:text-blue-400" 
                      : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  {tab === 'PRODUCT' ? 'Products' : 'Treatments'}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4 min-[769px]:p-6 scrollbar-hide">
            <ProductGrid 
              products={data.products} 
              treatments={data.treatments} 
              therapists={data.therapists} 
            />
          </div>
        </main>

        {/* Desktop Cart Sidebar */}
        <aside className="hidden min-[769px]:block w-[380px] shrink-0 h-full relative z-20 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800">
          <CartView />
        </aside>

        {/* Mobile Floating Cart Summary (Above Bottom Nav) */}
        {!mobileCartOpen && state.items.length > 0 && (
          <div className="min-[769px]:hidden absolute bottom-20 left-4 right-4 z-40 animate-in slide-in-from-bottom-4 duration-300">
            <button 
              onClick={() => setMobileCartOpen(true)}
              className="w-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 p-4 rounded-2xl shadow-xl shadow-neutral-900/10 flex items-center justify-between group min-h-[48px]"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 dark:bg-black/10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                  {state.items.length}
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-xs opacity-80">Total</span>
                  <span className="font-bold text-sm">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totals.total)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold">
                View Cart
                <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        )}

        {/* Mobile Cart Full Screen */}
        {mobileCartOpen && (
          <div className="min-[769px]:hidden fixed inset-0 z-50 bg-white dark:bg-neutral-950 flex flex-col animate-in slide-in-from-bottom duration-300">
             <div className="p-4 border-b dark:border-neutral-800 flex items-center justify-between bg-white dark:bg-neutral-900 sticky top-0 z-10">
               <h2 className="font-bold text-lg">Cart ({state.items.length})</h2>
               <button onClick={() => setMobileCartOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition min-w-[48px] min-h-[48px] flex items-center justify-center">
                 <X size={24}/>
               </button>
             </div>
             <div className="flex-1 overflow-hidden">
               <CartView />
             </div>
          </div>
        )}

        {/* Mobile Menu Modal */}
        {mobileMenuOpen && (
          <div className="min-[769px]:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setMobileMenuOpen(false)}>
            <div className="absolute bottom-0 inset-x-0 bg-white dark:bg-neutral-900 rounded-t-3xl p-6 pb-24 animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
                  {session?.user?.name?.[0] || 'U'}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{session?.user?.name || 'User'}</h3>
                  <span className="text-sm text-neutral-500">{session?.user?.role || 'KASIR'}</span>
                </div>
              </div>

              <div className="space-y-2">
                {isAdmin && (
                  <Link href="/dashboard" className="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 transition min-h-[48px]">
                    <Settings className="text-neutral-500" size={20} />
                    <span className="font-medium">Backoffice Dashboard</span>
                  </Link>
                )}
                <button 
                  onClick={() => logout()}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/10 text-red-600 hover:bg-red-100 transition min-h-[48px]"
                >
                  <LogOut size={20} />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- Mobile Bottom Navigation --- */}
      <nav className="min-[769px]:hidden fixed bottom-0 inset-x-0 h-16 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 flex justify-around items-center z-50 pb-safe">
        <button 
          onClick={() => { setMobileCartOpen(false); setMobileMenuOpen(false); }}
          className={cn("flex flex-col items-center gap-1 p-2 rounded-xl transition min-w-[48px] min-h-[48px] justify-center", !mobileCartOpen && !mobileMenuOpen ? "text-blue-600" : "text-neutral-400")}
        >
          <Home size={24} strokeWidth={!mobileCartOpen && !mobileMenuOpen ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Home</span>
        </button>

        <button 
          onClick={() => setShowMemberSearch(true)}
          className="flex flex-col items-center gap-1 p-2 rounded-xl text-neutral-400 hover:text-blue-600 transition min-w-[48px] min-h-[48px] justify-center"
        >
          <User size={24} strokeWidth={2} />
          <span className="text-[10px] font-medium">Member</span>
        </button>

        <button 
          onClick={() => { setMobileCartOpen(true); setMobileMenuOpen(false); }}
          className={cn("flex flex-col items-center gap-1 p-2 rounded-xl transition relative min-w-[48px] min-h-[48px] justify-center", mobileCartOpen ? "text-blue-600" : "text-neutral-400")}
        >
          <div className="relative">
            <ShoppingBag size={24} strokeWidth={mobileCartOpen ? 2.5 : 2} />
            {state.items.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-neutral-900">
                {state.items.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">Cart</span>
        </button>

        <button 
          onClick={() => { setMobileMenuOpen(true); setMobileCartOpen(false); }}
          className={cn("flex flex-col items-center gap-1 p-2 rounded-xl transition min-w-[48px] min-h-[48px] justify-center", mobileMenuOpen ? "text-blue-600" : "text-neutral-400")}
        >
          <Menu size={24} strokeWidth={mobileMenuOpen ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Menu</span>
        </button>
      </nav>

      {/* Modals */}
      {showMemberSearch && (
        <MemberSearch 
          onClose={() => setShowMemberSearch(false)} 
          categories={data.categories}
        />
      )}
      <CheckoutDialog />
    </div>
  )
}

export default function PosClient({ data, session }: Props) {
  return (
    <PosProvider>
      <PosLayout data={data} session={session} />
    </PosProvider>
  )
}
