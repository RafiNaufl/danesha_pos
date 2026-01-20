
'use client'

import { useState, useEffect } from 'react'
import { Therapist } from '@prisma/client'
import { Plus, Search, Edit, X, UserCog, DollarSign, Calendar } from 'lucide-react'
import { upsertTherapist, deleteTherapist, getTherapistCommissions } from '@/app/actions/admin/therapists'
import { cn, formatMoney } from '@/lib/utils'

type Level = {
  id: string
  name: string
  defaultCommission: number
  minCommission: number
  maxCommission: number
}

type TherapistWithLevel = Omit<Therapist, 'commissionPercent'> & {
  commissionPercent: number | null
  level?: Level | null
}

type Props = {
  initialTherapists: TherapistWithLevel[]
  initialLevels: Level[]
}

export function TherapistsClient({ initialTherapists, initialLevels }: Props) {
  const [therapists, setTherapists] = useState(initialTherapists)
  const [search, setSearch] = useState('')
  const [editingTherapist, setEditingTherapist] = useState<TherapistWithLevel | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [commissionView, setCommissionView] = useState<{therapist: TherapistWithLevel, data: any} | null>(null)

  const filteredTherapists = initialTherapists.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    (t.phone && t.phone.includes(search))
  )

  const handleEdit = (therapist: TherapistWithLevel) => {
    setEditingTherapist(therapist)
    setIsSheetOpen(true)
  }

  const handleCreate = () => {
    setEditingTherapist(null)
    setIsSheetOpen(true)
  }

  const handleViewCommissions = async (therapist: TherapistWithLevel) => {
    // Default to current month
    const date = new Date()
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    
    const res = await getTherapistCommissions(therapist.id, firstDay, lastDay)
    setCommissionView({ therapist, data: res })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Therapists</h1>
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
          placeholder="Cari therapist (nama/hp)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[48px]"
        />
      </div>

      {/* List */}
      <div className="space-y-4">
        {filteredTherapists.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
             <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                   <UserCog className="h-5 w-5" />
                </div>
                <div>
                   <h3 className="font-semibold">{item.name}</h3>
                   <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{item.phone || '-'}</span>
                      {item.level && (
                        <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">
                           {item.level.name} ({item.commissionPercent}%)
                        </span>
                      )}
                   </div>
                   {!item.active && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full inline-block mt-1">Inactive</span>}
                </div>
             </div>
             <div className="flex items-center gap-2 self-end sm:self-auto">
               <button 
                 onClick={() => handleViewCommissions(item)}
                 className="p-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-full min-w-[48px] min-h-[48px] flex items-center justify-center"
                 title="Lihat Komisi"
               >
                 <DollarSign className="h-4 w-4" />
               </button>
               <button onClick={() => handleEdit(item)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full min-w-[48px] min-h-[48px] flex items-center justify-center">
                 <Edit className="h-4 w-4" />
               </button>
             </div>
          </div>
        ))}
      </div>

      {/* Edit Sheet */}
      {isSheetOpen && (
        <TherapistForm 
           therapist={editingTherapist} 
           levels={initialLevels}
           onClose={() => setIsSheetOpen(false)}
        />
      )}

      {/* Commission View */}
      {commissionView && (
        <CommissionModal
          therapist={commissionView.therapist}
          initialData={commissionView.data}
          onClose={() => setCommissionView(null)}
        />
      )}
    </div>
  )
}

