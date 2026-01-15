'use client'

import { useState } from 'react'
import { Treatment } from '@prisma/client'
import { Plus, Search, Edit, X, Stethoscope } from 'lucide-react'
import { upsertTreatment, deleteTreatment } from '@/app/actions/admin/treatments'
import { cn, formatMoney } from '@/lib/utils'

type TreatmentWithSellPrice = Omit<Treatment, 'costPrice' | 'sellPrice'> & { 
  costPrice: number
  sellPrice: number
}

type Props = {
  initialTreatments: TreatmentWithSellPrice[]
}

export function TreatmentsClient({ initialTreatments }: Props) {
  const [treatments, setTreatments] = useState(initialTreatments)
  const [search, setSearch] = useState('')
  const [editingTreatment, setEditingTreatment] = useState<TreatmentWithSellPrice | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const filteredTreatments = initialTreatments.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    (t.code && t.code.includes(search))
  )

  const handleEdit = (treatment: TreatmentWithSellPrice) => {
    setEditingTreatment(treatment)
    setIsSheetOpen(true)
  }

  const handleCreate = () => {
    setEditingTreatment(null)
    setIsSheetOpen(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Treatments</h1>
        <button 
          onClick={handleCreate}
          className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Cari treatment (nama/kode)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
        />
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTreatments.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border flex justify-between items-start">
             <div>
                <div className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-blue-500" />
                    <h3 className="font-semibold">{item.name}</h3>
                </div>
                <p className="text-sm text-gray-500 mt-1">{item.code || '-'}</p>
                <div className="mt-2 text-sm text-gray-600 flex gap-3">
                   <span>HPP: {formatMoney(Number(item.costPrice))}</span>
                   <span>•</span>
                   <span>{item.duration} min</span>
                </div>
                {!item.active && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full mt-2 inline-block">Inactive</span>}
             </div>
             <button onClick={() => handleEdit(item)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full min-w-[48px] min-h-[48px] flex items-center justify-center">
               <Edit className="h-4 w-4" />
             </button>
          </div>
        ))}
      </div>

      {/* Edit Sheet */}
      {isSheetOpen && (
        <TreatmentForm 
           treatment={editingTreatment} 
           onClose={() => setIsSheetOpen(false)}
        />
      )}
    </div>
  )
}

function TreatmentForm({ treatment, onClose }: { treatment: TreatmentWithSellPrice | null, onClose: () => void }) {
  const [formData, setFormData] = useState({
     name: treatment?.name || '',
     code: treatment?.code || '',
     duration: treatment?.duration.toString() || '60',
     costPrice: treatment?.costPrice.toString() || '0',
     active: treatment?.active ?? true,
     sellPrice: treatment?.sellPrice.toString() || '0'
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await upsertTreatment({
        id: treatment?.id,
        name: formData.name,
        code: formData.code,
        duration: Number(formData.duration),
        costPrice: Number(formData.costPrice),
        active: formData.active,
        sellPrice: Number(formData.sellPrice)
      })
      onClose()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
     if (!treatment?.id) return
     if (!confirm('Hapus treatment ini?')) return
     setLoading(true)
     try {
       await deleteTreatment(treatment.id)
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
            <h3 className="text-lg font-semibold">{treatment ? 'Edit Treatment' : 'Tambah Treatment'}</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="h-5 w-5" />
            </button>
         </div>

         <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nama Treatment</label>
              <input 
                required
                className="w-full p-2 border rounded-lg"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="block text-sm font-medium mb-1">Kode</label>
                <input 
                  className="w-full p-2 border rounded-lg"
                  value={formData.code}
                  onChange={e => setFormData({...formData, code: e.target.value})}
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium mb-1">Durasi (Menit)</label>
                <input 
                  type="number"
                  required
                  className="w-full p-2 border rounded-lg"
                  value={formData.duration}
                  onChange={e => setFormData({...formData, duration: e.target.value})}
                />
              </div>
              <div className="col-span-1">
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
              <h4 className="font-medium mb-3">Harga Jual Treatment</h4>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Harga Jual</label>
                <input 
                  type="number"
                  required
                  className="w-full p-2 border rounded-lg"
                  value={formData.sellPrice}
                  onChange={e => setFormData({...formData, sellPrice: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-6">
               {treatment && (
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
