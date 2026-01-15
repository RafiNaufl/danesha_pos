'use client'

import { useState } from 'react'
import { Settings } from '@prisma/client'
import { Save, Store } from 'lucide-react'
import { updateSettings } from '@/app/actions/admin/settings'
import { cn } from '@/lib/utils'

type Props = {
  initialSettings: Omit<Settings, 'commissionDefaultPercent'> & { commissionDefaultPercent: number }
}

export function SettingsClient({ initialSettings }: Props) {
  const [formData, setFormData] = useState({
     storeName: initialSettings.storeName,
     storeAddress: initialSettings.storeAddress || '',
     storePhone: initialSettings.storePhone || '',
     commissionDefaultPercent: initialSettings.commissionDefaultPercent.toString()
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault()
     setLoading(true)
     try {
       await updateSettings({
          storeName: formData.storeName,
          storeAddress: formData.storeAddress,
          storePhone: formData.storePhone,
          commissionDefaultPercent: Number(formData.commissionDefaultPercent)
       })
       alert('Pengaturan berhasil disimpan')
     } catch (e: any) {
       alert(e.message)
     } finally {
       setLoading(false)
     }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-blue-100 p-3 rounded-full text-blue-600">
          <Store className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">Pengaturan Toko</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
         <div>
           <label className="block text-sm font-medium mb-1">Nama Klinik/Toko</label>
           <input 
             required
             className="w-full p-2 border rounded-lg min-h-[48px]"
             value={formData.storeName}
             onChange={e => setFormData({...formData, storeName: e.target.value})}
           />
         </div>

         <div>
           <label className="block text-sm font-medium mb-1">Alamat</label>
           <textarea 
             className="w-full p-2 border rounded-lg"
             rows={3}
             value={formData.storeAddress}
             onChange={e => setFormData({...formData, storeAddress: e.target.value})}
           />
         </div>

         <div>
           <label className="block text-sm font-medium mb-1">No Telepon</label>
           <input 
             className="w-full p-2 border rounded-lg min-h-[48px]"
             value={formData.storePhone}
             onChange={e => setFormData({...formData, storePhone: e.target.value})}
           />
         </div>

         <div className="pt-4 border-t">
           <h3 className="font-semibold mb-4">Komisi & Gaji</h3>
           <div>
             <label className="block text-sm font-medium mb-1">Default Komisi Therapist (%)</label>
             <div className="relative w-32">
                <input 
                  type="number"
                  min="0"
                  max="100"
                  required
                  className="w-full p-2 pr-8 border rounded-lg"
                  value={formData.commissionDefaultPercent}
                  onChange={e => setFormData({...formData, commissionDefaultPercent: e.target.value})}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
             </div>
             <p className="text-xs text-gray-500 mt-1">Digunakan jika komisi per item tidak diset.</p>
           </div>
         </div>

         <div className="pt-6">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 min-h-[48px]"
            >
               <Save className="h-5 w-5" />
               {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
         </div>
      </form>
    </div>
  )
}
