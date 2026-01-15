'use client'

import { useState, useEffect } from 'react'
import type { DiscountType } from '@prisma/client'
import { Plus, Search, Edit, Trash2, Calendar, Tag, Percent, DollarSign, Check, X, Box, Stethoscope } from 'lucide-react'
import { upsertDiscount, deleteDiscount, toggleDiscountStatus, getDiscount } from '@/app/actions/admin/discounts'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const DISCOUNT_TYPES = ['PERCENT', 'NOMINAL'] as const

type Discount = {
  id: string
  name: string
  description: string | null
  type: DiscountType
  value: number
  startDate: Date
  endDate: Date
  isActive: boolean
  _count?: {
    products: number
    treatments: number
  }
  products?: { id: string, name: string }[]
  treatments?: { id: string, name: string }[]
}

type Product = { id: string, name: string }
type Treatment = { id: string, name: string }

type Props = {
  initialDiscounts: Discount[]
  products: Product[]
  treatments: Treatment[]
}

export function DiscountsClient({ initialDiscounts, products, treatments }: Props) {
  const [search, setSearch] = useState('')
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null)

  const filteredDiscounts = initialDiscounts.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = () => {
    setEditingDiscount(null)
    setIsSheetOpen(true)
  }

  const handleEdit = (d: Discount) => {
    setEditingDiscount(d)
    setIsSheetOpen(true)
  }

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      await toggleDiscountStatus(id, !currentStatus)
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cari diskon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[48px]"
          />
        </div>
        <button 
          onClick={handleCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2 font-medium min-h-[48px] min-w-[48px]"
        >
          <Plus className="h-5 w-5" />
          Buat Diskon
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Diskon</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Periode</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDiscounts.map((discount) => (
                <tr key={discount.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{discount.name}</div>
                    {discount.description && (
                      <div className="text-sm text-gray-500 truncate max-w-xs">{discount.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                      discount.type === 'PERCENT' ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"
                    )}>
                      {discount.type === 'PERCENT' ? (
                        <><Percent className="w-3 h-3 mr-1" /> {discount.value}%</>
                      ) : (
                        <><DollarSign className="w-3 h-3 mr-1" /> Rp {discount.value.toLocaleString()}</>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex flex-col">
                      <span>{format(new Date(discount.startDate), 'dd MMM yyyy')}</span>
                      <span className="text-xs text-gray-400">s/d</span>
                      <span>{format(new Date(discount.endDate), 'dd MMM yyyy')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex gap-2">
                      <span className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs">
                        <Box className="w-3 h-3 mr-1" /> {discount._count?.products || 0}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded bg-purple-50 text-purple-700 text-xs">
                        <Stethoscope className="w-3 h-3 mr-1" /> {discount._count?.treatments || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleToggle(discount.id, discount.isActive)}
                      className={cn(
                        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none min-h-[24px] min-w-[44px]",
                        discount.isActive ? "bg-green-600" : "bg-gray-200"
                      )}
                    >
                      <span className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        discount.isActive ? "translate-x-5" : "translate-x-0"
                      )} />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <button onClick={() => handleEdit(discount)} className="text-blue-600 hover:text-blue-900 mr-4 p-2 rounded-full hover:bg-blue-50 min-w-[48px] min-h-[48px] inline-flex items-center justify-center">
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredDiscounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Tidak ada diskon ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isSheetOpen && (
        <DiscountForm 
          discount={editingDiscount} 
          products={products}
          treatments={treatments}
          onClose={() => setIsSheetOpen(false)}
        />
      )}
    </div>
  )
}

function DiscountForm({ 
  discount, 
  products, 
  treatments, 
  onClose 
}: { 
  discount: Discount | null, 
  products: Product[],
  treatments: Treatment[],
  onClose: () => void 
}) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: discount?.name || '',
    description: discount?.description || '',
    type: discount?.type || 'PERCENT',
    value: discount?.value || 0,
    startDate: discount?.startDate ? new Date(discount.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    endDate: discount?.endDate ? new Date(discount.endDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    isActive: discount?.isActive ?? true,
    productIds: new Set(discount?.products?.map(p => p.id) || []),
    treatmentIds: new Set(discount?.treatments?.map(t => t.id) || [])
  })

  // We need to fetch current relations if editing and they weren't passed fully in initial list
  // Note: getDiscounts only returned _count. We might need to fetch details or rely on getDiscount logic if we were fetching single.
  // Actually, for simplicity, the Props definition for Discount implies we might not have the lists.
  // BUT, getDiscounts in server action didn't include the lists, only counts.
  // So we need to fetch the full discount details when opening edit, OR just pass them.
  // Given the current implementation of getDiscounts, we don't have the IDs.
  // I should update the client to fetch details on edit, or update getDiscounts to include IDs (might be heavy).
  // Better: Fetch details on edit.
  
  // Let's implement a "Load Details" effect or use a server action to get details.
  // For now, I'll add a simple client-side fetcher using the server action `getDiscount`.
  
  const [fetchingDetails, setFetchingDetails] = useState(!!discount)

  useEffect(() => {
    if (discount) {
      getDiscount(discount.id).then(fullDiscount => {
         if (fullDiscount) {
           setFormData(prev => ({
             ...prev,
             productIds: new Set(fullDiscount.products.map(p => p.id)),
             treatmentIds: new Set(fullDiscount.treatments.map(t => t.id))
           }))
         }
         setFetchingDetails(false)
      })
    }
  }, [discount])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await upsertDiscount({
        id: discount?.id,
        name: formData.name,
        description: formData.description,
        type: formData.type as DiscountType,
        value: Number(formData.value),
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        isActive: formData.isActive,
        productIds: Array.from(formData.productIds),
        treatmentIds: Array.from(formData.treatmentIds)
      })
      onClose()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!discount?.id) return
    if (!confirm('Yakin ingin menghapus diskon ini?')) return
    setLoading(true)
    try {
      await deleteDiscount(discount.id)
      onClose()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleProduct = (id: string) => {
    const next = new Set(formData.productIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setFormData({ ...formData, productIds: next })
  }

  const toggleTreatment = (id: string) => {
    const next = new Set(formData.treatmentIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setFormData({ ...formData, treatmentIds: next })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-2xl h-[90vh] flex flex-col rounded-t-xl sm:rounded-xl animate-in slide-in-from-bottom-full duration-300">
         <div className="flex items-center justify-between p-6 border-b shrink-0">
            <h3 className="text-lg font-semibold">{discount ? 'Edit Diskon' : 'Buat Diskon Baru'}</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="h-5 w-5" />
            </button>
         </div>

         <div className="flex-1 overflow-y-auto p-6">
           {fetchingDetails ? (
             <div className="flex items-center justify-center h-40">Loading details...</div>
           ) : (
             <form id="discount-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Nama Diskon</label>
                    <input 
                      required
                      className="w-full p-2 border rounded-lg"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="Contoh: Promo Lebaran"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Deskripsi</label>
                    <textarea 
                      className="w-full p-2 border rounded-lg"
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Jenis Diskon</label>
                    <select
                      className="w-full p-2 border rounded-lg"
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value as DiscountType})}
                    >
                      <option value="PERCENT">Persentase (%)</option>
                      <option value="NOMINAL">Nominal (Rp)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Nilai</label>
                    <input 
                      type="number"
                      required
                      min="0"
                      className="w-full p-2 border rounded-lg"
                      value={formData.value}
                      onChange={e => setFormData({...formData, value: parseFloat(e.target.value)})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Mulai</label>
                    <input 
                      type="date"
                      required
                      className="w-full p-2 border rounded-lg"
                      value={formData.startDate}
                      onChange={e => setFormData({...formData, startDate: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Berakhir</label>
                    <input 
                      type="date"
                      required
                      className="w-full p-2 border rounded-lg"
                      value={formData.endDate}
                      onChange={e => setFormData({...formData, endDate: e.target.value})}
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Tag className="w-4 h-4" /> Target Produk & Treatment
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-6 h-60">
                    {/* Products List */}
                    <div className="border rounded-lg flex flex-col overflow-hidden">
                      <div className="bg-gray-50 p-2 border-b text-sm font-medium">Produk ({formData.productIds.size})</div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {products.map(p => (
                          <label key={p.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={formData.productIds.has(p.id)}
                              onChange={() => toggleProduct(p.id)}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm truncate">{p.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Treatments List */}
                    <div className="border rounded-lg flex flex-col overflow-hidden">
                      <div className="bg-gray-50 p-2 border-b text-sm font-medium">Treatment ({formData.treatmentIds.size})</div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {treatments.map(t => (
                          <label key={t.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={formData.treatmentIds.has(t.id)}
                              onChange={() => toggleTreatment(t.id)}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm truncate">{t.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
             </form>
           )}
         </div>

         <div className="p-6 border-t shrink-0 bg-gray-50 flex gap-3 rounded-b-xl">
           {discount && (
             <button 
               type="button"
               onClick={handleDelete}
               className="px-4 py-2 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 font-medium"
               disabled={loading}
             >
               Hapus
             </button>
           )}
           <button 
             type="submit"
             form="discount-form"
             className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
             disabled={loading}
           >
             {loading ? 'Menyimpan...' : 'Simpan Diskon'}
           </button>
         </div>
      </div>
    </div>
  )
}