function TherapistForm({ therapist, levels, onClose }: { therapist: TherapistWithLevel | null, levels: Level[], onClose: () => void }) {
  const [formData, setFormData] = useState({
     name: therapist?.name || '',
     phone: therapist?.phone || '',
     active: therapist?.active ?? true,
     levelId: therapist?.levelId || '',
     commissionPercent: therapist?.commissionPercent?.toString() || ''
  })
  const [loading, setLoading] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(
    therapist?.level || levels.find(l => l.id === therapist?.levelId) || null
  )

  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const levelId = e.target.value
    const level = levels.find(l => l.id === levelId) || null
    setSelectedLevel(level)
    
    // Auto fill commission if selecting a level and commission is empty or different
    if (level) {
      setFormData(prev => ({
        ...prev,
        levelId,
        commissionPercent: level.defaultCommission.toString()
      }))
    } else {
      setFormData(prev => ({ ...prev, levelId: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // Client-side validation
      if (selectedLevel) {
        const comm = Number(formData.commissionPercent)
        if (comm < selectedLevel.minCommission || comm > selectedLevel.maxCommission) {
          throw new Error(`Komisi untuk ${selectedLevel.name} harus antara ${selectedLevel.minCommission}% - ${selectedLevel.maxCommission}%`)
        }
      }

      await upsertTherapist({
        id: therapist?.id,
        name: formData.name,
        phone: formData.phone,
        active: formData.active,
        levelId: formData.levelId || undefined,
        commissionPercent: formData.commissionPercent ? Number(formData.commissionPercent) : undefined
      })
      onClose()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!therapist?.id) return
    if (!confirm('Hapus/Nonaktifkan therapist ini?')) return
    setLoading(true)
    try {
      await deleteTherapist(therapist.id)
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
      
      <div className="relative bg-white w-full max-w-lg rounded-t-xl sm:rounded-xl p-6 animate-in slide-in-from-bottom-full duration-300">
         <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">{therapist ? 'Edit Therapist' : 'Tambah Therapist'}</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="h-5 w-5" />
            </button>
         </div>

         <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nama Therapist</label>
              <input 
                required
                className="w-full p-2 border rounded-lg"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">No HP</label>
              <input 
                className="w-full p-2 border rounded-lg"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="block text-sm font-medium mb-1">Level</label>
                 <select 
                   className="w-full p-2 border rounded-lg bg-white"
                   value={formData.levelId}
                   onChange={handleLevelChange}
                 >
                   <option value="">-- Pilih Level --</option>
                   {levels.map(l => (
                     <option key={l.id} value={l.id}>{l.name}</option>
                   ))}
                 </select>
              </div>
              <div>
                 <label className="block text-sm font-medium mb-1">Komisi (%)</label>
                 <div className="relative">
                   <input 
                     type="number"
                     step="0.1"
                     className="w-full p-2 pr-8 border rounded-lg"
                     value={formData.commissionPercent}
                     onChange={e => setFormData({...formData, commissionPercent: e.target.value})}
                     placeholder={selectedLevel ? `${selectedLevel.defaultCommission}` : '0'}
                   />
                   <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                 </div>
                 {selectedLevel && (
                   <p className="text-xs text-gray-500 mt-1">Range: {selectedLevel.minCommission}% - {selectedLevel.maxCommission}%</p>
                 )}
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
               <label htmlFor="active" className="text-sm font-medium">Aktif</label>
            </div>

            <div className="flex gap-3 pt-6">
               {therapist && (
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

function CommissionModal({ therapist, initialData, onClose }: { therapist: TherapistWithLevel, initialData: any, onClose: () => void }) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
  })

  const handleFilter = async () => {
    setLoading(true)
    const [y, m] = month.split('-')
    const firstDay = new Date(Number(y), Number(m) - 1, 1)
    const lastDay = new Date(Number(y), Number(m), 0)
    
    const res = await getTherapistCommissions(therapist.id, firstDay, lastDay)
    setData(res)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-lg h-[90vh] sm:h-[80vh] overflow-hidden rounded-t-xl sm:rounded-xl flex flex-col animate-in slide-in-from-bottom-full duration-300">
         <div className="p-6 border-b flex items-center justify-between bg-gray-50">
            <div>
               <h3 className="text-lg font-bold">Komisi: {therapist.name}</h3>
               <p className="text-sm text-gray-500">Total Periode Ini</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
              <X className="h-5 w-5" />
            </button>
         </div>

         <div className="p-4 border-b bg-white flex items-center gap-2">
            <input 
              type="month" 
              className="border p-2 rounded-lg flex-1"
              value={month}
              onChange={e => setMonth(e.target.value)}
            />
            <button 
              onClick={handleFilter}
              disabled={loading}
              className="bg-blue-600 text-white p-2 rounded-lg"
            >
              Filter
            </button>
         </div>

         <div className="flex-1 overflow-y-auto p-6">
            <div className="bg-green-50 p-6 rounded-xl border border-green-100 mb-6 text-center">
               <p className="text-sm text-green-600 mb-1">Total Komisi</p>
               <p className="text-3xl font-bold text-green-700">{formatMoney(data.total)}</p>
            </div>

            <div className="space-y-3">
               {data.commissions.map((c: any) => (
                 <div key={c.id} className="bg-white border p-3 rounded-xl text-sm flex justify-between items-center">
                    <div>
                       <p className="font-medium">{c.transactionItem.treatment?.name || 'Treatment'}</p>
                       <p className="text-xs text-gray-500">
                         {new Date(c.createdAt).toLocaleDateString('id-ID')} • {c.transactionItem.transaction.number}
                       </p>
                    </div>
                    <div className="text-right">
                       <p className="font-bold text-green-600">+{formatMoney(Number(c.amount))}</p>
                       <p className="text-xs text-gray-400">{Number(c.percent)}%</p>
                    </div>
                 </div>
               ))}
               {data.commissions.length === 0 && (
                 <p className="text-center text-gray-500 py-4">Tidak ada data komisi</p>
               )}
            </div>
         </div>
      </div>
    </div>
  )
}
