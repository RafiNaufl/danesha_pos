'use client'

import { useState } from 'react'
import { Product, ProductPrice, CustomerCategory } from '@prisma/client'
import { Plus, Search, Edit, X, Save, Trash2, Package } from 'lucide-react'
import { upsertProduct, deleteProduct } from '@/app/actions/admin/products'
import { adjustStock } from '@/app/actions/stock'
import { cn, formatMoney } from '@/lib/utils'

type SerializedProductPrice = Omit<ProductPrice, 'price'> & { price: number }
type ProductWithPrices = Omit<Product, 'costPrice'> & { 
  costPrice: number
  prices: SerializedProductPrice[]
  stock: number
}

type Props = {
  initialProducts: ProductWithPrices[]
  categories: CustomerCategory[]
}

export function ProductsClient({ initialProducts, categories }: Props) {
  const [products, setProducts] = useState(initialProducts)
  const [search, setSearch] = useState('')
  const [editingProduct, setEditingProduct] = useState<ProductWithPrices | null>(null)
  const [adjustingProduct, setAdjustingProduct] = useState<ProductWithPrices | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)

  // Filter products
  const filteredProducts = initialProducts.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleEdit = (product: ProductWithPrices) => {
    setEditingProduct(product)
    setIsSheetOpen(true)
  }

  const handleAdjust = (product: ProductWithPrices) => {
    setAdjustingProduct(product)
    setIsAdjustOpen(true)
  }

  const handleCreate = () => {
    setEditingProduct(null)
    setIsSheetOpen(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Produk</h1>
        <button 
          onClick={handleCreate}
          className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Cari produk (nama)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[48px]"
        />
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map(product => {
          const stockStatus = product.stock <= 0 
            ? { label: 'Habis', color: 'bg-red-100 text-red-600' }
            : product.stock <= 10 
              ? { label: 'Menipis', color: 'bg-yellow-100 text-yellow-700' }
              : { label: 'Aman', color: 'bg-green-100 text-green-600' }

          return (
          <div key={product.id} className="bg-white p-4 rounded-xl shadow-sm border flex justify-between items-start">
             <div>
                <h3 className="font-semibold">{product.name}</h3>
                <div className="mt-2 text-sm text-gray-600">
                   HPP: {formatMoney(Number(product.costPrice))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                   <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", stockStatus.color)}>
                     Stok: {product.stock} ({stockStatus.label})
                   </span>
                   {!product.active && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Inactive</span>}
                </div>
             </div>
             <div className="flex gap-1">
               <button onClick={() => handleAdjust(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full min-w-[48px] min-h-[48px] flex items-center justify-center" title="Atur Stok">
                 <Package className="h-4 w-4" />
               </button>
               <button onClick={() => handleEdit(product)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full min-w-[48px] min-h-[48px] flex items-center justify-center" title="Edit Produk">
                 <Edit className="h-4 w-4" />
               </button>
             </div>
          </div>
        )})}
      </div>

      {/* Stock Adjustment Modal */}
      {isAdjustOpen && adjustingProduct && (
        <StockAdjustmentForm 
          product={adjustingProduct}
          onClose={() => setIsAdjustOpen(false)}
        />
      )}

      {/* Edit Sheet */}
      {isSheetOpen && (
        <ProductForm 
           product={editingProduct} 
           categories={categories} 
           onClose={() => setIsSheetOpen(false)}
        />
      )}
    </div>
  )
}

function StockAdjustmentForm({ product, onClose }: { product: ProductWithPrices, onClose: () => void }) {
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
        await adjustStock({
            productId: product.id,
            quantity: Number(quantity),
            note
        })
        onClose()
    } catch (e: any) {
        alert(e.message)
    } finally {
        setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-md rounded-xl p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
         <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Sesuaikan Stok</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="h-5 w-5" />
            </button>
         </div>

         <div className="mb-4">
            <h4 className="font-medium text-gray-900">{product.name}</h4>
            <p className="text-sm text-gray-500">Stok saat ini: {product.stock}</p>
         </div>

         <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Jumlah Penyesuaian (+/-)</label>
              <div className="text-xs text-gray-500 mb-2">
                 Contoh: +10 untuk tambah, -5 untuk kurangi (barang rusak/hilang)
              </div>
              <input 
                type="number"
                required
                className="w-full p-2 border rounded-lg"
                placeholder="0"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Catatan (Wajib)</label>
              <textarea 
                required
                className="w-full p-2 border rounded-lg"
                placeholder="Contoh: Barang rusak saat pengiriman"
                rows={3}
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-4">
               <button 
                 type="button"
                 onClick={onClose}
                 className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                 disabled={loading}
               >
                 Batal
               </button>
               <button 
                 type="submit"
                 className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                 disabled={loading}
               >
                 {loading ? 'Menyimpan...' : 'Simpan'}
               </button>
            </div>
         </form>
      </div>
    </div>
  )
}

function ProductForm({ product, categories, onClose }: { product: ProductWithPrices | null, categories: CustomerCategory[], onClose: () => void }) {
  const [formData, setFormData] = useState({
     name: product?.name || '',
     costPrice: product?.costPrice.toString() || '0',
     active: product?.active ?? true,
     prices: categories.map(cat => ({
       categoryId: cat.id,
       categoryName: cat.name,
       price: product?.prices.find(p => p.categoryId === cat.id)?.price.toString() || '0'
     }))
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await upsertProduct({
        id: product?.id,
        name: formData.name,
        costPrice: Number(formData.costPrice),
        active: formData.active,
        prices: formData.prices.map(p => ({
          categoryId: p.categoryId,
          price: Number(p.price)
        }))
      })
      onClose()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
     if (!product?.id) return
     if (!confirm('Hapus produk ini?')) return
     setLoading(true)
     try {
       await deleteProduct(product.id)
       onClose()
     } catch (e: any) {
       alert(e.message)
     } finally {
       setLoading(false)
     }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-lg h-[90vh] sm:h-auto sm:max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-xl p-6 animate-in slide-in-from-bottom-full duration-300">
         <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">{product ? 'Edit Produk' : 'Tambah Produk'}</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="h-5 w-5" />
            </button>
         </div>

         <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nama Produk</label>
              <input 
                required
                className="w-full p-2 border rounded-lg"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">HPP (Modal)</label>
                <input 
                  type="number"
                  required
                  className="w-full p-2 border rounded-lg"
                  value={formData.costPrice}
                  onChange={e => setFormData({...formData, costPrice: e.target.value})}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 py-2">
               <input 
                 type="checkbox"
                 id="active"
                 checked={formData.active}
                 onChange={e => setFormData({...formData, active: e.target.checked})}
                 className="h-4 w-4 text-blue-600 rounded"
               />
               <label htmlFor="active" className="text-sm font-medium">Aktif (Tampil di POS)</label>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3">Harga Jual per Kategori</h4>
              <div className="space-y-3">
                {formData.prices.map((price, idx) => (
                  <div key={price.categoryId}>
                    <label className="block text-xs text-gray-500 mb-1">{price.categoryName}</label>
                    <input 
                      type="number"
                      required
                      className="w-full p-2 border rounded-lg"
                      value={price.price}
                      onChange={e => {
                        const newPrices = [...formData.prices]
                        newPrices[idx].price = e.target.value
                        setFormData({...formData, prices: newPrices})
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-6">
               {product && (
                 <button 
                   type="button"
                   onClick={handleDelete}
                   className="flex-1 py-3 border border-red-200 text-red-600 rounded-xl hover:bg-red-50"
                   disabled={loading}
                 >
                   {loading ? '...' : 'Hapus'}
                 </button>
               )}
               <button 
                 type="submit"
                 className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
                 disabled={loading}
               >
                 {loading ? 'Menyimpan...' : 'Simpan'}
               </button>
            </div>
         </form>
      </div>
    </div>
  )
}
